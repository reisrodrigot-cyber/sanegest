import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OSStatus } from '@/types/sanegest';

export type MapaTrechoPreview = {
  id: string;
  ss: string;
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
  ss: string;
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

/**
 * Carrega TODAS as bases ativas (uma por SS) via `get_mapa_publico`, agregando
 * trechos e pontos com marcação da SS de origem para permitir toggle individual.
 */
export function useMapaBasePreview(canView: boolean) {
  const [bases, setBases] = useState<MapaBasePreview[]>([]);
  const [trechos, setTrechos] = useState<MapaTrechoPreview[]>([]);
  const [pontos, setPontos] = useState<MapaPontoPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErro(null);
    try {
      const { data: basesRows, error: basesErr } = await supabase
        .from('mapa_bases' as any)
        .select('ss')
        .in('status', ['ativa', 'preview'])
        .order('ss', { ascending: true });
      if (basesErr) throw basesErr;
      const sses = Array.from(new Set(((basesRows ?? []) as any[]).map((r) => r.ss as string)));
      if (!sses.length) { setBases([]); setTrechos([]); setPontos([]); return; }

      const results = await Promise.all(
        sses.map(async (ss) => {
          const { data, error } = await supabase.rpc('get_mapa_publico' as any, { _ss: ss });
          if (error) throw error;
          return { ss, payload: (data ?? {}) as any };
        })
      );

      const allBases: MapaBasePreview[] = [];
      const allTrechos: MapaTrechoPreview[] = [];
      const allPontos: MapaPontoPreview[] = [];

      for (const { ss, payload } of results) {
        if (!payload.base) continue;
        allBases.push(payload.base as MapaBasePreview);

        const trArr: any[] = payload.trechos ?? [];
        for (const t of trArr) {
          allTrechos.push({
            id: t.id,
            ss,
            rotulo_original: t.rotulo,
            no_inicial: null,
            no_final: null,
            dn: t.dn,
            material: t.material,
            l_escala: t.extensao_m,
            geometry: t.geometry,
            vinculos: (t.vinculos ?? []).map((v: any) => ({
              os_id: v.os_id,
              trecho: v.trecho,
              bacia: v.bacia,
              status: v.status as OSStatus,
              origem: 'AUTO',
              pv_final_assentado: !!v.pv_final_assentado,
            })),
            divergencias: [],
          });
        }

        const pArr: any[] = payload.pontos ?? [];
        for (const p of pArr) {
          allPontos.push({
            id: p.id,
            ss,
            rotulo_original: p.rotulo,
            tipo_no: p.tipo_no ?? '',
            cota_marg: p.cota,
            cota_inv: null,
            prof: p.prof,
            lon: Number(p.lon),
            lat: Number(p.lat),
          });
        }
      }

      setBases(allBases);
      setTrechos(allTrechos);
      setPontos(allPontos);
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar mapa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) { setBases([]); setTrechos([]); setPontos([]); return; }
    load();
    const ch = supabase
      .channel('mapa-base-preview')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ordens_servico' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  return { bases, trechos, pontos, loading, erro, reload: load };
}
