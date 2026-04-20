import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, MapPin, Plus, CheckCircle2, Pencil, X, Check, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LigacoesPanel } from '@/components/topografia/LigacoesPanel';
import { OSDetalhesTrecho } from '@/components/OSDetalhesTrecho';

interface AsBuiltPoint {
  id: string;
  os_id: string;
  nome_estaca: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  registrado_por: string | null;
}

const DEFAULT_CENTER: [number, number] = [-9.1167, -35.2667];
const REDE_COLOR = '#16a34a';

const MiniMap = ({ points }: { points: AsBuiltPoint[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(DEFAULT_CENTER, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
    }).addTo(mapRef.current);
    layerRef.current = L.layerGroup().addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const valid = points.filter(p => p.latitude != null && p.longitude != null);
    if (valid.length === 0) {
      map.setView(DEFAULT_CENTER, 14);
      return;
    }

    const latlngs: [number, number][] = valid.map(p => [p.latitude!, p.longitude!]);

    // Polyline conectando os pontos na ordem
    if (latlngs.length >= 2) {
      L.polyline(latlngs, {
        color: REDE_COLOR, weight: 4, opacity: 0.85,
      }).addTo(layer);
    }

    // Marcadores nos vértices
    valid.forEach((p, idx) => {
      const circle = L.circleMarker([p.latitude!, p.longitude!], {
        radius: 6, fillColor: REDE_COLOR, color: '#ffffff', weight: 2, opacity: 1, fillOpacity: 1,
      });
      circle.bindPopup(`<b>${p.nome_estaca || `Ponto ${idx + 1}`}</b>`);
      circle.addTo(layer);
    });

    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
  }, [points]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
};

const OSEstacaPanel = ({ os, onConclude, allowEditAll }: { os: any; onConclude: () => void; allowEditAll?: boolean }) => {
  const { user } = useAuth();
  const [points, setPoints] = useState<AsBuiltPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [ligacoesTotal, setLigacoesTotal] = useState(0);
  const [ligacoesPendentes, setLigacoesPendentes] = useState(0);
  const [reordering, setReordering] = useState(false);

  const fetchPoints = useCallback(async () => {
    const { data } = await supabase
      .from('topografia_asbuilt')
      .select('id, os_id, nome_estaca, latitude, longitude, created_at, registrado_por')
      .eq('os_id', os.id)
      .order('created_at', { ascending: true });
    setPoints((data as AsBuiltPoint[]) ?? []);
    setLoading(false);
  }, [os.id]);

  const fetchLigacoesStatus = useCallback(async () => {
    const { data } = await supabase
      .from('ligacoes')
      .select('id, latitude')
      .eq('os_id', os.id);
    const rows = data ?? [];
    setLigacoesTotal(rows.length);
    setLigacoesPendentes(rows.filter((r) => r.latitude == null).length);
  }, [os.id]);

  useEffect(() => {
    fetchPoints();
    fetchLigacoesStatus();
    const channel = supabase
      .channel(`topo-${os.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topografia_asbuilt', filter: `os_id=eq.${os.id}` }, () => fetchPoints())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ligacoes', filter: `os_id=eq.${os.id}` }, () => fetchLigacoesStatus())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [os.id, fetchPoints, fetchLigacoesStatus]);

  const handleAdd = async () => {
    const latVal = parseFloat(lat);
    const lngVal = parseFloat(lng);
    if (isNaN(latVal) || isNaN(lngVal)) {
      toast.error('Latitude e Longitude são obrigatórios.');
      return;
    }
    setSaving(true);
    const nextNumber = points.length + 1;
    const { error } = await supabase.from('topografia_asbuilt').insert({
      os_id: os.id,
      nome_estaca: `Ponto ${nextNumber}`,
      latitude: latVal,
      longitude: lngVal,
      registrado_por: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao salvar coordenada.'); return; }
    toast.success(`Ponto ${nextNumber} registrado!`);
    setLat(''); setLng('');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('topografia_asbuilt').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir.');
  };

  const startEdit = (p: AsBuiltPoint) => {
    setEditingId(p.id);
    setEditLat(p.latitude?.toString() ?? '');
    setEditLng(p.longitude?.toString() ?? '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    const latVal = parseFloat(editLat);
    const lngVal = parseFloat(editLng);
    if (isNaN(latVal) || isNaN(lngVal)) {
      toast.error('Latitude e Longitude são obrigatórios.');
      return;
    }
    const { error } = await supabase.from('topografia_asbuilt').update({
      latitude: latVal,
      longitude: lngVal,
    }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    toast.success('Coordenada atualizada!');
    setEditingId(null);
  };

  // Reordenar: troca o created_at entre dois pontos para refletir nova ordem
  const swapPoints = async (idxA: number, idxB: number) => {
    if (idxA < 0 || idxB < 0 || idxA >= points.length || idxB >= points.length) return;
    const a = points[idxA];
    const b = points[idxB];
    setReordering(true);
    // Troca created_at entre os dois para inverter a ordem
    const tempStamp = new Date(new Date(a.created_at).getTime() + 1).toISOString();
    const [r1, r2] = await Promise.all([
      supabase.from('topografia_asbuilt').update({ created_at: b.created_at, nome_estaca: `Ponto ${idxB + 1}` }).eq('id', a.id),
      supabase.from('topografia_asbuilt').update({ created_at: tempStamp, nome_estaca: `Ponto ${idxA + 1}` }).eq('id', b.id),
    ]);
    // Renomeia o segundo de fato
    await supabase.from('topografia_asbuilt').update({ created_at: a.created_at }).eq('id', b.id);
    setReordering(false);
    if (r1.error || r2.error) {
      toast.error('Erro ao reordenar.');
      return;
    }
    fetchPoints();
  };

  // Renumera todos os nomes após qualquer mudança de ordem ou exclusão
  useEffect(() => {
    if (points.length === 0) return;
    const needsRename = points.some((p, idx) => p.nome_estaca !== `Ponto ${idx + 1}`);
    if (!needsRename) return;
    (async () => {
      await Promise.all(
        points.map((p, idx) =>
          p.nome_estaca === `Ponto ${idx + 1}`
            ? Promise.resolve()
            : supabase.from('topografia_asbuilt').update({ nome_estaca: `Ponto ${idx + 1}` }).eq('id', p.id)
        )
      );
    })();
  }, [points]);

  const estacasSemCoord = points.filter((p) => p.latitude == null || p.longitude == null).length;
  const podeConcluir = points.length > 0 && estacasSemCoord === 0 && ligacoesPendentes === 0;

  const handleConclude = async () => {
    if (!podeConcluir) return;
    setConcluding(true);
    const { error } = await supabase.from('ordens_servico').update({ status: 'VERDE' }).eq('id', os.id);
    setConcluding(false);
    if (error) { toast.error('Erro ao concluir OS.'); return; }
    toast.success('OS concluída — status Verde!');
    onConclude();
  };

  const isConcluded = os.status === 'VERDE';
  const canAdd = allowEditAll || !isConcluded;
  const canEditPoint = (_p: AsBuiltPoint) => {
    if (allowEditAll) return true;
    if (isConcluded) return false;
    return true;
  };

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Dados do Trecho</h3>
        <OSDetalhesTrecho os={os} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 pt-2 border-t border-border">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin size={16} /> Coordenadas do Trecho ({points.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Registre na ordem do traçado: PV montante → intermediários → PV jusante
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
          ) : (
            <>
              {points.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {points.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                      {editingId === p.id ? (
                        <div className="flex-1 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Ponto {idx + 1}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Input value={editLat} onChange={e => setEditLat(e.target.value)} placeholder="Lat" type="number" step="any" className="h-8 text-sm" />
                            <Input value={editLng} onChange={e => setEditLng(e.target.value)} placeholder="Lng" type="number" step="any" className="h-8 text-sm" />
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveEdit(p.id)}>
                              <Check size={14} className="text-status-green" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEdit}>
                              <X size={14} className="text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-status-green/15 text-status-green text-xs font-semibold shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-foreground">Ponto {idx + 1}</span>
                              <span className="text-muted-foreground ml-2 text-xs">
                                {p.latitude?.toFixed(6)}, {p.longitude?.toFixed(6)}
                              </span>
                            </div>
                          </div>
                          {canEditPoint(p) && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => swapPoints(idx, idx - 1)}
                                disabled={idx === 0 || reordering}
                                className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Mover para cima"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => swapPoints(idx, idx + 1)}
                                disabled={idx === points.length - 1 || reordering}
                                className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Mover para baixo"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button onClick={() => startEdit(p)} className="text-muted-foreground hover:text-foreground p-1" title="Editar">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive/80 p-1" title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canAdd && (
                <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Próximo: Ponto {points.length + 1}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Latitude *" type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} />
                    <Input placeholder="Longitude *" type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} />
                  </div>
                  <Button onClick={handleAdd} disabled={saving} size="sm" className="w-full">
                    {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus size={14} className="mr-1" />}
                    Adicionar Coordenada
                  </Button>
                </div>
              )}

              {!isConcluded && !allowEditAll && podeConcluir && (
                <Button onClick={handleConclude} disabled={concluding} variant="default" className="w-full bg-status-green hover:bg-status-green/90 text-white">
                  {concluding ? <Loader2 className="animate-spin mr-2" size={14} /> : <CheckCircle2 size={14} className="mr-1" />}
                  Concluir NS (→ Verde)
                </Button>
              )}

              {!isConcluded && !allowEditAll && !podeConcluir && points.length > 0 && (
                <div className="text-sm bg-status-yellow/10 border border-status-yellow/30 rounded-lg px-3 py-2 space-y-1">
                  <p className="font-medium text-foreground">⏳ Pendências para concluir esta NS:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {estacasSemCoord > 0 && (
                      <li>{estacasSemCoord} {estacasSemCoord === 1 ? 'coordenada sem' : 'coordenadas sem'} latitude/longitude</li>
                    )}
                    {ligacoesPendentes > 0 && (
                      <li>{ligacoesPendentes} {ligacoesPendentes === 1 ? 'ligação aguardando coordenadas' : 'ligações aguardando coordenadas'}</li>
                    )}
                  </ul>
                  <p className="text-xs text-muted-foreground pt-1">
                    Apenas a Sala Técnica pode concluir manualmente uma NS com pendências.
                  </p>
                </div>
              )}

              {isConcluded && !allowEditAll && (
                <p className="text-sm text-status-green font-medium flex items-center gap-1">
                  <CheckCircle2 size={14} /> NS concluída
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border overflow-hidden" style={{ minHeight: 300 }}>
          <MiniMap points={points} />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <MapPin size={16} /> Ligações desta NS
        </h3>
        <LigacoesPanel osId={os.id} />
      </div>
    </div>
  );
};

const TopografiaPage = () => {
  const { user } = useAuth();
  const { ordens, loading, refetch } = useOrdensServico();
  const [registeredOsIds, setRegisteredOsIds] = useState<Set<string>>(new Set());
  const [loadingRegistered, setLoadingRegistered] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegistered = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('topografia_asbuilt')
        .select('os_id')
        .eq('registrado_por', user.id);
      const ids = new Set((data ?? []).map(d => d.os_id));
      setRegisteredOsIds(ids);
      setLoadingRegistered(false);
    };
    fetchRegistered();
  }, [user]);

  const pendentes = ordens.filter(os => os.status === 'AMARELO');
  const registradas = ordens.filter(os => registeredOsIds.has(os.id));

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AppLayout>
    );
  }

  const renderOsList = (list: typeof ordens, allowEditAll: boolean) => (
    <div className="space-y-3">
      {list.map(os => (
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
                {expandedId === os.id ? 'Fechar' : 'Registrar Coordenadas'}
              </button>
            </div>
          </div>
          {expandedId === os.id && <OSEstacaPanel os={os} onConclude={() => refetch()} allowEditAll={allowEditAll} />}
        </div>
      ))}
      {list.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Nenhuma NS encontrada.
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Registro Topográfico</h1>
      <p className="text-sm text-muted-foreground mb-6">Registre as coordenadas as-built do traçado e das ligações</p>

      <Tabs defaultValue="pendentes">
        <TabsList className="mb-4">
          <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="registradas">
            NS Registradas ({loadingRegistered ? '…' : registradas.length})
          </TabsTrigger>
          <TabsTrigger value="ligacoes">Ligações</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          {renderOsList(pendentes, false)}
        </TabsContent>

        <TabsContent value="registradas">
          {loadingRegistered ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
          ) : (
            renderOsList(registradas, true)
          )}
        </TabsContent>

        <TabsContent value="ligacoes">
          <LigacoesPanel />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default TopografiaPage;
