import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OSStatus } from '@/types/sanegest';

export type MapaTrechoPreview = {
  id: string;
  rotulo_original: string;
  no_inicial: string | null;
  no_final: string | null;
  dn: number | null;
  material: string | null;
  l_escala: number | null;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
  vinculos: Array<{
    os_id: string;
    trecho: string;
    bacia: string;
    status: OSStatus;
    origem: 'AUTO' | 'MANUAL';
    pv_final_assentado: boolean | null;
  }>;
  divergencias: Array<{ tipo: string; detalhes: any }>;
};

export type MapaPontoPreview = {
  id: string;
  rotulo_original: string;
  tipo_no: string;
  cota_marg: number | null;
  cota_inv: number | null;
  prof: number | null;
  lon: number;
  lat: number;
};

export type MapaBasePreview = {
  id: string;
  ss: string;
  versao: number;
  status: string;
  bbox: { min_lon: number; min_lat: number; max_lon: number; max_lat: number } | null;
  feicoes_rede: number;
  feicoes_pv: number;
};

const STATUS_PRECEDENCIA: OSStatus[] = ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'CINZA'];

export function statusAgregado(statuses: OSStatus[]): OSStatus {
  if (!statuses.length) return 'CINZA';
  for (const s of STATUS_PRECEDENCIA) if (statuses.includes(s)) return s;
  return 'CINZA';
}

/** Carrega a base preview mais recente da SS-08. Nesta fase, apenas SS-08. */
export function useMapaBasePreview(canView: boolean) {
  const [base, setBase] = useState<MapaBasePreview | null>(null);
  const [trechos, setTrechos] = useState<MapaTrechoPreview[]>([]);
  const [pontos, setPontos] = useState<MapaPontoPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErro(null);
    try {
      const { data: b } = await supabase
        .from('mapa_bases' as any)
        .select('id, ss, versao, status, bbox, feicoes_rede, feicoes_pv')
        .eq('ss', 'SS-08')
        .in('status', ['preview', 'ativa'])
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!b) { setBase(null); setTrechos([]); setPontos([]); return; }
      const baseRow = b as any as MapaBasePreview;
      setBase(baseRow);

      const [{ data: tData }, { data: pData }, { data: vinc }, { data: divs }] = await Promise.all([
        supabase.from('mapa_trechos' as any)
          .select('id, rotulo_original, no_inicial, no_final, dn, material, l_escala, geometry')
          .eq('base_id', baseRow.id),
        supabase.from('mapa_pontos' as any)
          .select('id, rotulo_original, tipo_no, cota_marg, cota_inv, prof, lon, lat')
          .eq('base_id', baseRow.id)
          .not('lon', 'is', null),
        supabase.from('mapa_trecho_os' as any)
          .select('trecho_id, os_id, origem')
          .eq('ativo', true),
        supabase.from('mapa_divergencias' as any)
          .select('tipo, detalhes')
          .eq('base_id', baseRow.id)
          .eq('status', 'aberta'),
      ]);

      const trechosArr = (tData ?? []) as any[];
      const vincArr = (vinc ?? []) as any[];
      const trechoIds = new Set(trechosArr.map((t) => t.id));
      const vincDoBase = vincArr.filter((v) => trechoIds.has(v.trecho_id));
      const osIds = [...new Set(vincDoBase.map((v) => v.os_id))];

      let osMap = new Map<string, any>();
      const pvFinalSet = new Set<string>();
      if (osIds.length) {
        const [{ data: osData }, { data: regs }] = await Promise.all([
          supabase.from('ordens_servico')
            .select('id, trecho, bacia, status')
            .in('id', osIds),
          supabase.from('registros_producao')
            .select('os_id')
            .in('os_id', osIds)
            .eq('pv_final_assentado', true),
        ]);
        osMap = new Map((osData ?? []).map((o) => [o.id, o]));
        for (const r of (regs ?? []) as any[]) pvFinalSet.add(r.os_id);
      }


      // divergências por trecho
      const divPorTrecho = new Map<string, Array<{ tipo: string; detalhes: any }>>();
      for (const d of (divs ?? []) as any[]) {
        const tid = d.detalhes?.trecho_id;
        if (!tid) continue;
        const arr = divPorTrecho.get(tid) ?? [];
        arr.push({ tipo: d.tipo, detalhes: d.detalhes });
        divPorTrecho.set(tid, arr);
      }

      const trechosFinal: MapaTrechoPreview[] = trechosArr.map((t) => {
        const vs = vincDoBase
          .filter((v) => v.trecho_id === t.id)
          .map((v) => {
            const os = osMap.get(v.os_id);
            return os ? {
              os_id: os.id,
              trecho: os.trecho,
              bacia: os.bacia,
              status: os.status as OSStatus,
              origem: v.origem as 'AUTO' | 'MANUAL',
              pv_final_assentado: pvFinalSet.has(os.id),
            } : null;

          })
          .filter(Boolean) as MapaTrechoPreview['vinculos'];
        return {
          id: t.id,
          rotulo_original: t.rotulo_original,
          no_inicial: t.no_inicial,
          no_final: t.no_final,
          dn: t.dn,
          material: t.material,
          l_escala: t.l_escala,
          geometry: t.geometry,
          vinculos: vs,
          divergencias: divPorTrecho.get(t.id) ?? [],
        };
      });
      setTrechos(trechosFinal);
      setPontos((pData ?? []) as any);
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar base preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) { setBase(null); setTrechos([]); setPontos([]); return; }
    load();
    const ch = supabase
      .channel('mapa-base-preview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_bases' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_trecho_os' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ordens_servico' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  return { base, trechos, pontos, loading, erro, reload: load };
}
