import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  calcularRealizadoPorSubBacia,
  consolidarAvanco,
  normalizarBaciaChave,
  type AvancoConsolidado,
  type OrdemLike,
  type ReferenciaSubBacia,
  type RelatorioLike,
} from '@/lib/avancoFisico';

const fetchAllPaged = async <T,>(build: (from: number, to: number) => any): Promise<T[]> => {
  const all: T[] = [];
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) break;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

export interface UseAvancoFisicoResult extends AvancoConsolidado {
  loading: boolean;
  error: string | null;
  referencias: ReferenciaSubBacia[];
  salvarReferencia: (input: {
    bacia_exibicao: string;
    rede_prevista_metros: number;
    ramais_previstos_unidades: number;
  }) => Promise<{ error?: string }>;
  recarregar: () => void;
}

/**
 * Fonte única do Avanço Físico: realizado vem dos dados reais já usados no
 * Dashboard (view relatorio_producao_diaria) e previsto vem exclusivamente da
 * referência manual (quantitativos_referencia).
 */
export function useAvancoFisico(ordens: OrdemLike[]): UseAvancoFisicoResult {
  const [relatorio, setRelatorio] = useState<RelatorioLike[]>([]);
  const [referencias, setReferencias] = useState<ReferenciaSubBacia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const recarregar = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [rows, refs] = await Promise.all([
          fetchAllPaged<RelatorioLike>((from, to) =>
            supabase
              .from('relatorio_producao_diaria')
              .select('os_id, obra_nome, trecho, data_producao, comprimento_trecho_executado, quantidade_ligacoes_realizadas, comprimento_total_ligacoes, pv_final_assentado')
              .order('data_producao', { ascending: true })
              .range(from, to),
          ),
          supabase
            .from('quantitativos_referencia')
            .select('id, bacia_chave, bacia_exibicao, rede_prevista_metros, ramais_previstos_unidades'),
        ]);
        if (refs.error) throw refs.error;
        if (cancelado) return;
        setRelatorio(rows);
        setReferencias((refs.data ?? []) as ReferenciaSubBacia[]);
      } catch (e: any) {
        if (!cancelado) setError(e?.message ?? 'Falha ao carregar avanço físico');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [tick]);

  const consolidado = useMemo(() => {
    const realizado = calcularRealizadoPorSubBacia(relatorio, ordens);
    return consolidarAvanco(realizado, referencias);
  }, [relatorio, ordens, referencias]);

  const salvarReferencia: UseAvancoFisicoResult['salvarReferencia'] = useCallback(async (input) => {
    const chave = normalizarBaciaChave(input.bacia_exibicao);
    if (!chave) return { error: 'Informe a sub-bacia.' };
    if (input.rede_prevista_metros < 0 || input.ramais_previstos_unidades < 0) {
      return { error: 'Valores não podem ser negativos.' };
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id ?? null;
    const { error: upErr } = await supabase
      .from('quantitativos_referencia')
      .upsert(
        {
          bacia_chave: chave,
          bacia_exibicao: input.bacia_exibicao.trim(),
          rede_prevista_metros: input.rede_prevista_metros,
          ramais_previstos_unidades: Math.round(input.ramais_previstos_unidades),
          updated_by: uid,
          created_by: uid,
        },
        { onConflict: 'bacia_chave' },
      );
    if (upErr) return { error: upErr.message };
    recarregar();
    return {};
  }, [recarregar]);

  return { ...consolidado, loading, error, referencias, salvarReferencia, recarregar };
}
