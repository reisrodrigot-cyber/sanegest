import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OSStatus } from '@/types/sanegest';
import { aggregateVinculosStatus, type OSDisplayStatus } from '@/lib/osStatus';

export type Coord = [number, number]; // [lon, lat]

export interface PVOriginal {
  id: string;
  rotulo_original: string;
  tipo_no: string;
  lon: number;
  lat: number;
  cota_marg: number | null;
  cota_inv: number | null;
  prof: number | null;
}

export interface TrechoOriginal {
  id: string;
  rotulo_original: string;
  no_inicial: string | null;
  no_final: string | null;
  dn: number | null;
  material: string | null;
  l_escala: number | null;
  geometry: any;
}

export interface PVOperacional {
  id: string;
  base_id: string;
  ponto_origem_id: string | null;
  rotulo: string;
  tipo: 'original' | 'movido' | 'manual' | 'suprimido';
  geom: { type: 'Point'; coordinates: Coord };
  lat: number;
  lon: number;
  cota: number | null;
  profundidade: number | null;
  observacao: string | null;
  motivo: string | null;
}

export interface TrechoOperacional {
  id: string;
  base_id: string;
  trecho_origem_id: string | null;
  rotulo: string;
  tipo: 'original' | 'derivado' | 'manual' | 'suprimido';
  pv_inicial_id: string;
  pv_final_id: string;
  geom: { type: 'LineString'; coordinates: Coord[] };
  extensao_m: number | null;
  dn: number | null;
  material: string | null;
  motivo: string | null;
}

export interface VinculoOS {
  id: string;
  trecho_id: string | null;
  trecho_operacional_id: string | null;
  os_id: string;
  origem: string;
  ativo: boolean;
}

export interface OSInfo {
  id: string;
  trecho: string;
  bacia: string;
  status: OSStatus;
  pv_final_assentado: boolean;
}

export interface BaseInfo {
  id: string;
  ss: string;
  versao: number;
  status: string;
}

export function useEditorOperacional(enabled: boolean) {
  const [base, setBase] = useState<BaseInfo | null>(null);
  const [trechosOriginais, setTrechosOriginais] = useState<TrechoOriginal[]>([]);
  const [pvsOriginais, setPvsOriginais] = useState<PVOriginal[]>([]);
  const [pvsOp, setPvsOp] = useState<PVOperacional[]>([]);
  const [trechosOp, setTrechosOp] = useState<TrechoOperacional[]>([]);
  const [vinculos, setVinculos] = useState<VinculoOS[]>([]);
  const [ordens, setOrdens] = useState<OSInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setErro(null);
    try {
      const { data: b } = await supabase
        .from('mapa_bases' as any)
        .select('id, ss, versao, status')
        .eq('ss', 'SS-08')
        .in('status', ['preview', 'ativa'])
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!b) { setBase(null); return; }
      const baseRow = b as any as BaseInfo;
      setBase(baseRow);

      const [{ data: tOrig }, { data: pOrig }, { data: pOp }, { data: tOp }, { data: vinc }] = await Promise.all([
        supabase.from('mapa_trechos' as any)
          .select('id, rotulo_original, no_inicial, no_final, dn, material, l_escala, geometry')
          .eq('base_id', baseRow.id),
        supabase.from('mapa_pontos' as any)
          .select('id, rotulo_original, tipo_no, cota_marg, cota_inv, prof, lon, lat')
          .eq('base_id', baseRow.id)
          .not('lon', 'is', null),
        supabase.from('mapa_pv_operacional' as any)
          .select('*')
          .eq('base_id', baseRow.id),
        supabase.from('mapa_trecho_operacional' as any)
          .select('*')
          .eq('base_id', baseRow.id),
        supabase.from('mapa_trecho_os' as any)
          .select('id, trecho_id, trecho_operacional_id, os_id, origem, ativo')
          .eq('ativo', true),
      ]);

      setTrechosOriginais((tOrig ?? []) as any);
      setPvsOriginais((pOrig ?? []) as any);
      setPvsOp((pOp ?? []) as any);
      setTrechosOp((tOp ?? []) as any);
      setVinculos((vinc ?? []) as any);

      const osIds = Array.from(new Set(((vinc ?? []) as any[]).map((v) => v.os_id)));
      if (osIds.length) {
        const [{ data: osData }, { data: regs }] = await Promise.all([
          supabase.from('ordens_servico').select('id, trecho, bacia, status').in('id', osIds),
          supabase.from('registros_producao').select('os_id').in('os_id', osIds).eq('pv_final_assentado', true).eq('excluido', false).eq('status', 'ativo'),
        ]);
        const pvSet = new Set((regs ?? []).map((r: any) => r.os_id));
        setOrdens(((osData ?? []) as any[]).map((o) => ({
          id: o.id, trecho: o.trecho, bacia: o.bacia, status: o.status,
          pv_final_assentado: pvSet.has(o.id),
        })));
      } else setOrdens([]);
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar editor operacional');
    } finally { setLoading(false); }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  // Effective PVs: operacional shadows original
  const pvsEfetivos = useMemo(() => {
    const opByOrigem = new Map<string, PVOperacional>();
    const opNovos: PVOperacional[] = [];
    for (const p of pvsOp) {
      if (p.ponto_origem_id) opByOrigem.set(p.ponto_origem_id, p);
      else opNovos.push(p);
    }
    type Efetivo = {
      id: string; // opId if exists, else origId
      rotulo: string;
      lat: number; lon: number;
      tipo: 'original' | 'movido' | 'manual' | 'suprimido';
      origem_id: string | null;
      op_id: string | null;
      original?: PVOriginal;
      op?: PVOperacional;
    };
    const out: Efetivo[] = [];
    for (const p of pvsOriginais) {
      const op = opByOrigem.get(p.id);
      if (op) {
        out.push({
          id: op.id, rotulo: op.rotulo, lat: op.lat, lon: op.lon, tipo: op.tipo,
          origem_id: p.id, op_id: op.id, original: p, op,
        });
      } else {
        out.push({
          id: p.id, rotulo: p.rotulo_original, lat: p.lat, lon: p.lon, tipo: 'original',
          origem_id: p.id, op_id: null, original: p,
        });
      }
    }
    for (const p of opNovos) {
      out.push({
        id: p.id, rotulo: p.rotulo, lat: p.lat, lon: p.lon, tipo: p.tipo,
        origem_id: null, op_id: p.id, op: p,
      });
    }
    return out;
  }, [pvsOriginais, pvsOp]);

  // Effective trechos
  const trechosEfetivos = useMemo(() => {
    const opByOrigem = new Map<string, TrechoOperacional>();
    const opNovos: TrechoOperacional[] = [];
    for (const t of trechosOp) {
      if (t.trecho_origem_id && (t.tipo === 'original' || t.tipo === 'suprimido')) {
        opByOrigem.set(t.trecho_origem_id, t);
      } else opNovos.push(t);
    }
    type Efetivo = {
      id: string;
      rotulo: string;
      geometry: any;
      tipo: 'original' | 'derivado' | 'manual' | 'suprimido';
      origem_id: string | null;
      op_id: string | null;
      pv_inicial_id: string | null;
      pv_final_id: string | null;
      extensao_m: number | null;
      dn: number | null;
      material: string | null;
      original?: TrechoOriginal;
      op?: TrechoOperacional;
    };
    const out: Efetivo[] = [];
    for (const t of trechosOriginais) {
      const op = opByOrigem.get(t.id);
      if (op) {
        out.push({
          id: op.id, rotulo: op.rotulo, geometry: op.geom, tipo: op.tipo,
          origem_id: t.id, op_id: op.id,
          pv_inicial_id: op.pv_inicial_id, pv_final_id: op.pv_final_id,
          extensao_m: op.extensao_m, dn: op.dn, material: op.material,
          original: t, op,
        });
      } else {
        out.push({
          id: t.id, rotulo: t.rotulo_original, geometry: t.geometry, tipo: 'original',
          origem_id: t.id, op_id: null,
          pv_inicial_id: null, pv_final_id: null,
          extensao_m: t.l_escala, dn: t.dn, material: t.material,
          original: t,
        });
      }
    }
    for (const t of opNovos) {
      out.push({
        id: t.id, rotulo: t.rotulo, geometry: t.geom, tipo: t.tipo,
        origem_id: t.trecho_origem_id, op_id: t.id,
        pv_inicial_id: t.pv_inicial_id, pv_final_id: t.pv_final_id,
        extensao_m: t.extensao_m, dn: t.dn, material: t.material,
        op: t,
      });
    }
    return out;
  }, [trechosOriginais, trechosOp]);

  // Status por trecho
  const statusPorTrecho = useMemo(() => {
    const osById = new Map(ordens.map((o) => [o.id, o]));
    const m = new Map<string, { status: OSDisplayStatus; pvFinal: boolean; osList: OSInfo[] }>();
    for (const t of trechosEfetivos) {
      const vs = vinculos.filter((v) =>
        (t.op_id && v.trecho_operacional_id === t.op_id)
        || (!t.op_id && v.trecho_id === t.origem_id)
      );
      const osList = vs.map((v) => osById.get(v.os_id)).filter(Boolean) as OSInfo[];
      const status = aggregateVinculosStatus(osList);
      const pvFinal = osList.some((o) => o.pv_final_assentado);
      m.set(t.id, { status, pvFinal, osList });
    }
    return m;
  }, [trechosEfetivos, vinculos, ordens]);

  return {
    base, loading, erro, reload: load,
    trechosOriginais, pvsOriginais,
    pvsOp, trechosOp, vinculos, ordens,
    pvsEfetivos, trechosEfetivos, statusPorTrecho,
  };
}
