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

/**
 * Carrega a base preview mais recente da SS-08 através da RPC segura `get_mapa_publico`.
 * Essa RPC devolve apenas dados sanitizados (sem motivos, justificativas, vínculos inativos
 * ou trechos suprimidos), unificando geometria original + camada operacional efetiva.
 */
export function useMapaBasePreview(canView: boolean) {
  const [base, setBase] = useState<MapaBasePreview | null>(null);
  const [trechos, setTrechos] = useState<MapaTrechoPreview[]>([]);
  const [pontos, setPontos] = useState<MapaPontoPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErro(null);
    try {
      const { data, error } = await supabase.rpc('get_mapa_publico' as any, { _ss: 'SS-08' });
      if (error) throw error;
      const payload: any = data ?? {};
      if (!payload.base) { setBase(null); setTrechos([]); setPontos([]); return; }
      setBase(payload.base as MapaBasePreview);

      const trArr: any[] = payload.trechos ?? [];
      const trechosFinal: MapaTrechoPreview[] = trArr.map((t) => ({
        id: t.id,
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
      }));
      setTrechos(trechosFinal);

      const pArr: any[] = payload.pontos ?? [];
      setPontos(pArr.map((p) => ({
        id: p.id,
        rotulo_original: p.rotulo,
        tipo_no: p.tipo_no ?? '',
        cota_marg: p.cota,
        cota_inv: null,
        prof: p.prof,
        lon: Number(p.lon),
        lat: Number(p.lat),
      })));
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao carregar mapa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) { setBase(null); setTrechos([]); setPontos([]); return; }
    load();
    // Recarrega quando N.S. mudarem (status/pv_final) — não escutamos mapa_trecho_os
    // porque a RPC já reflete o estado atual e essa tabela é restrita à Sala Técnica.
    const ch = supabase
      .channel('mapa-base-preview')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ordens_servico' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  return { base, trechos, pontos, loading, erro, reload: load };
}
