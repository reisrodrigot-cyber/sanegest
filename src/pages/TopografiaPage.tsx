import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, MapPin, Plus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AsBuiltPoint {
  id: string;
  os_id: string;
  nome_estaca: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

const DEFAULT_CENTER: [number, number] = [-9.1167, -35.2667];

const MiniMap = ({ points }: { points: AsBuiltPoint[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(DEFAULT_CENTER, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
    }).addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const valid = points.filter(p => p.latitude != null && p.longitude != null);
    if (valid.length === 0) {
      map.setView(DEFAULT_CENTER, 14);
      return;
    }

    const bounds = L.latLngBounds(valid.map(p => [p.latitude!, p.longitude!]));
    valid.forEach(p => {
      const circle = L.circleMarker([p.latitude!, p.longitude!], {
        radius: 8, fillColor: '#16a34a', color: '#16a34a', weight: 2, opacity: 1, fillOpacity: 0.7,
      }).addTo(map);
      circle.bindPopup(`<b>${p.nome_estaca || 'Sem nome'}</b>`);
      markersRef.current.push(circle);
    });
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
  }, [points]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
};

const OSEstacaPanel = ({ os, onConclude }: { os: any; onConclude: () => void }) => {
  const [points, setPoints] = useState<AsBuiltPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [nome, setNome] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const fetchPoints = useCallback(async () => {
    const { data } = await supabase
      .from('topografia_asbuilt')
      .select('id, os_id, nome_estaca, latitude, longitude, created_at')
      .eq('os_id', os.id)
      .order('created_at', { ascending: true });
    setPoints((data as AsBuiltPoint[]) ?? []);
    setLoading(false);
  }, [os.id]);

  useEffect(() => {
    fetchPoints();
    const channel = supabase
      .channel(`topo-${os.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topografia_asbuilt', filter: `os_id=eq.${os.id}` }, () => fetchPoints())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [os.id, fetchPoints]);

  const handleAdd = async () => {
    const latVal = parseFloat(lat);
    const lngVal = parseFloat(lng);
    if (isNaN(latVal) || isNaN(lngVal)) {
      toast.error('Latitude e Longitude são obrigatórios.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('topografia_asbuilt').insert({
      os_id: os.id,
      nome_estaca: nome.trim() || null,
      latitude: latVal,
      longitude: lngVal,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar estaca.'); return; }
    toast.success('Estaca registrada!');
    setNome(''); setLat(''); setLng('');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('topografia_asbuilt').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir.');
  };

  const handleConclude = async () => {
    if (points.length === 0) return;
    setConcluding(true);
    const { error } = await supabase.from('ordens_servico').update({ status: 'VERDE' }).eq('id', os.id);
    setConcluding(false);
    if (error) { toast.error('Erro ao concluir OS.'); return; }
    toast.success('OS concluída — status Verde!');
    onConclude();
  };

  const isConcluded = os.status === 'VERDE';

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: list + form */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin size={16} /> Estacas Registradas ({points.length})
          </h3>

          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
          ) : (
            <>
              {points.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {points.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-foreground">{p.nome_estaca || '(sem nome)'}</span>
                        <span className="text-muted-foreground ml-2">
                          {p.latitude?.toFixed(6)}, {p.longitude?.toFixed(6)}
                        </span>
                      </div>
                      {!isConcluded && (
                        <button onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive/80 p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isConcluded && (
                <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova Estaca</p>
                  <Input placeholder="Nome (ex: PV-01, Estaca 1)" value={nome} onChange={e => setNome(e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Latitude *" type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} />
                    <Input placeholder="Longitude *" type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} />
                  </div>
                  <Button onClick={handleAdd} disabled={saving} size="sm" className="w-full">
                    {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus size={14} className="mr-1" />}
                    Adicionar Estaca
                  </Button>
                </div>
              )}

              {!isConcluded && points.length > 0 && (
                <Button onClick={handleConclude} disabled={concluding} variant="default" className="w-full bg-status-green hover:bg-status-green/90 text-white">
                  {concluding ? <Loader2 className="animate-spin mr-2" size={14} /> : <CheckCircle2 size={14} className="mr-1" />}
                  Concluir OS (Status → Verde)
                </Button>
              )}

              {isConcluded && (
                <p className="text-sm text-status-green font-medium flex items-center gap-1">
                  <CheckCircle2 size={14} /> OS concluída
                </p>
              )}
            </>
          )}
        </div>

        {/* Right: mini map */}
        <div className="rounded-xl border border-border overflow-hidden" style={{ minHeight: 300 }}>
          <MiniMap points={points} />
        </div>
      </div>
    </div>
  );
};

const TopografiaPage = () => {
  const { ordens, loading, refetch } = useOrdensServico();
  const eligible = ordens.filter(os => os.status === 'AMARELO' || os.status === 'VERDE');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Registro Topográfico</h1>
      <p className="text-sm text-muted-foreground mb-6">Registre as estacas as-built para cada OS</p>

      <div className="space-y-3">
        {eligible.map(os => (
          <div key={os.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{os.trecho}</p>
                <p className="text-xs text-muted-foreground">{os.bacia} • {os.comprimento_real ?? os.comprimento_previsto}m</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={os.status} size="sm" />
                <button
                  onClick={() => setExpandedId(expandedId === os.id ? null : os.id)}
                  className="text-sm text-secondary hover:underline"
                >
                  {expandedId === os.id ? 'Fechar' : 'Registrar Estacas'}
                </button>
              </div>
            </div>
            {expandedId === os.id && <OSEstacaPanel os={os} onConclude={() => refetch()} />}
          </div>
        ))}
        {eligible.length === 0 && (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            Nenhuma OS disponível para registro topográfico.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TopografiaPage;
