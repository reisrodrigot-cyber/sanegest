import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function usePendingMateriaisCount() {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    const { count: c, error } = await supabase
      .from('ordens_servico')
      .select('*', { count: 'exact', head: true })
      .eq('liberado', true)
      .eq('status', 'VERMELHO');
    if (!error && c != null) setCount(c);
  };

  useEffect(() => {
    fetchCount();

    const channel = supabase
      .channel('materiais-pendentes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ordens_servico',
        },
        (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          // NS just became VERMELHO → notify
          if (newRow.status === 'VERMELHO' && oldRow.status !== 'VERMELHO' && newRow.liberado) {
            const encarregado = newRow.executor || newRow.liberado_para || 'Não definido';
            toast.info(`Nova NS pendente de material: ${newRow.trecho} — Encarregado: ${encarregado}`, {
              duration: 8000,
            });
          }

          // Recount on any status change
          if (oldRow.status !== newRow.status || oldRow.liberado !== newRow.liberado) {
            fetchCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
