import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useOrdensServico } from '@/hooks/useOrdensServico';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2, MapPin, Plus, CheckCircle2, Pencil, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-polylinedecorator';
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
  encarregado: string | null;
  profundidade: number | null;
  ns_relacionada: string | null;
}

interface LigacaoPoint {
  id: string;
  numero: number;
  latitude: number;
  longitude: number;
  comprimento: number | null;
}

const DEFAULT_CENTER: [number, number] = [-9.1167, -35.2667];
const REDE_COLOR = '#16a34a';
const LIGACAO_COLOR = '#064e3b'; // verde escuro

const MiniMap = ({ points, ligacoes = [] }: { points: AsBuiltPoint[]; ligacoes?: LigacaoPoint[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current).setView(DEFAULT_CENTER, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
    }).addTo(mapRef.current);
    // Pane das ligações acima da polyline (overlayPane = 400)
    const ligacoesPane = mapRef.current.createPane('ligacoesPane');
    ligacoesPane.style.zIndex = '650';
    layerRef.current = L.layerGroup().addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const valid = points.filter(p => p.latitude != null && p.longitude != null);
    const latlngs: [number, number][] = valid.map(p => [p.latitude!, p.longitude!]);

    // Polyline conectando os pontos na ordem (Montante → Jusante)
    if (latlngs.length >= 2) {
      const line = L.polyline(latlngs, {
        color: REDE_COLOR, weight: 4, opacity: 0.85,
      }).addTo(layer);
      // Setas de direcionamento (sentido do fluxo: montante → jusante)
      // @ts-ignore - plugin polylineDecorator
      L.polylineDecorator(line, {
        patterns: [{
          offset: 25,
          repeat: 60,
          // @ts-ignore
          symbol: L.Symbol.arrowHead({
            pixelSize: 10,
            polygon: false,
            pathOptions: { stroke: true, color: REDE_COLOR, weight: 2.5, opacity: 0.95 },
          }),
        }],
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

    // Marcadores das ligações (verde escuro, menores, em forma de losango/quadrado)
    ligacoes.forEach((l) => {
      const marker = L.circleMarker([l.latitude, l.longitude], {
        radius: 4,
        fillColor: LIGACAO_COLOR,
        color: '#ffffff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 1,
        pane: 'ligacoesPane',
      });
      const compTxt = l.comprimento != null ? `${l.comprimento}m` : '—';
      marker.bindPopup(`<b>Ligação ${l.numero}</b><br/>Comp.: ${compTxt}`);
      marker.bindTooltip(`Ligação ${l.numero} — Comp.: ${compTxt}`, { direction: 'top' });
      marker.addTo(layer);
    });

    const allLatLngs: [number, number][] = [
      ...latlngs,
      ...ligacoes.map(l => [l.latitude, l.longitude] as [number, number]),
    ];

    if (allLatLngs.length === 0) {
      map.setView(DEFAULT_CENTER, 14);
      return;
    }

    const bounds = L.latLngBounds(allLatLngs);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
  }, [points, ligacoes]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
};

const PV_MONTANTE_TAG = 'PV_MONTANTE';
const PV_JUSANTE_TAG = 'PV_JUSANTE';

// ===== Sub-componente top-level: card de PV (Montante / Jusante) =====
interface PVCardProps {
  titulo: string;
  label: string;
  point: AsBuiltPoint | null;
  latState: string;
  lngState: string;
  onLat: (v: string) => void;
  onLng: (v: string) => void;
  onSave: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  saving: boolean;
  canEdit: boolean;
  encState: string; profState: string; nsState: string;
  onEnc: (v: string) => void; onProf: (v: string) => void; onNs: (v: string) => void;
  encOpts: string[]; nsOpts: string[];
}

const PVCard = ({
  titulo, label, point, latState, lngState, onLat, onLng, onSave, onDelete, saving, canEdit,
  encState, profState, nsState, onEnc, onProf, onNs, encOpts, nsOpts,
}: PVCardProps) => {
  const [editMode, setEditMode] = useState(false);
  const showForm = !point || editMode;

  const handleSave = async () => {
    await onSave();
    setEditMode(false);
  };

  const startEdit = () => {
    onLat(point?.latitude?.toString() ?? '');
    onLng(point?.longitude?.toString() ?? '');
    onEnc(point?.encarregado ?? '');
    onProf(point?.profundidade != null ? String(point.profundidade) : '');
    onNs(point?.ns_relacionada ?? '');
    setEditMode(true);
  };

  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          <MapPin size={13} className="text-status-green" /> {titulo}
          <span className="text-muted-foreground font-normal normal-case">({label})</span>
        </p>
        {point && !showForm && canEdit && (
          <div className="flex items-center gap-1">
            <button onClick={startEdit} className="text-muted-foreground hover:text-foreground p-1" title="Editar">
              <Pencil size={13} />
            </button>
            <button onClick={() => onDelete()} className="text-destructive hover:text-destructive/80 p-1" title="Excluir">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {showForm && canEdit ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Latitude *" type="number" step="any" value={latState} onChange={(e) => onLat(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Longitude *" type="number" step="any" value={lngState} onChange={(e) => onLng(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={encState}
              onChange={(e) => onEnc(e.target.value)}
              className="h-9 text-sm rounded-md border border-input bg-background px-2"
            >
              <option value="">Encarregado…</option>
              {encOpts.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Input placeholder="Profundidade (m)" type="number" step="any" value={profState} onChange={(e) => onProf(e.target.value)} className="h-9 text-sm" />
            <select
              value={nsState}
              onChange={(e) => onNs(e.target.value)}
              className="h-9 text-sm rounded-md border border-input bg-background px-2"
            >
              <option value="">NS relacionada…</option>
              {nsOpts.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" className="flex-1">
              {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Check size={14} className="mr-1" />}
              {point ? 'Salvar alteração' : 'Salvar'}
            </Button>
            {point && (
              <Button onClick={() => setEditMode(false)} variant="ghost" size="sm">
                <X size={14} />
              </Button>
            )}
          </div>
        </>
      ) : point ? (
        <div className="text-sm text-foreground space-y-0.5">
          <p>
            <span className="text-status-green mr-1">✓</span>
            {point.latitude?.toFixed(6)}, {point.longitude?.toFixed(6)}
          </p>
          {point.encarregado && <p className="text-xs text-muted-foreground">Encarregado: <span className="text-foreground">{point.encarregado}</span></p>}
          {point.profundidade != null && <p className="text-xs text-muted-foreground">Profundidade: <span className="text-foreground">{point.profundidade} m</span></p>}
          {point.ns_relacionada && <p className="text-xs text-muted-foreground">NS relacionada: <span className="text-foreground">{point.ns_relacionada}</span></p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Não registrado</p>
      )}
    </div>
  );
};

const OSEstacaPanel = ({ os, onConclude, allowEditAll }: { os: any; onConclude: () => void; allowEditAll?: boolean }) => {
  const { user } = useAuth();
  const [points, setPoints] = useState<AsBuiltPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMontante, setSavingMontante] = useState(false);
  const [savingJusante, setSavingJusante] = useState(false);
  const [savingInter, setSavingInter] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [ligacoesPendentes, setLigacoesPendentes] = useState(0);
  const [ligacoesPlot, setLigacoesPlot] = useState<LigacaoPoint[]>([]);

  // Inputs PV Montante
  const [montLat, setMontLat] = useState('');
  const [montLng, setMontLng] = useState('');
  // Inputs PV Jusante
  const [jusLat, setJusLat] = useState('');
  const [jusLng, setJusLng] = useState('');
  // Input para novo intermediário
  const [interLat, setInterLat] = useState('');
  const [interLng, setInterLng] = useState('');

  // Metadados extra (encarregado / profundidade / ns_relacionada) por seção
  const [montEnc, setMontEnc] = useState(''); const [montProf, setMontProf] = useState(''); const [montNs, setMontNs] = useState(os.trecho ?? '');
  const [jusEnc, setJusEnc] = useState(''); const [jusProf, setJusProf] = useState(''); const [jusNs, setJusNs] = useState(os.trecho ?? '');
  const [interEnc, setInterEnc] = useState(''); const [interProf, setInterProf] = useState(''); const [interNs, setInterNs] = useState(os.trecho ?? '');

  // Listas para dropdowns
  const [encOpts, setEncOpts] = useState<string[]>([]);
  const [nsOpts, setNsOpts] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data: roleRows } = await supabase
        .from('user_roles').select('user_id').eq('role', 'encarregado');
      const ids = (roleRows ?? []).map((r: any) => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles').select('display_name, email').in('user_id', ids);
        setEncOpts((profs ?? []).map((p: any) => p.display_name || p.email).filter(Boolean));
      }
      const { data: oss } = await supabase
        .from('ordens_servico').select('trecho').order('trecho', { ascending: true });
      setNsOpts([...new Set((oss ?? []).map((o: any) => o.trecho).filter(Boolean))]);
    })();
  }, []);

  const fetchPoints = useCallback(async () => {
    const { data } = await supabase
      .from('topografia_asbuilt')
      .select('id, os_id, nome_estaca, latitude, longitude, created_at, registrado_por, encarregado, profundidade, ns_relacionada')
      .eq('os_id', os.id)
      .order('created_at', { ascending: true });
    setPoints((data as AsBuiltPoint[]) ?? []);
    setLoading(false);
  }, [os.id]);

  const fetchLigacoesStatus = useCallback(async () => {
    const { data } = await supabase
      .from('ligacoes')
      .select('id, latitude, longitude, comprimento, created_at')
      .eq('os_id', os.id)
      .order('created_at', { ascending: true });
    const rows = data ?? [];
    setLigacoesPendentes(rows.filter((r) => r.latitude == null).length);
    const plot: LigacaoPoint[] = rows
      .map((r, idx) => ({
        id: r.id as string,
        numero: idx + 1,
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        comprimento: r.comprimento != null ? Number(r.comprimento) : null,
      }))
      .filter((r) => r.latitude != null && r.longitude != null);
    setLigacoesPlot(plot);
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

  // Separa em montante / intermediários / jusante
  const montante = points.find((p) => p.nome_estaca === PV_MONTANTE_TAG) ?? null;
  const jusante = points.find((p) => p.nome_estaca === PV_JUSANTE_TAG) ?? null;
  const intermediarios = points.filter(
    (p) => p.nome_estaca !== PV_MONTANTE_TAG && p.nome_estaca !== PV_JUSANTE_TAG
  );

  const pvMontanteLabel = os.pv_montante || 'PV Montante';
  const pvJusanteLabel = os.pv_jusante || 'PV Jusante';

  // Helper: monta payload extra opcional
  const extraPayload = (enc: string, prof: string, ns: string) => {
    const out: Record<string, any> = {};
    if (enc.trim()) out.encarregado = enc.trim();
    const pf = parseFloat(prof);
    if (!isNaN(pf)) out.profundidade = pf;
    if (ns.trim()) out.ns_relacionada = ns.trim();
    return out;
  };

  // ===== Salvar / atualizar PV Montante =====
  const saveMontante = async () => {
    const latVal = parseFloat(montLat);
    const lngVal = parseFloat(montLng);
    if (isNaN(latVal) || isNaN(lngVal)) {
      toast.error('Latitude e Longitude do PV Montante são obrigatórios.');
      return;
    }
    setSavingMontante(true);
    const extra = extraPayload(montEnc, montProf, montNs);
    if (montante) {
      const { data, error } = await supabase.from('topografia_asbuilt').update({
        latitude: latVal, longitude: lngVal, ...extra,
      }).eq('id', montante.id).select().single();
      setSavingMontante(false);
      if (error) { toast.error('Erro ao atualizar PV Montante.'); return; }
      toast.success('PV Montante atualizado!');
      if (data) setPoints((prev) => prev.map((p) => p.id === data.id ? (data as AsBuiltPoint) : p));
    } else {
      const ts = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString();
      const { data, error } = await supabase.from('topografia_asbuilt').insert({
        os_id: os.id,
        nome_estaca: PV_MONTANTE_TAG,
        latitude: latVal,
        longitude: lngVal,
        registrado_por: user?.id ?? null,
        created_at: ts,
        ...extra,
      }).select().single();
      setSavingMontante(false);
      if (error) { toast.error('Erro ao salvar PV Montante.'); return; }
      toast.success('PV Montante registrado!');
      setMontLat(''); setMontLng('');
      if (data) setPoints((prev) => [...prev, data as AsBuiltPoint]);
    }
  };

  // ===== Salvar / atualizar PV Jusante =====
  const saveJusante = async () => {
    const latVal = parseFloat(jusLat);
    const lngVal = parseFloat(jusLng);
    if (isNaN(latVal) || isNaN(lngVal)) {
      toast.error('Latitude e Longitude do PV Jusante são obrigatórios.');
      return;
    }
    setSavingJusante(true);
    const extra = extraPayload(jusEnc, jusProf, jusNs);
    if (jusante) {
      const { data, error } = await supabase.from('topografia_asbuilt').update({
        latitude: latVal, longitude: lngVal, ...extra,
      }).eq('id', jusante.id).select().single();
      setSavingJusante(false);
      if (error) { toast.error('Erro ao atualizar PV Jusante.'); return; }
      toast.success('PV Jusante atualizado!');
      if (data) setPoints((prev) => prev.map((p) => p.id === data.id ? (data as AsBuiltPoint) : p));
    } else {
      const ts = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
      const { data, error } = await supabase.from('topografia_asbuilt').insert({
        os_id: os.id,
        nome_estaca: PV_JUSANTE_TAG,
        latitude: latVal,
        longitude: lngVal,
        registrado_por: user?.id ?? null,
        created_at: ts,
        ...extra,
      }).select().single();
      setSavingJusante(false);
      if (error) { toast.error('Erro ao salvar PV Jusante.'); return; }
      toast.success('PV Jusante registrado!');
      setJusLat(''); setJusLng('');
      if (data) setPoints((prev) => [...prev, data as AsBuiltPoint]);
    }
  };

  // ===== Adicionar intermediário =====
  const addIntermediario = async () => {
    const latVal = parseFloat(interLat);
    const lngVal = parseFloat(interLng);
    if (isNaN(latVal) || isNaN(lngVal)) {
      toast.error('Latitude e Longitude do ponto intermediário são obrigatórios.');
      return;
    }
    setSavingInter(true);
    const next = intermediarios.length + 1;
    const { data, error } = await supabase.from('topografia_asbuilt').insert({
      os_id: os.id,
      nome_estaca: `Intermediário ${next}`,
      latitude: latVal,
      longitude: lngVal,
      registrado_por: user?.id ?? null,
      ...extraPayload(interEnc, interProf, interNs),
    }).select().single();
    setSavingInter(false);
    if (error) { toast.error('Erro ao salvar ponto intermediário.'); return; }
    toast.success(`Intermediário ${next} registrado!`);
    setInterLat(''); setInterLng(''); setInterEnc(''); setInterProf('');
    if (data) setPoints((prev) => [...prev, data as AsBuiltPoint]);
  };

  const deletePoint = async (id: string) => {
    const { error } = await supabase.from('topografia_asbuilt').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Ponto excluído.');
    setPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const confirmDeleteIntermediario = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este ponto?')) {
      deletePoint(id);
    }
  };

  const deletePV = async (point: AsBuiltPoint, label: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o ${label}? As coordenadas serão apagadas.`)) return;
    const { error } = await supabase.from('topografia_asbuilt').delete().eq('id', point.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success(`${label} removido.`);
    setPoints((prev) => prev.filter((p) => p.id !== point.id));
  };

  // Renumera nomes dos intermediários após exclusão
  useEffect(() => {
    if (intermediarios.length === 0) return;
    const needsRename = intermediarios.some((p, idx) => p.nome_estaca !== `Intermediário ${idx + 1}`);
    if (!needsRename) return;
    (async () => {
      await Promise.all(
        intermediarios.map((p, idx) =>
          p.nome_estaca === `Intermediário ${idx + 1}`
            ? Promise.resolve()
            : supabase.from('topografia_asbuilt').update({ nome_estaca: `Intermediário ${idx + 1}` }).eq('id', p.id)
        )
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Polyline segue ordem: Montante → Intermediários → Jusante
  const orderedForMap: AsBuiltPoint[] = [
    ...(montante ? [montante] : []),
    ...intermediarios,
    ...(jusante ? [jusante] : []),
  ].filter((p) => p.latitude != null && p.longitude != null);

  const podeConcluir = !!montante && !!jusante && ligacoesPendentes === 0;

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
  const canEdit = allowEditAll || !isConcluded;

  // (PVCard movido para fora do componente — ver abaixo)

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
              <MapPin size={16} /> Coordenadas do Trecho
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Registre na ordem do traçado: PV montante → intermediários → PV jusante
            </p>
          </div>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
          ) : (
            <>
              {/* PV Montante */}
              <PVCard
                titulo="PV Montante"
                label={pvMontanteLabel}
                point={montante}
                latState={montLat}
                lngState={montLng}
                onLat={setMontLat}
                onLng={setMontLng}
                onSave={saveMontante}
                onDelete={() => montante && deletePV(montante, 'PV Montante')}
                saving={savingMontante}
                canEdit={canEdit}
                encState={montEnc} profState={montProf} nsState={montNs}
                onEnc={setMontEnc} onProf={setMontProf} onNs={setMontNs}
                encOpts={encOpts} nsOpts={nsOpts}
              />

              {/* Intermediários */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  Pontos Intermediários ({intermediarios.length})
                </p>
                {intermediarios.length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {intermediarios.map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-status-green/15 text-status-green text-xs font-semibold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">Intermediário {idx + 1}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {p.latitude?.toFixed(6)}, {p.longitude?.toFixed(6)}
                            </span>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => confirmDeleteIntermediario(p.id)}
                            className="text-destructive hover:text-destructive/80 p-1 shrink-0"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canEdit && (
                  <div className="space-y-2 bg-muted/20 rounded-lg p-3 border border-dashed border-border">
                    <p className="text-xs text-muted-foreground">
                      Próximo: Intermediário {intermediarios.length + 1}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Latitude" type="number" step="any" value={interLat} onChange={(e) => setInterLat(e.target.value)} className="h-9 text-sm" />
                      <Input placeholder="Longitude" type="number" step="any" value={interLng} onChange={(e) => setInterLng(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <Button onClick={addIntermediario} disabled={savingInter} size="sm" variant="outline" className="w-full">
                      {savingInter ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus size={14} className="mr-1" />}
                      Adicionar Ponto Intermediário
                    </Button>
                  </div>
                )}
              </div>

              {/* PV Jusante */}
              <PVCard
                titulo="PV Jusante"
                label={pvJusanteLabel}
                point={jusante}
                latState={jusLat}
                lngState={jusLng}
                onLat={setJusLat}
                onLng={setJusLng}
                onSave={saveJusante}
                onDelete={() => jusante && deletePV(jusante, 'PV Jusante')}
                saving={savingJusante}
                canEdit={canEdit}
                encState={jusEnc} profState={jusProf} nsState={jusNs}
                onEnc={setJusEnc} onProf={setJusProf} onNs={setJusNs}
                encOpts={encOpts} nsOpts={nsOpts}
              />

              {!isConcluded && !allowEditAll && podeConcluir && (
                <Button onClick={handleConclude} disabled={concluding} variant="default" className="w-full bg-status-green hover:bg-status-green/90 text-white">
                  {concluding ? <Loader2 className="animate-spin mr-2" size={14} /> : <CheckCircle2 size={14} className="mr-1" />}
                  Concluir NS (→ Verde)
                </Button>
              )}

              {!isConcluded && !allowEditAll && !podeConcluir && (montante || jusante || intermediarios.length > 0) && (
                <div className="text-sm bg-status-yellow/10 border border-status-yellow/30 rounded-lg px-3 py-2 space-y-1">
                  <p className="font-medium text-foreground">⏳ Pendências para concluir esta NS:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {!montante && <li>PV Montante não registrado</li>}
                    {!jusante && <li>PV Jusante não registrado</li>}
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
          <MiniMap points={orderedForMap} ligacoes={ligacoesPlot} />
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
  const { effectiveUser } = useAuth();
  const { ordens, loading, refetch } = useOrdensServico();
  const [registeredOsIds, setRegisteredOsIds] = useState<Set<string>>(new Set());
  const [loadingRegistered, setLoadingRegistered] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegistered = async () => {
      if (!effectiveUser) return;
      const { data } = await supabase
        .from('topografia_asbuilt')
        .select('os_id')
        .eq('registrado_por', effectiveUser.id);
      const ids = new Set((data ?? []).map(d => d.os_id));
      setRegisteredOsIds(ids);
      setLoadingRegistered(false);
    };
    fetchRegistered();
  }, [effectiveUser]);

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{os.trecho}</p>
              <p className="text-xs text-muted-foreground truncate">
                {os.bacia} • PV {os.pv_montante || '—'} → {os.pv_jusante || '—'}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Encarregado: <span className="font-medium text-foreground">{os.executor || os.liberado_para || '—'}</span>
                <span className="mx-2">•</span>
                {os.comprimento_real ?? os.comprimento_previsto ?? '—'}m
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={os.status} size="sm" />
              <button
                onClick={() => setExpandedId(expandedId === os.id ? null : os.id)}
                className="text-sm text-secondary hover:underline whitespace-nowrap"
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
