import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  calcularPrevistoPorSubBacia,
  calcularRealizadoPorSubBacia,
  consolidarAvanco,
  type AvancoConsolidado,
  type OrdemLike,
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
  recarregar: () => void;
}

/**
 * Fonte única do Avanço Físico: realizado vem dos dados reais já usados no
 * Dashboard (view relatorio_producao_diaria) e previsto vem exclusivamente da
 * soma das N.S. vigentes por sub-bacia (plano operacional).
 */
export function useAvancoFisico(ordens: OrdemLike[]): UseAvancoFisicoResult {
  const [relatorio, setRelatorio] = useState<RelatorioLike[]>([]);
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
        const rows = await fetchAllPaged<RelatorioLike>((from, to) =>
          supabase
            .from('relatorio_producao_diaria')
            .select('os_id, obra_nome, trecho, data_producao, comprimento_trecho_executado, quantidade_ligacoes_realizadas, comprimento_total_ligacoes, pv_final_assentado')
            .order('data_producao', { ascending: true })
            .range(from, to),
        );
        if (cancelado) return;
        setRelatorio(rows);
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
    const previsto = calcularPrevistoPorSubBacia(ordens);
    return consolidarAvanco(realizado, previsto);
  }, [relatorio, ordens]);

  return { ...consolidado, loading, error, recarregar };
}
