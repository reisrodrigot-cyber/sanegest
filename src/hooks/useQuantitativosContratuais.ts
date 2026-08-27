import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizarBaciaChave } from '@/lib/avancoFisico';

export interface QuantitativoContratual {
  chave: string;
  exibicao: string;
  redeM: number | null;
  ramaisUn: number | null;
  ramaisM: number | null;
  lrM: number | null;
}


/**
 * Quantidades contratuais manuais por sub-bacia (tabela quantitativos_referencia).
 * Referência visual apenas — nunca entra em previsto/realizado/saldo/%.
 */
export function useQuantitativosContratuais() {
  const [rows, setRows] = useState<QuantitativoContratual[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const recarregar = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('quantitativos_referencia')
        .select('bacia_chave, bacia_exibicao, rede_prevista_metros, ramais_previstos_unidades, ramais_previstos_metros, linha_recalque_prevista_metros');
      if (cancelado) return;
      setRows(
        (data ?? []).map((r: any) => ({
          chave: normalizarBaciaChave(r.bacia_chave),
          exibicao: r.bacia_exibicao ?? r.bacia_chave,
          redeM: Number(r.rede_prevista_metros) > 0 ? Number(r.rede_prevista_metros) : null,
          ramaisUn: Number(r.ramais_previstos_unidades) > 0 ? Number(r.ramais_previstos_unidades) : null,
          ramaisM: Number(r.ramais_previstos_metros) > 0 ? Number(r.ramais_previstos_metros) : null,
          lrM: Number(r.linha_recalque_prevista_metros) > 0 ? Number(r.linha_recalque_prevista_metros) : null,
        })),
      );
      setLoading(false);

    })();
    return () => { cancelado = true; };
  }, [tick]);

  const porChave = useMemo(() => {
    const m = new Map<string, QuantitativoContratual>();
    rows.forEach((r) => m.set(r.chave, r));
    return m;
  }, [rows]);

  const salvar = useCallback(
    async (items: { chave: string; exibicao: string; redeM: number | null; ramaisUn: number | null; ramaisM: number | null; lrM: number | null }[]) => {
      const payload = items.map((i) => ({
        bacia_chave: i.chave,
        bacia_exibicao: i.exibicao,
        rede_prevista_metros: i.redeM ?? 0,
        ramais_previstos_unidades: i.ramaisUn ?? 0,
        ramais_previstos_metros: i.ramaisM ?? 0,
        linha_recalque_prevista_metros: i.lrM ?? 0,
      }));

      if (payload.length === 0) return { error: null };
      const { error } = await supabase
        .from('quantitativos_referencia')
        .upsert(payload, { onConflict: 'bacia_chave' });
      if (!error) recarregar();
      return { error };
    },
    [recarregar],
  );

  return { porChave, loading, salvar, recarregar };
}
