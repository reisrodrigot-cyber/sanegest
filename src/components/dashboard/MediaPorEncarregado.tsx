import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { resolverIdentidadeEncarregado } from '@/lib/encarregados';

interface Row {
  os_id: string;
  data_producao: string;
  responsavel_user_id: string | null;
  responsavel_nome: string | null;
  comprimento_trecho_executado: number | null;
}

export const MediaPorEncarregado = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Fonte canônica: a produção pertence ao encarregado operacional da N.S.
      // (liberado_para), nunca ao usuário que digitou o lançamento.
      const { data } = await supabase
        .from('relatorio_producao_diaria' as never)
        .select('os_id, data_producao, responsavel_user_id, responsavel_nome, comprimento_trecho_executado');
      setRows(((data ?? []) as unknown) as Row[]);
      setLoading(false);
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; days: Set<string> }>();
    rows.forEach((r) => {
      const comp = Number(r.comprimento_trecho_executado) || 0;
      if (comp <= 0) return;
      const identidade = resolverIdentidadeEncarregado({
        userId: r.responsavel_user_id,
        nome: r.responsavel_nome,
      });
      const cur = map.get(identidade.id) ?? { nome: identidade.nome, total: 0, days: new Set<string>() };
      cur.total += comp;
      cur.days.add(String(r.data_producao));
      map.set(identidade.id, cur);
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({
        userId: id,
        nome: v.nome,
        total: Math.round(v.total * 10) / 10,
        dias: v.days.size,
        media: v.days.size > 0 ? Math.round((v.total / v.days.size) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.media - a.media);
  }, [rows]);


  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
        <Loader2 className="animate-spin text-muted-foreground mx-auto" size={18} />
      </div>
    );
  }

  if (stats.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Média por Encarregado</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 font-medium">Encarregado</th>
              <th className="pb-2 font-medium text-right">Total (m)</th>
              <th className="pb-2 font-medium text-right">Dias trabalhados</th>
              <th className="pb-2 font-medium text-right">Média (m/dia)</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.userId} className="border-b border-border/50">
                <td className="py-2 text-foreground font-medium">{s.nome}</td>
                <td className="py-2 text-right text-muted-foreground">{s.total.toLocaleString('pt-BR')}</td>
                <td className="py-2 text-right text-muted-foreground">{s.dias}</td>
                <td className="py-2 text-right font-semibold text-foreground">{s.media.toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
