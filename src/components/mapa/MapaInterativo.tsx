import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import JSZip from 'jszip';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { permissions } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MapPin, Plus, Pencil, Trash2, Layers, Eye, EyeOff, Crosshair, ChevronRight, ChevronDown, FolderPlus, FolderOpen, MoreVertical, Upload, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { CamadaModal } from './CamadaModal';
import { AsBuiltConfigModal } from './AsBuiltConfigModal';
import 'leaflet/dist/leaflet.css';
import 'leaflet-polylinedecorator';

interface Camada {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  opacidade: number;
  storage_path: string;
  arquivo_nome: string;
  visivel_default: boolean;
  group_id: string | null;
}

interface LayerGroup {
  id: string;
  name: string;
  ordem: number;
}

interface RedePoint {
  id: string;
  os_id: string;
  trecho: string;
  bacia: string;
  status: string;
  latitude: number;
  longitude: number;
  nome_estaca: string | null;
  created_at: string;
  pv_montante: string | null;
  pv_jusante: string | null;
  comprimento_real: number | null;
  comprimento_previsto: number | null;
  encarregado: string | null;
  profundidade: number | null;
  ns_relacionada: string | null;
}

interface LigacaoPoint {
  id: string;
  os_id: string;
  trecho: string;
  numero: number;
  referencia: string | null;
  latitude: number;
  longitude: number;
}

const STATUS_COLORS: Record<string, string> = {
  CINZA: '#999999', VERMELHO: '#dc2626', LARANJA: '#f97316',
  AMARELO: '#ca8a04', VERDE: '#16a34a',
};

const DEFAULT_redeColor = '#16a34a';
const DEFAULT_ligacoesColor = '#2563eb';
const DEFAULT_CENTER: [number, number] = [-9.1167, -35.2667];
const DEFAULT_ZOOM = 13;

// Parse KMZ (zip with .kml inside) → GeoJSON
async function loadKmzAsGeoJSON(url: string): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    // localizar primeiro .kml dentro do zip
    let kmlFile: JSZip.JSZipObject | null = null;
    zip.forEach((_path, file) => {
      if (!kmlFile && /\.kml$/i.test(file.name)) kmlFile = file;
    });
    if (!kmlFile) throw new Error('KMZ sem arquivo .kml');
    const kmlText = await (kmlFile as JSZip.JSZipObject).async('text');
    const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
    const geojson = kmlToGeoJson(dom);
    return geojson as GeoJSON.FeatureCollection;
  } catch (err) {
    console.error('[MapaInterativo] erro ao parsear KMZ', err);
    return null;
  }
}

interface MapaInterativoProps {
  /** Mostra marcador da posição GPS atual e botão "Minha Localização" */
  showLocation?: boolean;
  /** Altura do mapa em px ou string CSS. Default 520. */
  height?: number | string;
  /** Margem inferior. Default mb-6. */
  className?: string;
  /** OS ID para focar (flyToBounds + popup + pulse) */
  focusOsId?: string | null;
}

export const MapaInterativo = ({ showLocation = false, height = 520, className = 'mb-6', focusOsId = null }: MapaInterativoProps) => {
  const { effectiveRole } = useAuth();
  const canManage = permissions.canEditOS(effectiveRole);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const redeLayerRef = useRef<L.LayerGroup | null>(null);
  const ligacoesLayerRef = useRef<L.LayerGroup | null>(null);
  const osPolylineRef = useRef<Map<string, L.Polyline>>(new Map());
  const kmzLayersRef = useRef<Map<string, L.Layer>>(new Map());
  const kmzBoundsRef = useRef<Map<string, L.LatLngBounds>>(new Map());
  // Assinatura por camada (cor|opacidade|storage_path) para saber quando refazer o layer
  const kmzSigRef = useRef<Map<string, string>>(new Map());
  const didInitialFitRef = useRef(false);
  const meMarkerRef = useRef<L.Marker | null>(null);
  const meAccuracyRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const didCenterOnMeRef = useRef(false);

  const [camadas, setCamadas] = useState<Camada[]>([]);
  const [groups, setGroups] = useState<LayerGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [redePoints, setRedePoints] = useState<RedePoint[]>([]);
  const [ligacoesPoints, setLigacoesPoints] = useState<LigacaoPoint[]>([]);
  const redePointsRef = useRef<RedePoint[]>([]);
  const ligacoesPointsRef = useRef<LigacaoPoint[]>([]);
  useEffect(() => { redePointsRef.current = redePoints; }, [redePoints]);
  useEffect(() => { ligacoesPointsRef.current = ligacoesPoints; }, [ligacoesPoints]);

  // Visibilidade persistida em localStorage por NOME da camada
  const VIS_STORAGE_KEY = 'sangest_map_layers_visibility';
  const readVisStorage = (): Record<string, boolean> => {
    try {
      const raw = localStorage.getItem(VIS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  };
  const visStorageRef = useRef<Record<string, boolean>>(readVisStorage());
  const [visivel, setVisivel] = useState<Record<string, boolean>>(() => {
    const stored = visStorageRef.current;
    return {
      __rede: stored['As-built Rede'] !== false,
      __ligacoes: stored['As-built Ligações'] !== false,
    };
  });
  const visivelRef = useRef(visivel);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Camada | null>(null);
  const [loading, setLoading] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);

  // As-built fixed layers config
  const [redeColor, setRedeColor] = useState(DEFAULT_redeColor);
  const [redeOpacidade, setRedeOpacidade] = useState(0.9);
  const [ligacoesColor, setLigacoesColor] = useState(DEFAULT_ligacoesColor);
  const [ligacoesOpacidade, setLigacoesOpacidade] = useState(0.9);
  const [editAsBuilt, setEditAsBuilt] = useState<null | 'rede' | 'ligacoes'>(null);

  // Reidrata localStorage antes de qualquer camada ser adicionada ao mapa
  useEffect(() => {
    const savedState = readVisStorage();
    console.log("Map layer state loaded:", savedState);
    visStorageRef.current = savedState;
    setVisivel((prev) => {
      const next = {
        ...prev,
        __rede: savedState['As-built Rede'] !== false,
        __ligacoes: savedState['As-built Ligações'] !== false,
      };
      visivelRef.current = next;
      return next;
    });
  }, []);

  // Init mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    // Pane dedicado às ligações com z-index acima da polyline (overlayPane=400)
    const ligacoesPane = map.createPane('ligacoesPane');
    ligacoesPane.style.zIndex = '650';
    redeLayerRef.current = L.layerGroup();
    ligacoesLayerRef.current = L.layerGroup();
    if (visStorageRef.current['As-built Rede'] !== false) redeLayerRef.current.addTo(map);
    if (visStorageRef.current['As-built Ligações'] !== false) ligacoesLayerRef.current.addTo(map);
    mapRef.current = map;
    // Garante o cálculo correto de tamanho (mobile: container só ganha altura após layout)
    const refitToData = () => {
      const all = [
        ...redePointsRef.current.map(r => [r.latitude, r.longitude] as [number, number]),
        ...ligacoesPointsRef.current.map(r => [r.latitude, r.longitude] as [number, number]),
      ];
      if (all.length === 0) return;
      try {
        const b = L.latLngBounds(all);
        if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
      } catch {/* ignore */}
    };
    const invalidate = () => {
      try { map.invalidateSize(); } catch {}
      refitToData();
    };
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 300);
    const t3 = setTimeout(invalidate, 800);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => invalidate());
      ro.observe(containerRef.current);
    }
    const onWinResize = () => invalidate();
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onWinResize);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======= Fetch dados =======
  const fetchCamadas = async (groupsForVisibility = groups) => {
    const stored = visStorageRef.current;
    const groupNameById = new Map(groupsForVisibility.map((g) => [g.id, g.name]));
    const { data } = await supabase
      .from('mapa_camadas')
      .select('*')
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });
    if (data) {
      const loadedCamadas = data as Camada[];
      const nextVis = { ...visivelRef.current };
      for (const c of loadedCamadas) {
        // Estado salvo por nome vence antes da renderização; senão mantém o estado atual ou default visível.
        const groupName = c.group_id ? groupNameById.get(c.group_id) : undefined;
        const savedValue = stored[c.nome] ?? (groupName ? stored[groupName] : undefined);
        nextVis[c.id] = savedValue !== undefined ? !!savedValue : nextVis[c.id] !== false;
      }
      visivelRef.current = nextVis;
      setVisivel(nextVis);
      setCamadas(loadedCamadas);
    }
  };

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('kmz_layer_groups')
      .select('id, name, ordem')
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });
    if (data) {
      setGroups(data as LayerGroup[]);
      // Inicia todos os grupos (incluindo "Sem grupo") recolhidos por padrão
      setCollapsedGroups((prev) => {
        const next = { ...prev };
        for (const g of data) if (next[g.id] === undefined) next[g.id] = true;
        if (next['__nogroup'] === undefined) next['__nogroup'] = true;
        return next;
      });
    }
    return (data ?? []) as LayerGroup[];
  };

  const fetchAsBuiltConfig = async () => {
    const { data } = await supabase
      .from('mapa_asbuilt_config')
      .select('layer_key, cor, opacidade');
    if (!data) return;
    for (const row of data) {
      if (row.layer_key === 'rede') {
        setRedeColor(row.cor);
        setRedeOpacidade(Number(row.opacidade));
      } else if (row.layer_key === 'ligacoes') {
        setLigacoesColor(row.cor);
        setLigacoesOpacidade(Number(row.opacidade));
      }
    }
  };

  const fetchAsBuilt = async () => {
    const { data: ab } = await supabase
      .from('topografia_asbuilt')
      .select('id, os_id, latitude, longitude, nome_estaca, created_at, encarregado, profundidade, ns_relacionada')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: true });

    if (!ab || ab.length === 0) {
      setRedePoints([]);
    } else {
      const osIds = [...new Set(ab.map(r => r.os_id))];
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select('id, trecho, bacia, status, pv_montante, pv_jusante, comprimento_real, comprimento_previsto')
        .in('id', osIds);
      const osMap = new Map((osData ?? []).map(o => [o.id, o]));
      const result: RedePoint[] = [];
      for (const r of ab) {
        const os = osMap.get(r.os_id);
        if (os && r.latitude != null && r.longitude != null) {
          result.push({
            id: r.id, os_id: r.os_id, trecho: os.trecho, bacia: os.bacia,
            status: os.status, latitude: Number(r.latitude), longitude: Number(r.longitude),
            nome_estaca: r.nome_estaca, created_at: r.created_at,
            pv_montante: os.pv_montante, pv_jusante: os.pv_jusante,
            comprimento_real: os.comprimento_real, comprimento_previsto: os.comprimento_previsto,
            encarregado: (r as any).encarregado ?? null,
            profundidade: (r as any).profundidade != null ? Number((r as any).profundidade) : null,
            ns_relacionada: (r as any).ns_relacionada ?? null,
          });
        }
      }
      setRedePoints(result);
    }
  };

  const fetchLigacoes = async () => {
    const { data: lg } = await supabase
      .from('ligacoes')
      .select('id, os_id, latitude, longitude, referencia, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: true });

    if (!lg || lg.length === 0) {
      setLigacoesPoints([]);
      return;
    }
    const osIds = [...new Set(lg.map(r => r.os_id))];
    const { data: osData } = await supabase
      .from('ordens_servico')
      .select('id, trecho')
      .in('id', osIds);
    const osMap = new Map((osData ?? []).map(o => [o.id, o]));
    const counter = new Map<string, number>();
    const result: LigacaoPoint[] = [];
    for (const r of lg) {
      const os = osMap.get(r.os_id);
      if (!os || r.latitude == null || r.longitude == null) continue;
      const next = (counter.get(r.os_id) ?? 0) + 1;
      counter.set(r.os_id, next);
      result.push({
        id: r.id, os_id: r.os_id, trecho: os.trecho, numero: next,
        referencia: r.referencia, latitude: Number(r.latitude), longitude: Number(r.longitude),
      });
    }
    setLigacoesPoints(result);
  };

  // Inicial + realtime
  useEffect(() => {
    const loadGroupsAndLayers = async () => {
      const loadedGroups = await fetchGroups();
      await fetchCamadas(loadedGroups);
    };
    Promise.all([loadGroupsAndLayers(), fetchAsBuilt(), fetchLigacoes(), fetchAsBuiltConfig()]).finally(() => setLoading(false));

    const ch = supabase
      .channel('mapa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topografia_asbuilt' }, fetchAsBuilt)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ligacoes' }, fetchLigacoes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_camadas' }, () => { fetchCamadas(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kmz_layer_groups' }, () => { loadGroupsAndLayers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_asbuilt_config' }, fetchAsBuiltConfig)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ======= Render rede (polylines por OS + vértices) =======
  useEffect(() => {
    const map = mapRef.current;
    const layer = redeLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    osPolylineRef.current.clear();
    if (!visivel.__rede) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      return;
    }
    if (!map.hasLayer(layer)) layer.addTo(map);

    // Agrupar por OS preservando ordem (já vem ordenado por created_at asc)
    const grupos = new Map<string, RedePoint[]>();
    redePoints.forEach((p) => {
      const arr = grupos.get(p.os_id) ?? [];
      arr.push(p);
      grupos.set(p.os_id, arr);
    });

    grupos.forEach((pts) => {
      if (pts.length === 0) return;
      const first = pts[0];
      const latlngs: [number, number][] = pts.map((p) => [p.latitude, p.longitude]);

      const popupHtml = `
        <div style="min-width:180px;font-size:13px;">
          <p style="font-weight:700;margin:0 0 4px">${first.trecho}</p>
          <p style="margin:2px 0;color:${redeColor};font-weight:600">REDE — As-built</p>
          <p style="margin:2px 0">PV: ${first.pv_montante || '—'} → ${first.pv_jusante || '—'}</p>
          <p style="margin:2px 0">Comp. executado: ${first.comprimento_real ?? first.comprimento_previsto ?? '—'}m</p>
          <p style="margin:2px 0">Bacia: ${first.bacia}</p>
          <p style="margin:2px 0">Status: <span style="color:${STATUS_COLORS[first.status]};font-weight:600">${first.status}</span></p>
        </div>`;

      // Polyline conectando os vértices (Montante → Jusante)
      if (latlngs.length >= 2) {
        const line = L.polyline(latlngs, {
          color: redeColor, weight: 4, opacity: redeOpacidade,
        });
        line.bindPopup(popupHtml);
        line.addTo(layer);
        osPolylineRef.current.set(first.os_id, line);
        // Setas de direcionamento do fluxo (gravidade: montante → jusante)
        // @ts-ignore - plugin polylineDecorator
        L.polylineDecorator(line, {
          patterns: [{
            offset: 25,
            repeat: 60,
            // @ts-ignore
            symbol: L.Symbol.arrowHead({
              pixelSize: 10,
              polygon: false,
              pathOptions: { stroke: true, color: redeColor, weight: 2.5, opacity: redeOpacidade },
            }),
          }],
        }).addTo(layer);
      }

      // Marcadores pequenos nos vértices
      pts.forEach((p, idx) => {
        const circle = L.circleMarker([p.latitude, p.longitude], {
          radius: 5, fillColor: redeColor, color: '#ffffff',
          weight: 2, opacity: 1, fillOpacity: redeOpacidade,
        });
        circle.bindPopup(`
          <div style="min-width:160px;font-size:13px;">
            <p style="font-weight:700;margin:0 0 4px">${first.trecho}</p>
            <p style="margin:2px 0">${p.nome_estaca || `Ponto ${idx + 1}`}</p>
            <p style="margin:2px 0;color:#555;font-size:12px">${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</p>
            ${p.encarregado ? `<p style="margin:2px 0">Encarregado: <b>${p.encarregado}</b></p>` : ''}
            ${p.profundidade != null ? `<p style="margin:2px 0">Profundidade: <b>${p.profundidade} m</b></p>` : ''}
            ${p.ns_relacionada ? `<p style="margin:2px 0">NS relacionada: <b>${p.ns_relacionada}</b></p>` : ''}
          </div>`);
        circle.addTo(layer);
      });
    });
  }, [redePoints, visivel.__rede, redeColor, redeOpacidade]);

  // ======= Render ligações =======
  useEffect(() => {
    const map = mapRef.current;
    const layer = ligacoesLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!visivel.__ligacoes) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      return;
    }
    if (!map.hasLayer(layer)) layer.addTo(map);
    // Renderer SVG no pane das ligações (canvas global do mapa não respeita panes)
    const ligacoesRenderer = L.svg({ pane: 'ligacoesPane' });
    ligacoesPoints.forEach((m) => {
      const square = L.circleMarker([m.latitude, m.longitude], {
        radius: 6, fillColor: ligacoesColor, color: '#ffffff',
        weight: 2, opacity: 1, fillOpacity: ligacoesOpacidade,
        pane: 'ligacoesPane',
        renderer: ligacoesRenderer,
      });
      square.bindPopup(`
        <div style="min-width:160px;font-size:13px;">
          <p style="font-weight:700;margin:0 0 4px;color:${ligacoesColor}">Ligação ${m.numero}</p>
          <p style="margin:2px 0">NS: ${m.trecho}</p>
          ${m.referencia ? `<p style="margin:2px 0">Ref: ${m.referencia}</p>` : ''}
        </div>`);
      square.addTo(layer);
    });
  }, [ligacoesPoints, visivel.__ligacoes, ligacoesColor, ligacoesOpacidade]);

  // ======= Render KMZ camadas (custom: fetch+JSZip+togeojson) =======
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remover camadas que não existem mais
    const currentIds = new Set(camadas.map(c => c.id));
    for (const [id, layer] of kmzLayersRef.current.entries()) {
      if (!currentIds.has(id)) {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        kmzLayersRef.current.delete(id);
        kmzBoundsRef.current.delete(id);
        kmzSigRef.current.delete(id);
      }
    }

    camadas.forEach(async (c) => {
      const shouldShow = visivelRef.current[c.id] !== false;
      const sig = `${c.cor}|${c.opacidade}|${c.storage_path}`;
      const cached = kmzLayersRef.current.get(c.id);
      const cachedSig = kmzSigRef.current.get(c.id);

      // Se já temos o layer e a assinatura não mudou, só alterna visibilidade
      if (cached && cachedSig === sig) {
        if (shouldShow) {
          if (!map.hasLayer(cached)) cached.addTo(map);
        } else {
          if (map.hasLayer(cached)) map.removeLayer(cached);
        }
        return;
      }

      // Mudou cor/opacidade/arquivo → remover cache antigo
      if (cached) {
        if (map.hasLayer(cached)) map.removeLayer(cached);
        kmzLayersRef.current.delete(c.id);
        kmzSigRef.current.delete(c.id);
      }

      if (!shouldShow) return;

      try {
        const { data: signed, error: signErr } = await supabase.storage
          .from('mapa-kmz')
          .createSignedUrl(c.storage_path, 3600);
        if (signErr || !signed?.signedUrl) {
          console.error('[MapaInterativo] signed url falhou', c.nome, signErr);
          return;
        }

        const geojson = await loadKmzAsGeoJSON(signed.signedUrl);
        if (!geojson || !geojson.features || geojson.features.length === 0) {
          console.warn('[MapaInterativo] KMZ vazio ou inválido:', c.nome);
          return;
        }

        // Se enquanto carregava o usuário desligou a camada, não adiciona
        if (visivelRef.current[c.id] === false) return;

        const styleOpts: L.PathOptions = {
          color: c.cor,
          fillColor: c.cor,
          opacity: c.opacidade,
          fillOpacity: c.opacidade * 0.5,
          weight: 2,
        };

        const gjLayer = L.geoJSON(geojson, {
          style: () => styleOpts,
          pointToLayer: (_feat, latlng) =>
            L.circleMarker(latlng, {
              radius: 5,
              color: c.cor,
              fillColor: c.cor,
              opacity: c.opacidade,
              fillOpacity: c.opacidade,
              weight: 2,
            }),
          onEachFeature: (feature, layer) => {
            const name = feature?.properties?.name;
            const desc = feature?.properties?.description;
            if (name || desc) {
              layer.bindPopup(`
                <div style="min-width:160px;font-size:13px;">
                  ${name ? `<p style="font-weight:700;margin:0 0 4px">${name}</p>` : ''}
                  ${desc ? `<p style="margin:2px 0;color:#555">${desc}</p>` : ''}
                  <p style="margin:4px 0 0;font-size:11px;color:#888">${c.nome}</p>
                </div>`);
            }
          },
        });

        gjLayer.addTo(map);
        kmzLayersRef.current.set(c.id, gjLayer);
        kmzSigRef.current.set(c.id, sig);
        try {
          const b = gjLayer.getBounds();
          if (b.isValid()) kmzBoundsRef.current.set(c.id, b);
        } catch {/* sem bounds */}

        // Auto-fit apenas na primeira camada KMZ carregada quando não há as-built
        if (!didInitialFitRef.current && redePoints.length === 0 && ligacoesPoints.length === 0) {
          try {
            const b = gjLayer.getBounds();
            if (b.isValid()) {
              map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
              didInitialFitRef.current = true;
            }
          } catch {/* ignore */}
        }
      } catch (err) {
        console.error('[MapaInterativo] erro carregando camada', c.nome, err);
      }
    });
  }, [camadas, visivel]);

  // Auto-fit para as-built quando há dados
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const all = [
      ...redePoints.map(r => [r.latitude, r.longitude] as [number, number]),
      ...ligacoesPoints.map(r => [r.latitude, r.longitude] as [number, number]),
    ];
    if (all.length === 0) return;
    const bounds = L.latLngBounds(all);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    didInitialFitRef.current = true;
  }, [redePoints.length, ligacoesPoints.length]);

  // Focus on a specific OS (flyToBounds + popup + pulse)
  useEffect(() => {
    if (!focusOsId) return;
    const map = mapRef.current;
    if (!map) return;
    const pts = redePoints.filter((p) => p.os_id === focusOsId);
    if (pts.length < 2) return;
    const bounds = L.latLngBounds(pts.map((p) => [p.latitude, p.longitude] as [number, number]));
    if (!bounds.isValid()) return;
    try {
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 18, duration: 1.0 });
    } catch {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
    }
    const line = osPolylineRef.current.get(focusOsId);
    if (line) {
      setTimeout(() => {
        try { line.openPopup(bounds.getCenter()); } catch {/* ignore */}
        const start = Date.now();
        const interval = window.setInterval(() => {
          const t = (Date.now() - start) / 1000;
          if (t >= 3) {
            window.clearInterval(interval);
            try { line.setStyle({ weight: 4, color: redeColor, opacity: redeOpacidade }); } catch {/* ignore */}
            return;
          }
          const w = 5 + Math.abs(Math.sin(t * Math.PI * 1.6)) * 7;
          try { line.setStyle({ weight: w, color: '#4dd9ac', opacity: 1 }); } catch {/* ignore */}
        }, 60);
      }, 1100);
    }
  }, [focusOsId, redePoints]);

  // ======= Geolocalização (apenas quando showLocation) =======
  useEffect(() => {
    if (!showLocation) return;
    const map = mapRef.current;
    if (!map) return;
    if (!('geolocation' in navigator)) {
      toast.error('Geolocalização não suportada neste dispositivo');
      return;
    }

    // Ícone pulsante azul
    const pulseIcon = L.divIcon({
      className: 'me-pulse-icon',
      html: `<div style="position:relative;width:18px;height:18px;">
        <span style="position:absolute;inset:0;border-radius:50%;background:#2563eb;opacity:0.35;animation:mePulse 1.6s ease-out infinite;"></span>
        <span style="position:absolute;inset:4px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></span>
      </div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const onPos = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const latlng: [number, number] = [latitude, longitude];
      if (!meMarkerRef.current) {
        meMarkerRef.current = L.marker(latlng, { icon: pulseIcon, zIndexOffset: 1000 })
          .bindPopup('Sua localização atual')
          .addTo(map);
        meAccuracyRef.current = L.circle(latlng, {
          radius: accuracy,
          color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.08,
        }).addTo(map);
      } else {
        meMarkerRef.current.setLatLng(latlng);
        meAccuracyRef.current?.setLatLng(latlng);
        meAccuracyRef.current?.setRadius(accuracy);
      }
      // Centraliza só na primeira leitura
      if (!didCenterOnMeRef.current) {
        didCenterOnMeRef.current = true;
        if (!didInitialFitRef.current) {
          map.setView(latlng, 16);
          didInitialFitRef.current = true;
        }
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      console.warn('[MapaInterativo] geolocation error', err);
      if (err.code === err.PERMISSION_DENIED) {
        toast.error('Permissão de localização negada');
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      if (meMarkerRef.current) { map.removeLayer(meMarkerRef.current); meMarkerRef.current = null; }
      if (meAccuracyRef.current) { map.removeLayer(meAccuracyRef.current); meAccuracyRef.current = null; }
      didCenterOnMeRef.current = false;
    };
  }, [showLocation]);

  const centerOnMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if (meMarkerRef.current) {
      map.setView(meMarkerRef.current.getLatLng(), 17);
      return;
    }
    if (!('geolocation' in navigator)) {
      toast.error('Geolocalização não suportada');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 17),
      () => toast.error('Não foi possível obter sua localização'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleDelete = async (c: Camada) => {
    if (!confirm(`Excluir a camada "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from('mapa_camadas').delete().eq('id', c.id);
      if (error) throw error;
      // Remove o arquivo do storage (best-effort, não bloqueia caso falhe)
      await supabase.storage.from('mapa-kmz').remove([c.storage_path]).catch(() => {});

      // Remove imediatamente o layer do mapa
      const map = mapRef.current;
      const cached = kmzLayersRef.current.get(c.id);
      if (cached && map && map.hasLayer(cached)) map.removeLayer(cached);
      kmzLayersRef.current.delete(c.id);
      kmzBoundsRef.current.delete(c.id);
      kmzSigRef.current.delete(c.id);

      // Atualiza estado local (lista + visibilidade) sem esperar realtime
      setCamadas((prev) => prev.filter((x) => x.id !== c.id));
      setVisivel((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });

      toast.success('Camada excluída');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao excluir');
    }
  };

  const persistVisibility = useCallback((state: Record<string, boolean>, layers = camadas) => {
    const out: Record<string, boolean> = {
      ...visStorageRef.current,
      'As-built Rede': state.__rede !== false,
      'As-built Ligações': state.__ligacoes !== false,
    };
    for (const c of layers) {
      out[c.nome] = state[c.id] !== false;
    }
    for (const g of groups) {
      const groupLayers = layers.filter((c) => c.group_id === g.id);
      if (groupLayers.length > 0) out[g.name] = groupLayers.some((c) => state[c.id] !== false);
    }
    try {
      localStorage.setItem(VIS_STORAGE_KEY, JSON.stringify(out));
      visStorageRef.current = out;
    } catch { /* quota / privacy mode */ }
  }, [camadas, groups]);

  const toggleVis = (id: string) => setVisivel((v) => {
    const next = { ...v, [id]: !v[id] };
    visivelRef.current = next;
    persistVisibility(next);
    return next;
  });

  // Persistir visibilidade no localStorage por NOME da camada
  useEffect(() => {
    visivelRef.current = visivel;
    persistVisibility(visivel);
  }, [visivel, persistVisibility]);

  const focusCamada = (id: string) => {
    const map = mapRef.current;
    const b = kmzBoundsRef.current.get(id);
    if (map && b && b.isValid()) {
      map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
      setLayersOpen(false);
    }
  };

  // ===== Group helpers =====
  const handleCreateGroup = async () => {
    const name = window.prompt('Nome do novo grupo:')?.trim();
    if (!name) return;
    const ordem = groups.length;
    const { data, error } = await supabase
      .from('kmz_layer_groups')
      .insert({ name, ordem })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) setGroups((prev) => [...prev, data as LayerGroup]);
    toast.success('Grupo criado');
  };

  const handleRenameGroup = async (g: LayerGroup) => {
    const name = window.prompt('Renomear grupo:', g.name)?.trim();
    if (!name || name === g.name) return;
    const { error } = await supabase
      .from('kmz_layer_groups')
      .update({ name })
      .eq('id', g.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, name } : x)));
  };

  const handleDeleteGroup = async (g: LayerGroup) => {
    if (!confirm(`Excluir o grupo "${g.name}"? As camadas dele serão movidas para "Sem grupo" (não serão deletadas).`)) return;
    const { error } = await supabase.from('kmz_layer_groups').delete().eq('id', g.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setGroups((prev) => prev.filter((x) => x.id !== g.id));
    setCamadas((prev) => prev.map((c) => (c.group_id === g.id ? { ...c, group_id: null } : c)));
    toast.success('Grupo excluído');
  };

  const moveCamadaToGroup = async (camadaId: string, groupId: string | null) => {
    const { error } = await supabase
      .from('mapa_camadas')
      .update({ group_id: groupId })
      .eq('id', camadaId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCamadas((prev) => prev.map((c) => (c.id === camadaId ? { ...c, group_id: groupId } : c)));
  };

  const toggleGroupCollapsed = (gid: string) =>
    setCollapsedGroups((s) => ({ ...s, [gid]: !s[gid] }));

  // 3-state group toggle
  const getGroupVisState = (camadasOfGroup: Camada[]): 'all' | 'none' | 'partial' => {
    if (camadasOfGroup.length === 0) return 'none';
    const visCount = camadasOfGroup.filter((c) => visivel[c.id] !== false).length;
    if (visCount === camadasOfGroup.length) return 'all';
    if (visCount === 0) return 'none';
    return 'partial';
  };

  const toggleGroupVis = (camadasOfGroup: Camada[]) => {
    const state = getGroupVisState(camadasOfGroup);
    const target = state === 'all' ? false : true;
    setVisivel((v) => {
      const next = { ...v };
      for (const c of camadasOfGroup) next[c.id] = target;
      visivelRef.current = next;
      persistVisibility(next);
      return next;
    });
  };

  // ===== Exportar KMZ as-built (rede + ligações com ExtendedData) =====
  const exportKmz = async () => {
    try {
      const esc = (s: any) =>
        String(s ?? '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const ext = (data: Record<string, any>) => {
        const rows = Object.entries(data)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `      <Data name="${esc(k)}"><value>${esc(v)}</value></Data>`)
          .join('\n');
        return rows ? `    <ExtendedData>\n${rows}\n    </ExtendedData>` : '';
      };

      // Agrupar rede por OS para gerar LineStrings + Points
      const grupos = new Map<string, RedePoint[]>();
      redePoints.forEach((p) => {
        const arr = grupos.get(p.os_id) ?? [];
        arr.push(p); grupos.set(p.os_id, arr);
      });

      const placemarks: string[] = [];

      grupos.forEach((pts) => {
        if (pts.length === 0) return;
        const first = pts[0];
        if (pts.length >= 2) {
          const coords = pts.map((p) => `${p.longitude},${p.latitude},0`).join(' ');
          placemarks.push(`  <Placemark>
    <name>REDE — ${esc(first.trecho)}</name>
${ext({
  tipo: 'REDE',
  trecho: first.trecho,
  bacia: first.bacia,
  pv_montante: first.pv_montante,
  pv_jusante: first.pv_jusante,
  comprimento_executado: first.comprimento_real ?? first.comprimento_previsto,
  status: first.status,
})}
    <LineString><coordinates>${coords}</coordinates></LineString>
  </Placemark>`);
        }
        pts.forEach((p, idx) => {
          placemarks.push(`  <Placemark>
    <name>${esc(p.nome_estaca || `Ponto ${idx + 1}`)} — ${esc(first.trecho)}</name>
${ext({
  tipo: 'VERTICE',
  trecho: first.trecho,
  bacia: first.bacia,
  nome_estaca: p.nome_estaca,
  encarregado: p.encarregado,
  profundidade: p.profundidade,
  ns_relacionada: p.ns_relacionada,
  status: first.status,
})}
    <Point><coordinates>${p.longitude},${p.latitude},0</coordinates></Point>
  </Placemark>`);
        });
      });

      ligacoesPoints.forEach((m) => {
        placemarks.push(`  <Placemark>
    <name>Ligação ${m.numero} — ${esc(m.trecho)}</name>
${ext({
  tipo: 'LIGACAO',
  trecho: m.trecho,
  numero: m.numero,
  referencia: m.referencia,
})}
    <Point><coordinates>${m.longitude},${m.latitude},0</coordinates></Point>
  </Placemark>`);
      });

      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>SaneGest As-built</name>
${placemarks.join('\n')}
</Document>
</kml>`;

      const zip = new JSZip();
      zip.file('doc.kml', kml);
      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanegest-asbuilt-${new Date().toISOString().slice(0, 10)}.kmz`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success('KMZ exportado');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao exportar KMZ');
    }
  };

  return (
    <div className={`relative ${className}`} style={{ height, minHeight: 300 }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: 300, borderRadius: '0.75rem', overflow: 'hidden' }} />


      {/* Controle flutuante: camadas + minha localização */}
      <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
        {/* Removido: Exportar/Inserir KMZ — agora dentro do painel de Camadas */}
        {showLocation && (
          <button
            onClick={centerOnMe}
            className="bg-card hover:bg-accent border border-border shadow-md rounded-md p-2 transition-colors"
            title="Minha localização"
            aria-label="Minha localização"
          >
            <Crosshair size={18} className="text-foreground" />
          </button>
        )}
        <Popover open={layersOpen} onOpenChange={setLayersOpen}>
          <PopoverTrigger asChild>
            <button
              className="bg-card hover:bg-accent border border-border shadow-md rounded-md p-2 transition-colors"
              title="Camadas"
              aria-label="Camadas"
            >
              <Layers size={18} className="text-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={6}
            collisionPadding={12}
            avoidCollisions
            className="w-[min(18rem,calc(100vw-1.5rem))] p-3 max-h-[70vh] overflow-y-auto z-[1000]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Layers size={14} /> Camadas
              </div>
            </div>

            {/* As-built */}
            <div className="space-y-1 mb-3">
              <div className="group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent text-sm">
                <button
                  onClick={() => toggleVis('__rede')}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {visivel.__rede ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                  <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: redeColor }} />
                  <span className="flex-1 truncate">As-built Rede</span>
                  <span className="text-xs text-muted-foreground">{redePoints.length}</span>
                </button>
                {canManage && (
                  <button
                    onClick={() => { setEditAsBuilt('rede'); setLayersOpen(false); }}
                    className="p-1 rounded hover:bg-background opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Editar"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
              <div className="group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent text-sm">
                <button
                  onClick={() => toggleVis('__ligacoes')}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {visivel.__ligacoes ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                  <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: ligacoesColor }} />
                  <span className="flex-1 truncate">As-built Ligações</span>
                  <span className="text-xs text-muted-foreground">{ligacoesPoints.length}</span>
                </button>
                {canManage && (
                  <button
                    onClick={() => { setEditAsBuilt('ligacoes'); setLayersOpen(false); }}
                    className="p-1 rounded hover:bg-background opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Editar"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mb-1.5 px-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">KMZ</div>
              {canManage && (
                <button
                  onClick={handleCreateGroup}
                  className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  title="Novo grupo"
                >
                  <FolderPlus size={12} /> Novo grupo
                </button>
              )}
            </div>
            {camadas.length === 0 && groups.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma camada KMZ</p>
            )}

            {/* Render layer item helper */}
            {(() => {
              const renderCamada = (c: Camada) => (
                <div key={c.id} className="group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent text-sm">
                  <button onClick={() => toggleVis(c.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    {visivel[c.id] !== false
                      ? <Eye size={14} />
                      : <EyeOff size={14} className="text-muted-foreground" />}
                    <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c.cor }} />
                    <span
                      className="truncate"
                      title={c.nome}
                      onDoubleClick={() => focusCamada(c.id)}
                    >{c.nome}</span>
                  </button>
                  {canManage && (
                    <div className="flex items-center opacity-60 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-background" title="Mover para grupo">
                            <MoreVertical size={12} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[1100]">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <FolderOpen size={12} className="mr-2" /> Mover para
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="z-[1100]">
                              {groups.length === 0 && (
                                <DropdownMenuItem disabled>Nenhum grupo</DropdownMenuItem>
                              )}
                              {groups.map((g) => (
                                <DropdownMenuItem
                                  key={g.id}
                                  disabled={c.group_id === g.id}
                                  onClick={() => moveCamadaToGroup(c.id, g.id)}
                                >
                                  {g.name}
                                </DropdownMenuItem>
                              ))}
                              {c.group_id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => moveCamadaToGroup(c.id, null)}>
                                    Remover do grupo
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button
                        onClick={() => { setEditing(c); setModalOpen(true); setLayersOpen(false); }}
                        className="p-1 rounded hover:bg-background"
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="p-1 rounded hover:bg-background text-destructive"
                        title="Excluir"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );

              const camadasByGroup = new Map<string, Camada[]>();
              const ungrouped: Camada[] = [];
              for (const c of camadas) {
                if (c.group_id) {
                  const arr = camadasByGroup.get(c.group_id) ?? [];
                  arr.push(c);
                  camadasByGroup.set(c.group_id, arr);
                } else {
                  ungrouped.push(c);
                }
              }

              return (
                <div className="space-y-2">
                  {groups.map((g) => {
                    const items = camadasByGroup.get(g.id) ?? [];
                    const state = getGroupVisState(items);
                    const collapsed = collapsedGroups[g.id];
                    return (
                      <div key={g.id} className="rounded border border-border/60">
                        <div className="flex items-center gap-1 px-1.5 py-1 bg-muted/40 rounded-t">
                          <button
                            onClick={() => toggleGroupCollapsed(g.id)}
                            className="p-0.5 rounded hover:bg-background"
                            title={collapsed ? 'Expandir' : 'Recolher'}
                          >
                            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button
                            onClick={() => toggleGroupVis(items)}
                            className="p-0.5 rounded hover:bg-background"
                            title="Visibilidade do grupo"
                          >
                            {state === 'all' && <Eye size={14} />}
                            {state === 'none' && <EyeOff size={14} className="text-muted-foreground" />}
                            {state === 'partial' && <Eye size={14} className="text-amber-500" />}
                          </button>
                          <span className="flex-1 text-xs font-semibold truncate" title={g.name}>{g.name}</span>
                          <span className="text-[10px] text-muted-foreground">{items.length}</span>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-0.5 rounded hover:bg-background opacity-60 hover:opacity-100" title="Opções">
                                  <MoreVertical size={12} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[1100]">
                                <DropdownMenuItem onClick={() => handleRenameGroup(g)}>
                                  <Pencil size={12} className="mr-2" /> Renomear
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteGroup(g)} className="text-destructive">
                                  <Trash2 size={12} className="mr-2" /> Excluir grupo
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {!collapsed && (
                          <div className="space-y-0.5 p-1">
                            {items.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground px-2 py-1">Vazio</p>
                            ) : items.map(renderCamada)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {ungrouped.length > 0 && (
                    <div className="rounded border border-border/60">
                      <div className="flex items-center gap-1 px-1.5 py-1 bg-muted/40 rounded-t">
                        <button
                          onClick={() => toggleGroupCollapsed('__nogroup')}
                          className="p-0.5 rounded hover:bg-background"
                          title={collapsedGroups['__nogroup'] ? 'Expandir' : 'Recolher'}
                        >
                          {collapsedGroups['__nogroup'] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <span className="flex-1 text-xs font-semibold truncate">Sem grupo</span>
                        <span className="text-[10px] text-muted-foreground">{ungrouped.length}</span>
                      </div>
                      {!collapsedGroups['__nogroup'] && (
                        <div className="space-y-0.5 p-1">
                          {ungrouped.map(renderCamada)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Bottom: discrete actions */}
            {canManage && (
              <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => { setEditing(null); setModalOpen(true); setLayersOpen(false); }}
                  className="inline-flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
                  style={{ color: '#6b8aaa' }}
                  title="Inserir KMZ"
                >
                  <Upload size={12} /> Inserir KMZ
                </button>
                <button
                  onClick={() => { exportKmz(); }}
                  className="inline-flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
                  style={{ color: '#6b8aaa' }}
                  title="Exportar KMZ"
                >
                  <Download size={12} /> Exportar
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {!loading && redePoints.length === 0 && ligacoesPoints.length === 0 && camadas.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border text-sm text-muted-foreground">
            Nenhum dado ainda. {canManage && 'Adicione uma camada KMZ para começar.'}
          </div>
        </div>
      )}

      <CamadaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        camada={editing}
        onSaved={fetchCamadas}
      />

      <AsBuiltConfigModal
        open={editAsBuilt !== null}
        onOpenChange={(v) => { if (!v) setEditAsBuilt(null); }}
        layerKey={editAsBuilt ?? 'rede'}
        title={editAsBuilt === 'ligacoes' ? 'As-built Ligações' : 'As-built Rede'}
        initialCor={editAsBuilt === 'ligacoes' ? ligacoesColor : redeColor}
        initialOpacidade={editAsBuilt === 'ligacoes' ? ligacoesOpacidade : redeOpacidade}
        onSaved={fetchAsBuiltConfig}
      />
    </div>
  );
};
