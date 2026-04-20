import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import JSZip from 'jszip';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { permissions } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MapPin, Plus, Pencil, Trash2, Layers, Eye, EyeOff, Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import { CamadaModal } from './CamadaModal';
import 'leaflet/dist/leaflet.css';

interface Camada {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  opacidade: number;
  storage_path: string;
  arquivo_nome: string;
  visivel_default: boolean;
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

const REDE_COLOR = '#16a34a';
const LIGACAO_COLOR = '#2563eb';
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
}

export const MapaInterativo = ({ showLocation = false }: MapaInterativoProps) => {
  const { effectiveRole } = useAuth();
  const canManage = permissions.canEditOS(effectiveRole);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const redeLayerRef = useRef<L.LayerGroup | null>(null);
  const ligacoesLayerRef = useRef<L.LayerGroup | null>(null);
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
  const [redePoints, setRedePoints] = useState<RedePoint[]>([]);
  const [ligacoesPoints, setLigacoesPoints] = useState<LigacaoPoint[]>([]);
  const [visivel, setVisivel] = useState<Record<string, boolean>>({
    __rede: true,
    __ligacoes: true,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Camada | null>(null);
  const [loading, setLoading] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);

  // Init mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { preferCanvas: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    redeLayerRef.current = L.layerGroup().addTo(map);
    ligacoesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ======= Fetch dados =======
  const fetchCamadas = async () => {
    const { data } = await supabase
      .from('mapa_camadas')
      .select('*')
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });
    if (data) {
      setCamadas(data as Camada[]);
      setVisivel((prev) => {
        const next = { ...prev };
        for (const c of data) if (next[c.id] === undefined) next[c.id] = c.visivel_default;
        return next;
      });
    }
  };

  const fetchAsBuilt = async () => {
    const { data: ab } = await supabase
      .from('topografia_asbuilt')
      .select('id, os_id, latitude, longitude, nome_estaca, created_at')
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
    Promise.all([fetchCamadas(), fetchAsBuilt(), fetchLigacoes()]).finally(() => setLoading(false));

    const ch = supabase
      .channel('mapa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topografia_asbuilt' }, fetchAsBuilt)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ligacoes' }, fetchLigacoes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_camadas' }, fetchCamadas)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ======= Render rede =======
  useEffect(() => {
    const map = mapRef.current;
    const layer = redeLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!visivel.__rede) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      return;
    }
    if (!map.hasLayer(layer)) layer.addTo(map);
    redePoints.forEach((m) => {
      const circle = L.circleMarker([m.latitude, m.longitude], {
        radius: 7, fillColor: REDE_COLOR, color: REDE_COLOR,
        weight: 2, opacity: 1, fillOpacity: 0.85,
      });
      circle.bindPopup(`
        <div style="min-width:160px;font-size:13px;">
          <p style="font-weight:700;margin:0 0 4px">${m.trecho}</p>
          <p style="margin:2px 0;color:${REDE_COLOR};font-weight:600">REDE — As-built</p>
          ${m.nome_estaca ? `<p style="margin:2px 0">Estaca: ${m.nome_estaca}</p>` : ''}
          <p style="margin:2px 0">Bacia: ${m.bacia}</p>
          <p style="margin:2px 0">Status: <span style="color:${STATUS_COLORS[m.status]};font-weight:600">${m.status}</span></p>
        </div>`);
      circle.addTo(layer);
    });
  }, [redePoints, visivel.__rede]);

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
    ligacoesPoints.forEach((m) => {
      const square = L.circleMarker([m.latitude, m.longitude], {
        radius: 6, fillColor: LIGACAO_COLOR, color: '#ffffff',
        weight: 2, opacity: 1, fillOpacity: 0.9,
      });
      square.bindPopup(`
        <div style="min-width:160px;font-size:13px;">
          <p style="font-weight:700;margin:0 0 4px;color:${LIGACAO_COLOR}">Ligação ${m.numero}</p>
          <p style="margin:2px 0">NS: ${m.trecho}</p>
          ${m.referencia ? `<p style="margin:2px 0">Ref: ${m.referencia}</p>` : ''}
        </div>`);
      square.addTo(layer);
    });
  }, [ligacoesPoints, visivel.__ligacoes]);

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
      const shouldShow = visivel[c.id] !== false;
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
        if (visivel[c.id] === false) return;

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
      await supabase.storage.from('mapa-kmz').remove([c.storage_path]);
      const { error } = await supabase.from('mapa_camadas').delete().eq('id', c.id);
      if (error) throw error;
      toast.success('Camada excluída');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao excluir');
    }
  };

  const toggleVis = (id: string) => setVisivel((v) => ({ ...v, [id]: !v[id] }));

  const focusCamada = (id: string) => {
    const map = mapRef.current;
    const b = kmzBoundsRef.current.get(id);
    if (map && b && b.isValid()) {
      map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
      setLayersOpen(false);
    }
  };

  return (
    <div className="relative mb-6" style={{ height: 520 }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }} />

      {/* Controle flutuante: camadas + minha localização */}
      <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
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
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => { setEditing(null); setModalOpen(true); setLayersOpen(false); }}
                >
                  <Plus size={14} className="mr-1" /> Adicionar
                </Button>
              )}
            </div>

            {/* As-built */}
            <div className="space-y-1 mb-3">
              <button
                onClick={() => toggleVis('__rede')}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left text-sm"
              >
                {visivel.__rede ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: REDE_COLOR }} />
                <span className="flex-1">As-built Rede</span>
                <span className="text-xs text-muted-foreground">{redePoints.length}</span>
              </button>
              <button
                onClick={() => toggleVis('__ligacoes')}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left text-sm"
              >
                {visivel.__ligacoes ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: LIGACAO_COLOR }} />
                <span className="flex-1">As-built Ligações</span>
                <span className="text-xs text-muted-foreground">{ligacoesPoints.length}</span>
              </button>
            </div>

            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 px-2">KMZ</div>
            {camadas.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">Nenhuma camada KMZ</p>
            )}
            <div className="space-y-1">
              {camadas.map((c) => (
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
                    <div className="flex opacity-60 group-hover:opacity-100 transition-opacity">
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
              ))}
            </div>
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
    </div>
  );
};
