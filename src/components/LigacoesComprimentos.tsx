import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  osId: string;
}

function fmtMetros(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const LigacoesComprimentos = ({ osId }: Props) => {
  const [comprimentos, setComprimentos] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('ligacoes')
        .select('comprimento, created_at')
        .eq('os_id', osId)
        .not('comprimento', 'is', null)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const vals = (data ?? [])
        .map((l: any) => Number(l.comprimento))
        .filter((n) => Number.isFinite(n) && n > 0);
      setComprimentos(vals);
    })();
    return () => { cancelled = true; };
  }, [osId]);

  if (comprimentos.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">
        Comprimento das Ligações
      </p>
      <ul className="space-y-0.5">
        {comprimentos.map((c, i) => (
          <li key={i} className="text-xs text-foreground">
            Ligação {i + 1} - Comp. <span className="font-medium">{fmtMetros(c)} m</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
