import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEditorOperacional, type Coord } from '@/hooks/useEditorOperacional';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { OSStatus } from '@/types/sanegest';
import { AlertTriangle, Split, Move, Trash2, Link2, RotateCcw, Plus, X } from 'lucide-react';

const STATUS_COLORS: Record<OSStatus, string> = {
  CINZA: '#8a8a8a', VERMELHO: '#dc2626', LARANJA: '#f97316',
  AMARELO: '#ca8a04', VERDE: '#16a34a',
};

function coordsToLatLng(coords: Coord[]): L.LatLngExpression[] {
  return coords.map(([lon, lat]) => [lat, lon]);
}
function firstCoords(geometry: any): Coord[] {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return geometry.coordinates;
  if (geometry.type === 'MultiLineString') return geometry.coordinates[0] ?? [];
  return [];
}
function lineLength(coords: Coord[]): number {
  if (coords.length < 2) return 0;
  return turf.length(turf.lineString(coords), { units: 'meters' });
}

type ToolMode =
  | { kind: 'none' }
  | { kind: 'add-pv'; trechoId: string }
  | { kind: 'move-pv'; pvId: string }
  | { kind: 'manual-pv1' }
  | { kind: 'manual-pv2'; pv1Id: string }
  | { kind: 'manual-draw'; pv1Id: string; pv2Id: string; vertices: Coord[] };

type OSVinc = { id: string; trecho: string; bacia: string; status: OSStatus; pv_final_assentado: boolean };
type DestinoDivisao = 'A' | 'B' | 'AMBOS' | 'NENHUM';

const EditorOperacionalPage = () => {
  const { user } = useAuth();
  const isSalaTecnica = user?.role === 'sala_tecnica';
  const canEdit = isSalaTecnica; // RLS enforces server-side
  const {
    base, loading, erro, reload,
    trechosEfetivos, pvsEfetivos, statusPorTrecho, ordens, vinculos,
  } = useEditorOperacional(!!user);

  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const originalLayerRef = useRef<L.LayerGroup | null>(null);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showSuprimidos, setShowSuprimidos] = useState(false);
  const [selectedTrechoId, setSelectedTrechoId] = useState<string | null>(null);
  const [selectedPvId, setSelectedPvId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>({ kind: 'none' });

  // Dialog states
  const [vincularOpen, setVincularOpen] = useState(false);
  const [dividirOpen, setDividirOpen] = useState<null | { trechoId: string; latlng: L.LatLng }>(null);
  const [moverConfirm, setMoverConfirm] = useState<null | {
    pvId: string; from: Coord; to: Coord; deltaM: number;
    trechosAfetados: string[];
  }>(null);
  const [suprimirTrechoOpen, setSuprimirTrechoOpen] = useState(false);
  const [suprimirPvOpen, setSuprimirPvOpen] = useState<null | {
    pvId: string; trechosConectados: string[];
  }>(null);
  const [manualOpen, setManualOpen] = useState<null | {
    pv1Id: string; pv2Id: string; vertices: Coord[];
  }>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-9.1, -35.3], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 22, attribution: '© OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    originalLayerRef.current = L.layerGroup().addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Fit to base bbox on first load
  useEffect(() => {
    const map = mapRef.current; if (!map || !trechosEfetivos.length) return;
    const all: L.LatLngExpression[] = [];
    for (const t of trechosEfetivos) all.push(...coordsToLatLng(firstCoords(t.geometry)));
    if (all.length) map.fitBounds(L.latLngBounds(all as any), { padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base?.id]);

  // Render original reference layer
  useEffect(() => {
    const g = originalLayerRef.current; if (!g) return;
    g.clearLayers();
    if (!showOriginal) return;
    for (const t of trechosEfetivos) {
      if (!t.origem_id) continue;
      const orig = t.original; if (!orig) continue;
      const ll = coordsToLatLng(firstCoords(orig.geometry));
      if (ll.length < 2) continue;
      L.polyline(ll, { color: '#9ca3af', weight: 2, opacity: 0.55, dashArray: '3,4' }).addTo(g);
    }
  }, [trechosEfetivos, showOriginal]);

  // Render operational layer + interactions
  useEffect(() => {
    const map = mapRef.current; const g = layersRef.current;
    if (!map || !g) return;
    g.clearLayers();

    for (const t of trechosEfetivos) {
      const isSuprimido = t.tipo === 'suprimido';
      if (isSuprimido && !showSuprimidos) continue;
      const ll = coordsToLatLng(firstCoords(t.geometry));
      if (ll.length < 2) continue;
      const info = statusPorTrecho.get(t.id);
      const status: OSStatus = info?.status ?? 'CINZA';
      const cor = STATUS_COLORS[status];
      const selected = t.id === selectedTrechoId;
      const line = L.polyline(ll, {
        color: isSuprimido ? '#dc2626' : cor,
        weight: selected ? 7 : 5,
        opacity: isSuprimido ? 0.5 : 0.95,
        dashArray: isSuprimido ? '8,6' : (t.tipo === 'manual' ? '2,3' : undefined),
      });
      line.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (tool.kind === 'add-pv' && tool.trechoId === t.id) {
          setDividirOpen({ trechoId: t.id, latlng: (e as any).latlng });
          setTool({ kind: 'none' });
          return;
        }
        setSelectedTrechoId(t.id); setSelectedPvId(null);
      });
      const tipoLabel = t.tipo === 'original' ? 'Original' : t.tipo === 'derivado' ? 'Derivado' : t.tipo === 'manual' ? 'Manual' : 'Suprimido';
      const pvFinalLine = info?.pvFinal ? `<div style="margin-top:4px;padding:3px 5px;background:#dbeafe;color:#1e40af;border-radius:4px;font-size:11px">PV final assentado — pronto para Topografia</div>` : '';
      line.bindTooltip(
        `<b>${t.rotulo}</b> <span style="color:#666">(${tipoLabel})</span><br/>` +
        `${(t.extensao_m ?? 0).toFixed(2)} m · DN ${t.dn ?? '—'}<br/>` +
        `Status: <b style="color:${cor}">${status}</b>` +
        pvFinalLine,
        { sticky: true }
      );
      line.addTo(g);
    }

    for (const p of pvsEfetivos) {
      if (p.tipo === 'suprimido' && !showSuprimidos) continue;
      const selected = p.id === selectedPvId;
      const isOp = p.tipo !== 'original';
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: selected ? 8 : (isOp ? 6 : 4),
        color: '#fff', weight: 1.5,
        fillColor: p.tipo === 'suprimido' ? '#dc2626'
          : p.tipo === 'manual' ? '#7c3aed'
          : p.tipo === 'movido' ? '#f59e0b'
          : '#0C447C',
        fillOpacity: p.tipo === 'suprimido' ? 0.4 : 0.95,
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (tool.kind === 'manual-pv1') {
          setTool({ kind: 'manual-pv2', pv1Id: p.id });
          toast.info(`PV inicial: ${p.rotulo}. Clique no PV final.`);
          return;
        }
        if (tool.kind === 'manual-pv2') {
          if (p.id === tool.pv1Id) { toast.error('Escolha um PV diferente'); return; }
          setTool({ kind: 'manual-draw', pv1Id: tool.pv1Id, pv2Id: p.id, vertices: [] });
          toast.info('Clique no mapa para adicionar vértices intermediários. Duplo clique para concluir.');
          return;
        }
        setSelectedPvId(p.id); setSelectedTrechoId(null);
      });
      marker.bindTooltip(`<b>${p.rotulo}</b><br/><span style="font-size:11px;color:#666">${p.tipo}</span>`, { sticky: true });
      marker.addTo(g);
    }
  }, [trechosEfetivos, pvsEfetivos, statusPorTrecho, showSuprimidos, selectedTrechoId, selectedPvId, tool]);

  // Map click for manual draw / move confirm
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      if (tool.kind === 'manual-draw') {
        setTool({ ...tool, vertices: [...tool.vertices, [e.latlng.lng, e.latlng.lat]] });
      }
    };
    const dblHandler = () => {
      if (tool.kind === 'manual-draw') {
        setManualOpen({ pv1Id: tool.pv1Id, pv2Id: tool.pv2Id, vertices: tool.vertices });
        setTool({ kind: 'none' });
      }
    };
    map.on('click', handler);
    map.on('dblclick', dblHandler);
    return () => { map.off('click', handler); map.off('dblclick', dblHandler); };
  }, [tool]);

  const selectedTrecho = trechosEfetivos.find((t) => t.id === selectedTrechoId) ?? null;
  const selectedPv = pvsEfetivos.find((p) => p.id === selectedPvId) ?? null;

  // ============ Helpers de persistência ============

  async function ensurePvOperacional(pvEfetivoId: string): Promise<string> {
    // Se já é operacional, retorna id.
    const efet = pvsEfetivos.find((p) => p.id === pvEfetivoId);
    if (!efet) throw new Error('PV não encontrado');
    if (efet.op_id) return efet.op_id;
    // Criar shadow operacional a partir do original
    const orig = efet.original!;
    const { data, error } = await supabase.from('mapa_pv_operacional' as any).insert({
      base_id: base!.id,
      ponto_origem_id: orig.id,
      rotulo: orig.rotulo_original,
      tipo: 'original',
      geom: { type: 'Point', coordinates: [orig.lon, orig.lat] },
      lat: orig.lat, lon: orig.lon,
      cota: orig.cota_marg ?? orig.cota_inv, profundidade: orig.prof,
      updated_by: user!.id,
    }).select('id').single();
    if (error) throw error;
    return (data as any).id;
  }

  async function ensureTrechoOperacional(trechoEfetivoId: string): Promise<{ opId: string; pvIniId: string; pvFimId: string; coords: Coord[] }> {
    const efet = trechosEfetivos.find((t) => t.id === trechoEfetivoId);
    if (!efet) throw new Error('Trecho não encontrado');
    if (efet.op_id) {
      return {
        opId: efet.op_id, pvIniId: efet.pv_inicial_id!, pvFimId: efet.pv_final_id!,
        coords: firstCoords(efet.geometry),
      };
    }
    const orig = efet.original!;
    const coords = firstCoords(orig.geometry);
    if (coords.length < 2) throw new Error('Geometria original inválida');
    // Encontrar PVs originais pelas extremidades — match por rótulo (no_inicial / no_final) ou por proximidade
    const first = coords[0]; const last = coords[coords.length - 1];
    const pvByProx = (c: Coord) => {
      let best: any = null; let bestD = Infinity;
      for (const p of pvsEfetivos) {
        const d = Math.hypot(p.lon - c[0], p.lat - c[1]);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    };
    const iniEf = pvByProx(first); const fimEf = pvByProx(last);
    if (!iniEf || !fimEf) throw new Error('Não foi possível localizar PVs de extremidade');
    const iniOp = await ensurePvOperacional(iniEf.id);
    const fimOp = await ensurePvOperacional(fimEf.id);
    const ext = lineLength(coords);
    const { data, error } = await supabase.from('mapa_trecho_operacional' as any).insert({
      base_id: base!.id,
      trecho_origem_id: orig.id,
      rotulo: orig.rotulo_original,
      tipo: 'original',
      pv_inicial_id: iniOp, pv_final_id: fimOp,
      geom: { type: 'LineString', coordinates: coords },
      extensao_m: ext, dn: orig.dn, material: orig.material,
      updated_by: user!.id,
    }).select('id').single();
    if (error) throw error;
    // Migrar vínculos existentes (trecho_id) → também referenciar trecho_operacional_id
    await supabase.from('mapa_trecho_os' as any)
      .update({ trecho_operacional_id: (data as any).id })
      .eq('trecho_id', orig.id)
      .eq('ativo', true);
    return { opId: (data as any).id, pvIniId: iniOp, pvFimId: fimOp, coords };
  }

  // ============ Ações ============

  async function acaoDividirTrecho(rotuloA: string, rotuloB: string, novoPvRotulo: string, cota: string, prof: string) {
    if (!dividirOpen || !base || !user) return;
    try {
      const { trechoId, latlng } = dividirOpen;
      const { opId, pvIniId, pvFimId, coords } = await ensureTrechoOperacional(trechoId);
      const line = turf.lineString(coords);
      const snap = turf.nearestPointOnLine(line, turf.point([latlng.lng, latlng.lat]), { units: 'meters' });
      const snapCoord: Coord = snap.geometry.coordinates as Coord;

      // Criar novo PV manual
      const { data: novoPv, error: e1 } = await supabase.from('mapa_pv_operacional' as any).insert({
        base_id: base.id, ponto_origem_id: null, rotulo: novoPvRotulo, tipo: 'manual',
        geom: { type: 'Point', coordinates: snapCoord },
        lat: snapCoord[1], lon: snapCoord[0],
        cota: cota ? Number(cota) : null,
        profundidade: prof ? Number(prof) : null,
        motivo: 'Divisão de trecho', updated_by: user.id,
      }).select('id').single();
      if (e1) throw e1;
      const novoPvId = (novoPv as any).id;

      // Slice line
      const sliceA = turf.lineSlice(turf.point(coords[0]), snap, line);
      const sliceB = turf.lineSlice(snap, turf.point(coords[coords.length - 1]), line);
      const coordsA = sliceA.geometry.coordinates as Coord[];
      const coordsB = sliceB.geometry.coordinates as Coord[];

      // Marcar original operacional como suprimido
      await supabase.from('mapa_trecho_operacional' as any)
        .update({ tipo: 'suprimido', motivo: 'Substituído por divisão', updated_by: user.id })
        .eq('id', opId);
      // Desativar vínculos do trecho original operacional (usuário vinculará N.S. aos segmentos)
      await supabase.from('mapa_trecho_os' as any)
        .update({ ativo: false })
        .eq('trecho_operacional_id', opId)
        .eq('ativo', true);

      // Criar dois derivados
      const orig = trechosEfetivos.find((t) => t.id === trechoId);
      const insertPayload = [
        {
          base_id: base.id, trecho_origem_id: orig?.origem_id ?? null,
          rotulo: rotuloA, tipo: 'derivado',
          pv_inicial_id: pvIniId, pv_final_id: novoPvId,
          geom: { type: 'LineString', coordinates: coordsA },
          extensao_m: lineLength(coordsA),
          dn: orig?.dn ?? null, material: orig?.material ?? null,
          motivo: 'Divisão de trecho', updated_by: user.id,
        },
        {
          base_id: base.id, trecho_origem_id: orig?.origem_id ?? null,
          rotulo: rotuloB, tipo: 'derivado',
          pv_inicial_id: novoPvId, pv_final_id: pvFimId,
          geom: { type: 'LineString', coordinates: coordsB },
          extensao_m: lineLength(coordsB),
          dn: orig?.dn ?? null, material: orig?.material ?? null,
          motivo: 'Divisão de trecho', updated_by: user.id,
        },
      ];
      const { error: e2 } = await supabase.from('mapa_trecho_operacional' as any).insert(insertPayload);
      if (e2) throw e2;
      toast.success('Trecho dividido em 2 segmentos');
      setDividirOpen(null); setSelectedTrechoId(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao dividir trecho');
    }
  }

  async function acaoMoverPvIniciar(pvId: string, to: Coord) {
    const p = pvsEfetivos.find((x) => x.id === pvId); if (!p) return;
    const from: Coord = [p.lon, p.lat];
    const delta = turf.distance(turf.point(from), turf.point(to), { units: 'meters' });
    // Trechos afetados
    const opTrechosAfetados = trechosEfetivos.filter((t) =>
      t.op_id && (t.pv_inicial_id === p.op_id || t.pv_final_id === p.op_id)
    ).map((t) => t.rotulo);
    // Trechos originais que serão puxados ao operacional
    const origTrechosAfetados = trechosEfetivos.filter((t) =>
      !t.op_id && p.original && (t.original?.no_inicial === p.original.rotulo_original || t.original?.no_final === p.original.rotulo_original)
    ).map((t) => t.rotulo);
    setMoverConfirm({
      pvId, from, to, deltaM: delta,
      trechosAfetados: [...opTrechosAfetados, ...origTrechosAfetados],
    });
  }

  async function acaoMoverPvConfirmar(justificativa: string) {
    if (!moverConfirm || !base || !user) return;
    try {
      const p = pvsEfetivos.find((x) => x.id === moverConfirm.pvId); if (!p) return;
      const opId = await ensurePvOperacional(p.id);
      const to = moverConfirm.to;
      // Atualiza PV
      const { error: eP } = await supabase.from('mapa_pv_operacional' as any).update({
        tipo: p.tipo === 'manual' ? 'manual' : 'movido',
        geom: { type: 'Point', coordinates: to },
        lat: to[1], lon: to[0],
        motivo: moverConfirm.deltaM > 10 ? `Movido ${moverConfirm.deltaM.toFixed(1)}m — ${justificativa}` : `Movido ${moverConfirm.deltaM.toFixed(1)}m`,
        updated_by: user.id,
      }).eq('id', opId);
      if (eP) throw eP;

      // Puxar para operacional todos os trechos originais conectados que ainda não são operacionais
      const efetivo = pvsEfetivos.find((x) => x.op_id === opId || x.id === p.id);
      const rotuloOriginal = efetivo?.original?.rotulo_original;
      if (rotuloOriginal) {
        const conectados = trechosEfetivos.filter((t) => !t.op_id && (t.original?.no_inicial === rotuloOriginal || t.original?.no_final === rotuloOriginal));
        for (const c of conectados) await ensureTrechoOperacional(c.id);
      }

      // Atualiza geometria dos trechos operacionais conectados: substitui a extremidade pelo novo ponto
      const { data: tops } = await supabase.from('mapa_trecho_operacional' as any)
        .select('id, pv_inicial_id, pv_final_id, geom')
        .eq('base_id', base.id)
        .or(`pv_inicial_id.eq.${opId},pv_final_id.eq.${opId}`);
      for (const t of (tops ?? []) as any[]) {
        const coords = (t.geom?.coordinates ?? []) as Coord[];
        if (coords.length < 2) continue;
        if (t.pv_inicial_id === opId) coords[0] = to;
        if (t.pv_final_id === opId) coords[coords.length - 1] = to;
        await supabase.from('mapa_trecho_operacional' as any).update({
          geom: { type: 'LineString', coordinates: coords },
          extensao_m: lineLength(coords),
          updated_by: user.id,
        }).eq('id', t.id);
      }
      toast.success(`PV movido (${moverConfirm.deltaM.toFixed(1)} m)`);
      setMoverConfirm(null);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao mover PV');
    }
  }

  async function acaoSuprimirTrecho(motivo: string) {
    if (!selectedTrecho || !base || !user) return;
    try {
      const { opId } = await ensureTrechoOperacional(selectedTrecho.id);
      const { error } = await supabase.from('mapa_trecho_operacional' as any).update({
        tipo: 'suprimido', motivo, updated_by: user.id,
      }).eq('id', opId);
      if (error) throw error;
      await supabase.from('mapa_trecho_os' as any)
        .update({ ativo: false })
        .eq('trecho_operacional_id', opId).eq('ativo', true);
      toast.success('Trecho suprimido');
      setSuprimirTrechoOpen(false);
      await reload();
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao suprimir'); }
  }

  async function acaoRestaurarOriginal() {
    if (!selectedTrecho?.op_id) return;
    if (!confirm('Restaurar geometria original deste trecho? A camada operacional atual será removida.')) return;
    try {
      // remove vínculos operacionais deste trecho
      await supabase.from('mapa_trecho_os' as any).delete().eq('trecho_operacional_id', selectedTrecho.op_id);
      const { error } = await supabase.from('mapa_trecho_operacional' as any).delete().eq('id', selectedTrecho.op_id);
      if (error) throw error;
      toast.success('Geometria original restaurada');
      setSelectedTrechoId(null);
      await reload();
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao restaurar'); }
  }

  async function acaoSuprimirPvSimples() {
    if (!selectedPv) return;
    // trechos operacionais ativos conectados
    const conectados = trechosEfetivos.filter((t) =>
      t.tipo !== 'suprimido' && (t.pv_inicial_id === selectedPv.op_id || t.pv_final_id === selectedPv.op_id
        || (!t.op_id && selectedPv.original && (t.original?.no_inicial === selectedPv.original.rotulo_original || t.original?.no_final === selectedPv.original.rotulo_original)))
    );
    if (conectados.length === 0) {
      try {
        const opId = await ensurePvOperacional(selectedPv.id);
        await supabase.from('mapa_pv_operacional' as any).update({ tipo: 'suprimido', motivo: 'Sem trechos ativos', updated_by: user!.id }).eq('id', opId);
        toast.success('PV suprimido');
        setSelectedPvId(null); await reload();
      } catch (e: any) { toast.error(e.message); }
      return;
    }
    setSuprimirPvOpen({ pvId: selectedPv.id, trechosConectados: conectados.map((t) => t.rotulo) });
  }

  async function acaoUnirTrechos() {
    if (!selectedPv) return;
    const conectados = trechosEfetivos.filter((t) =>
      t.tipo !== 'suprimido' && t.op_id && (t.pv_inicial_id === selectedPv.op_id || t.pv_final_id === selectedPv.op_id)
    );
    if (conectados.length !== 2) { toast.error('União exige exatamente 2 trechos operacionais conectados'); return; }
    if (!confirm(`Unir ${conectados[0].rotulo} + ${conectados[1].rotulo}? O PV atual será suprimido.`)) return;
    try {
      const [a, b] = conectados;
      const aC = firstCoords(a.geometry); const bC = firstCoords(b.geometry);
      // orient: end of A == start of new; end of B == end
      const pvOpId = selectedPv.op_id!;
      let start: string, end: string; let coords: Coord[] = [];
      if (a.pv_final_id === pvOpId && b.pv_inicial_id === pvOpId) {
        start = a.pv_inicial_id!; end = b.pv_final_id!;
        coords = [...aC, ...bC.slice(1)];
      } else if (a.pv_inicial_id === pvOpId && b.pv_final_id === pvOpId) {
        start = b.pv_inicial_id!; end = a.pv_final_id!;
        coords = [...bC, ...aC.slice(1)];
      } else if (a.pv_final_id === pvOpId && b.pv_final_id === pvOpId) {
        start = a.pv_inicial_id!; end = b.pv_inicial_id!;
        coords = [...aC, ...bC.slice().reverse().slice(1)];
      } else {
        start = a.pv_final_id!; end = b.pv_final_id!;
        coords = [...aC.slice().reverse(), ...bC.slice(1)];
      }
      const rotulo = `${a.rotulo}+${b.rotulo}`;
      const { error: eIns } = await supabase.from('mapa_trecho_operacional' as any).insert({
        base_id: base!.id, trecho_origem_id: null, rotulo, tipo: 'manual',
        pv_inicial_id: start, pv_final_id: end,
        geom: { type: 'LineString', coordinates: coords }, extensao_m: lineLength(coords),
        dn: a.dn ?? b.dn, material: a.material ?? b.material,
        motivo: 'União de trechos', updated_by: user!.id,
      });
      if (eIns) throw eIns;
      await supabase.from('mapa_trecho_operacional' as any).delete().in('id', [a.op_id, b.op_id]);
      await supabase.from('mapa_pv_operacional' as any).update({ tipo: 'suprimido', motivo: 'União de trechos', updated_by: user!.id }).eq('id', pvOpId);
      toast.success('Trechos unidos');
      setSelectedPvId(null); setSuprimirPvOpen(null);
      await reload();
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao unir'); }
  }

  async function acaoCriarManual(rotulo: string, dn: string, material: string) {
    if (!manualOpen || !base || !user) return;
    try {
      const p1 = pvsEfetivos.find((x) => x.id === manualOpen.pv1Id)!;
      const p2 = pvsEfetivos.find((x) => x.id === manualOpen.pv2Id)!;
      const iniOp = await ensurePvOperacional(p1.id);
      const fimOp = await ensurePvOperacional(p2.id);
      const coords: Coord[] = [[p1.lon, p1.lat], ...manualOpen.vertices, [p2.lon, p2.lat]];
      const { error } = await supabase.from('mapa_trecho_operacional' as any).insert({
        base_id: base.id, trecho_origem_id: null, rotulo, tipo: 'manual',
        pv_inicial_id: iniOp, pv_final_id: fimOp,
        geom: { type: 'LineString', coordinates: coords }, extensao_m: lineLength(coords),
        dn: dn ? Number(dn) : null, material: material || null,
        motivo: 'Trecho manual', updated_by: user.id,
      });
      if (error) throw error;
      toast.success('Trecho manual criado');
      setManualOpen(null); await reload();
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao criar trecho'); }
  }

  // ============ Vincular N.S. ============
  const infoSelected = selectedTrecho ? statusPorTrecho.get(selectedTrecho.id) : null;

  async function acaoVincularNS(osIds: string[], motivo: string) {
    if (!selectedTrecho) return;
    try {
      const { opId } = await ensureTrechoOperacional(selectedTrecho.id);
      // desativa anteriores desse trecho op
      await supabase.from('mapa_trecho_os' as any).update({ ativo: false }).eq('trecho_operacional_id', opId).eq('ativo', true);
      if (osIds.length) {
        const rows = osIds.map((osId) => ({
          trecho_id: selectedTrecho.origem_id, trecho_operacional_id: opId,
          os_id: osId, origem: 'MANUAL', ativo: true, motivo,
        }));
        const { error } = await supabase.from('mapa_trecho_os' as any).insert(rows);
        if (error) throw error;
      }
      toast.success('Vínculos atualizados');
      setVincularOpen(false); await reload();
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao vincular'); }
  }

  // ============ UI ============

  if (!user) return null;
  if (!isSalaTecnica) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 text-destructive" />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">O Editor Operacional do Mapa é exclusivo da Sala Técnica.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
        {/* Toolbar */}
        <div className="border-b bg-card p-2 flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold px-2">
            Editor Operacional {base ? `— ${base.ss} v${base.versao} (${base.status})` : ''}
          </div>
          <div className="mx-2 h-4 w-px bg-border" />
          <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} /> Original</label>
          <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showSuprimidos} onChange={(e) => setShowSuprimidos(e.target.checked)} /> Suprimidos</label>
          <div className="mx-2 h-4 w-px bg-border" />
          <Button size="sm" variant={tool.kind === 'manual-pv1' ? 'default' : 'outline'} onClick={() => {
            setTool({ kind: 'manual-pv1' }); setSelectedPvId(null); setSelectedTrechoId(null);
            toast.info('Clique no PV inicial');
          }}>
            <Plus className="h-3 w-3 mr-1" /> Trecho manual
          </Button>
          {tool.kind !== 'none' && (
            <Button size="sm" variant="ghost" onClick={() => { setTool({ kind: 'none' }); toast.info('Ação cancelada'); }}>
              <X className="h-3 w-3 mr-1" /> Cancelar {tool.kind}
            </Button>
          )}
          {loading && <span className="text-xs text-muted-foreground">Carregando…</span>}
          {erro && <span className="text-xs text-destructive">{erro}</span>}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Map */}
          <div ref={containerRef} className="flex-1 relative" />

          {/* Side panel */}
          <div className="w-80 border-l bg-card overflow-y-auto p-3 text-sm">
            {!selectedTrecho && !selectedPv && (
              <div className="text-muted-foreground text-xs">
                Selecione um trecho ou PV no mapa para editar. Seleção obrigatória antes de qualquer ação.
              </div>
            )}
            {selectedTrecho && (
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Trecho ({selectedTrecho.tipo})</div>
                    <div className="text-base font-semibold">{selectedTrecho.rotulo}</div>
                  </div>
                  <button onClick={() => setSelectedTrechoId(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                {selectedTrecho.original && (
                  <div className="text-xs text-muted-foreground mb-1">Rótulo original: {selectedTrecho.original.rotulo_original}</div>
                )}
                <div className="text-xs">Extensão original: <b>{selectedTrecho.original?.l_escala != null ? Number(selectedTrecho.original.l_escala).toFixed(2) : '—'} m</b></div>
                <div className="text-xs">Extensão operacional: <b>{selectedTrecho.extensao_m != null ? Number(selectedTrecho.extensao_m).toFixed(2) : '—'} m</b></div>
                <div className="text-xs">DN: {selectedTrecho.dn ?? '—'} · {selectedTrecho.material ?? '—'}</div>
                <div className="text-xs mt-2">PVs: {pvsEfetivos.find((p) => p.op_id === selectedTrecho.pv_inicial_id || p.id === selectedTrecho.pv_inicial_id)?.rotulo ?? '—'} → {pvsEfetivos.find((p) => p.op_id === selectedTrecho.pv_final_id || p.id === selectedTrecho.pv_final_id)?.rotulo ?? '—'}</div>
                <div className="text-xs mt-2">
                  Status agregado: <b style={{ color: STATUS_COLORS[infoSelected?.status ?? 'CINZA'] }}>{infoSelected?.status ?? 'CINZA'}</b>
                </div>
                <div className="text-xs mt-1">
                  N.S. vinculadas:
                  <ul className="pl-4 list-disc">
                    {(infoSelected?.osList ?? []).length === 0 && <li className="text-muted-foreground">nenhuma</li>}
                    {(infoSelected?.osList ?? []).map((o) => (
                      <li key={o.id}>{o.trecho} ({o.bacia}) — <span style={{ color: STATUS_COLORS[o.status] }}>{o.status}</span>{o.pv_final_assentado ? ' · PV final ✓' : ''}</li>
                    ))}
                  </ul>
                </div>
                {infoSelected?.pvFinal && (
                  <div className="text-xs mt-1 p-2 bg-blue-50 text-blue-800 rounded">PV final assentado — pronto para Topografia</div>
                )}
                <div className="mt-3 flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => setVincularOpen(true)}><Link2 className="h-3 w-3 mr-1" /> Vincular / desvincular N.S.</Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setTool({ kind: 'add-pv', trechoId: selectedTrecho.id });
                    toast.info('Clique sobre a linha para adicionar o PV');
                  }}><Split className="h-3 w-3 mr-1" /> Adicionar PV (dividir)</Button>
                  <Button size="sm" variant="outline" onClick={() => setSuprimirTrechoOpen(true)}><Trash2 className="h-3 w-3 mr-1" /> Suprimir trecho</Button>
                  {selectedTrecho.op_id && (
                    <Button size="sm" variant="ghost" onClick={acaoRestaurarOriginal}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar original</Button>
                  )}
                </div>
              </div>
            )}
            {selectedPv && (
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs text-muted-foreground">PV ({selectedPv.tipo})</div>
                    <div className="text-base font-semibold">{selectedPv.rotulo}</div>
                  </div>
                  <button onClick={() => setSelectedPvId(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="text-xs">Lat/Lon: {selectedPv.lat.toFixed(6)}, {selectedPv.lon.toFixed(6)}</div>
                <div className="mt-3 flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const newLatStr = prompt('Nova latitude:', String(selectedPv.lat)); if (!newLatStr) return;
                    const newLonStr = prompt('Nova longitude:', String(selectedPv.lon)); if (!newLonStr) return;
                    const to: Coord = [Number(newLonStr), Number(newLatStr)];
                    acaoMoverPvIniciar(selectedPv.id, to);
                  }}><Move className="h-3 w-3 mr-1" /> Mover PV (por coordenadas)</Button>
                  <Button size="sm" variant="outline" onClick={acaoSuprimirPvSimples}><Trash2 className="h-3 w-3 mr-1" /> Suprimir PV</Button>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Dica: para mover por arraste no mapa, use a ação acima e ajuste; futuras versões trarão arraste direto.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vincular N.S. modal */}
      <VincularNSDialog
        open={vincularOpen}
        onClose={() => setVincularOpen(false)}
        onConfirm={acaoVincularNS}
        allOs={ordens}
        currentIds={(infoSelected?.osList ?? []).map((o) => o.id)}
        bacia={selectedTrecho ? 'SS-08' : ''}
      />

      {/* Dividir */}
      <DividirDialog
        open={!!dividirOpen}
        rotuloBase={selectedTrecho?.rotulo ?? ''}
        onClose={() => setDividirOpen(null)}
        onConfirm={acaoDividirTrecho}
      />

      {/* Mover PV confirmação */}
      <Dialog open={!!moverConfirm} onOpenChange={(o) => !o && setMoverConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar movimentação do PV</DialogTitle>
            <DialogDescription>
              Deslocamento: <b>{moverConfirm?.deltaM.toFixed(2)} m</b>
              {moverConfirm && moverConfirm.deltaM > 10 && (
                <span className="ml-2 inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> Deslocamento superior a 10 m — justificativa obrigatória</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            Trechos afetados: {moverConfirm?.trechosAfetados.join(', ') || 'nenhum'}
          </div>
          <MoverJustificativa
            requerJustificativa={(moverConfirm?.deltaM ?? 0) > 10}
            onConfirm={acaoMoverPvConfirmar}
            onCancel={() => setMoverConfirm(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Suprimir trecho */}
      <SuprimirTrechoDialog
        open={suprimirTrechoOpen}
        onClose={() => setSuprimirTrechoOpen(false)}
        onConfirm={acaoSuprimirTrecho}
      />

      {/* Suprimir PV bloqueio */}
      <Dialog open={!!suprimirPvOpen} onOpenChange={(o) => !o && setSuprimirPvOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PV possui trechos conectados</DialogTitle>
            <DialogDescription>
              Não é possível excluir diretamente. Trechos: {suprimirPvOpen?.trechosConectados.join(', ')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={acaoUnirTrechos}>Unir dois trechos conectados (se forem exatamente 2)</Button>
            <Button variant="ghost" onClick={() => setSuprimirPvOpen(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual */}
      <ManualDialog
        open={!!manualOpen}
        onClose={() => setManualOpen(null)}
        onConfirm={acaoCriarManual}
      />
    </AppLayout>
  );
};

// ============ Subcomponentes de diálogo ============

const VincularNSDialog = ({ open, onClose, onConfirm, allOs, currentIds, bacia }: {
  open: boolean; onClose: () => void;
  onConfirm: (ids: string[], motivo: string) => void;
  allOs: { id: string; trecho: string; bacia: string; status: OSStatus }[];
  currentIds: string[]; bacia: string;
}) => {
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [motivo, setMotivo] = useState('');
  const [q, setQ] = useState('');
  const [allBacia, setAllBacia] = useState<{ id: string; trecho: string; bacia: string; status: OSStatus }[]>([]);
  useEffect(() => { setSelected(currentIds); setMotivo(''); }, [open, currentIds]);
  useEffect(() => {
    if (!open) return;
    supabase.from('ordens_servico').select('id, trecho, bacia, status').eq('bacia', bacia || 'SS-08').limit(2000).then(({ data }) => setAllBacia((data ?? []) as any));
  }, [open, bacia]);
  const lista = useMemo(() => {
    const src = allBacia.length ? allBacia : allOs;
    const ql = q.toLowerCase();
    return src.filter((o) => !ql || o.trecho.toLowerCase().includes(ql)).slice(0, 200);
  }, [allOs, allBacia, q]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Vincular N.S. ao trecho</DialogTitle></DialogHeader>
        <Input placeholder="Filtrar por trecho…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 overflow-auto border rounded">
          {lista.map((o) => (
            <label key={o.id} className="flex items-center gap-2 p-1.5 border-b last:border-0 text-sm hover:bg-muted/40">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => {
                setSelected((prev) => e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id));
              }} />
              <span className="flex-1">{o.trecho} <span className="text-muted-foreground">({o.bacia})</span></span>
              <span className="text-xs" style={{ color: STATUS_COLORS[o.status] }}>{o.status}</span>
            </label>
          ))}
        </div>
        <div>
          <Label className="text-xs">Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: substituição por aditivo" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(selected, motivo)}>Salvar vínculos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DividirDialog = ({ open, rotuloBase, onClose, onConfirm }: {
  open: boolean; rotuloBase: string; onClose: () => void;
  onConfirm: (a: string, b: string, novoPv: string, cota: string, prof: string) => void;
}) => {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [pv, setPv] = useState('');
  const [cota, setCota] = useState(''); const [prof, setProf] = useState('');
  useEffect(() => { if (open) { setA(`${rotuloBase}.1`); setB(`${rotuloBase}.2`); setPv(''); setCota(''); setProf(''); } }, [open, rotuloBase]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dividir trecho — adicionar PV</DialogTitle>
          <DialogDescription>Novo PV será snapado sobre a linha. Extensões serão recalculadas.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Rótulo do novo PV</Label><Input value={pv} onChange={(e) => setPv(e.target.value)} /></div>
          <div><Label>Segmento A — rótulo</Label><Input value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div><Label>Segmento B — rótulo</Label><Input value={b} onChange={(e) => setB(e.target.value)} /></div>
          <div><Label>Cota (opc.)</Label><Input value={cota} onChange={(e) => setCota(e.target.value)} /></div>
          <div><Label>Profundidade (opc.)</Label><Input value={prof} onChange={(e) => setProf(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!pv || !a || !b} onClick={() => onConfirm(a, b, pv, cota, prof)}>Dividir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SuprimirTrechoDialog = ({ open, onClose, onConfirm }: {
  open: boolean; onClose: () => void; onConfirm: (motivo: string) => void;
}) => {
  const [motivo, setMotivo] = useState('');
  useEffect(() => { if (open) setMotivo(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Suprimir trecho</DialogTitle><DialogDescription>PVs permanecem. Geometria original é preservada.</DialogDescription></DialogHeader>
        <Label>Motivo</Label>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!motivo.trim()} onClick={() => onConfirm(motivo)}>Suprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MoverJustificativa = ({ requerJustificativa, onConfirm, onCancel }: {
  requerJustificativa: boolean; onConfirm: (j: string) => void; onCancel: () => void;
}) => {
  const [j, setJ] = useState('');
  return (
    <div>
      {requerJustificativa && (
        <>
          <Label>Justificativa (obrigatória)</Label>
          <Textarea value={j} onChange={(e) => setJ(e.target.value)} />
        </>
      )}
      <DialogFooter className="mt-3">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button disabled={requerJustificativa && !j.trim()} onClick={() => onConfirm(j)}>Confirmar movimentação</Button>
      </DialogFooter>
    </div>
  );
};

const ManualDialog = ({ open, onClose, onConfirm }: {
  open: boolean; onClose: () => void;
  onConfirm: (rotulo: string, dn: string, material: string) => void;
}) => {
  const [rotulo, setRotulo] = useState(''); const [dn, setDn] = useState(''); const [mat, setMat] = useState('');
  useEffect(() => { if (open) { setRotulo(''); setDn(''); setMat(''); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo trecho manual</DialogTitle><DialogDescription>Entre os PVs selecionados. Sinalizado como “Geometria operacional manual”.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Rótulo</Label><Input value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder="Ex: Linha de Recalque" /></div>
          <div><Label>DN</Label><Input value={dn} onChange={(e) => setDn(e.target.value)} /></div>
          <div><Label>Material</Label><Input value={mat} onChange={(e) => setMat(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!rotulo} onClick={() => onConfirm(rotulo, dn, mat)}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditorOperacionalPage;
