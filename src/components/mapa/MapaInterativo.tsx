import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
// @ts-ignore - leaflet-kmz não tem tipos
import 'leaflet-kmz';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { permissions } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { MapPin, Plus, Pencil, Trash2, Layers, Eye, EyeOff } from 'lucide-react';
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

const REDE_COLOR = '#16a34a'; // verde
const LIGACAO_COLOR = '#2563eb'; // azul
const DEFAULT_CENTER: [number, number] = [-9.1167, -35.2667];
const DEFAULT_ZOOM = 13;

export const MapaInterativo = () => {
  const { effectiveRole } = useAuth();
  const canManage = permissions.canEditOS(effectiveRole); // sala_tecnica/admin

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const redeLayerRef = useRef<L.LayerGroup | null>(null);
  const ligacoesLayerRef = useRef<L.LayerGroup | null>(null);
  const kmzLayersRef = useRef<Map<string, L.Layer>>(new Map());

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

  // Init mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
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
      .select('id, os_id, latitude, longitude, nome_estaca')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (!ab || ab.length === 0) {
      setRedePoints([]);
    } else {
      const osIds = [...new Set(ab.map(r => r.os_id))];
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select('id, trecho, bacia, status')
        .in('id', osIds);
      const osMap = new Map((osData ?? []).map(o => [o.id, o]));
      const result: RedePoint[] = [];
      for (const r of ab) {
        const os = osMap.get(r.os_id);
        if (os && r.latitude != null && r.longitude != null) {
          result.push({
            id: r.id, os_id: r.os_id, trecho: os.trecho, bacia: os.bacia,
            status: os.status, latitude: Number(r.latitude), longitude: Number(r.longitude),
            nome_estaca: r.nome_estaca,
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
    // numerar sequencialmente por OS conforme ordem de criação
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
    const layer = redeLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (!visivel.__rede) return;
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
    const layer = ligacoesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!visivel.__ligacoes) return;
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

  // Auto-fit quando há dados
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const all = [
      ...redePoints.map(r => [r.latitude, r.longitude] as [number, number]),
      ...ligacoesPoints.map(r => [r.latitude, r.longitude] as [number, number]),
    ];
    if (all.length === 0) { map.setView(DEFAULT_CENTER, DEFAULT_ZOOM); return; }
    const bounds = L.latLngBounds(all);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [redePoints.length, ligacoesPoints.length]);

  // ======= Render KMZ camadas =======
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remover camadas que não existem mais
    const currentIds = new Set(camadas.map(c => c.id));
    for (const [id, layer] of kmzLayersRef.current.entries()) {
      if (!currentIds.has(id)) {
        map.removeLayer(layer);
        kmzLayersRef.current.delete(id);
      }
    }

    // Adicionar/atualizar
    camadas.forEach(async (c) => {
      const existing = kmzLayersRef.current.get(c.id);
      const shouldShow = visivel[c.id] !== false;

      // Sempre recriar para refletir mudanças de cor/opacidade
      if (existing) {
        map.removeLayer(existing);
        kmzLayersRef.current.delete(c.id);
      }
      if (!shouldShow) return;

      try {
        const { data: signed } = await supabase.storage
          .from('mapa-kmz')
          .createSignedUrl(c.storage_path, 3600);
        if (!signed?.signedUrl) return;

        // @ts-ignore
        const kmzLayer = L.kmzLayer({ ext: 'kmz' });
        kmzLayer.on('load', (e: any) => {
          const layer = e.layer || e.target;
          // aplicar cor + opacidade
          const applyStyle = (ly: any) => {
            if (ly.setStyle) {
              ly.setStyle({
                color: c.cor,
                fillColor: c.cor,
                opacity: c.opacidade,
                fillOpacity: c.opacidade * 0.5,
                weight: 2,
              });
            }
            if (ly.eachLayer) ly.eachLayer(applyStyle);
          };
          applyStyle(layer);
        });
        kmzLayer.load(signed.signedUrl);
        kmzLayer.addTo(map);
        kmzLayersRef.current.set(c.id, kmzLayer);
      } catch (err) {
        console.error('Erro carregando KMZ', c.nome, err);
      }
    });
  }, [camadas, visivel]);

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

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
      <div className="p-4 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Mapa Interativo</h2>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={16} className="mr-1" /> Adicionar Camada
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px]">
        <div className="relative" style={{ height: 480 }}>
          <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
          {!loading && redePoints.length === 0 && ligacoesPoints.length === 0 && camadas.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
              <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-border text-sm text-muted-foreground">
                Nenhum dado ainda. {canManage && 'Adicione uma camada KMZ para começar.'}
              </div>
            </div>
          )}
        </div>

        {/* Painel de camadas */}
        <div className="border-t md:border-t-0 md:border-l border-border p-3 bg-muted/30 max-h-[480px] overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-3 text-sm font-semibold text-foreground">
            <Layers size={14} /> Camadas
          </div>

          {/* As-built */}
          <div className="space-y-1 mb-4">
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
                  <span className="truncate" title={c.nome}>{c.nome}</span>
                </button>
                {canManage && (
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditing(c); setModalOpen(true); }}
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
        </div>
      </div>

      <CamadaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        camada={editing}
        onSaved={fetchCamadas}
      />
    </div>
  );
};
