import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { aplicarRealValidadoEmRegistros, type OSRealInput } from '@/lib/realEfetivo';

interface Row {
  os_id: string;
  user_id: string;
  data_registro: string;
  comprimento_dia: number;
}

export const MediaPorEncarregado = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [ordens, setOrdens] = useState<OSRealInput[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: o }] = await Promise.all([
        supabase
          .from('registros_producao')
          .select('os_id, user_id, data_registro, comprimento_dia')
          .eq('excluido', false),
        supabase
          .from('ordens_servico')
          .select('id, comprimento_real, ligacoes_real, real_validado'),
      ]);
      const r = (data ?? []) as Row[];
      setRows(r);
      setOrdens((o ?? []) as OSRealInput[]);
      const ids = Array.from(new Set(r.map((x) => x.user_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          map[p.user_id] = p.display_name || p.email || p.user_id.slice(0, 8);
        });
        setUsers(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const ajustados = aplicarRealValidadoEmRegistros(rows, ordens);
    const map = new Map<string, { total: number; days: Set<string> }>();
    ajustados.forEach((r) => {
      const cur = map.get(r.user_id) ?? { total: 0, days: new Set<string>() };
      cur.total += Number(r.comprimento_dia) || 0;
      cur.days.add(r.data_registro);
      map.set(r.user_id, cur);
    });
    return Array.from(map.entries())
      .map(([userId, v]) => ({
        userId,
        nome: users[userId] || '—',
        total: Math.round(v.total * 10) / 10,
        dias: v.days.size,
        media: v.days.size > 0 ? Math.round((v.total / v.days.size) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.media - a.media);
  }, [rows, ordens, users]);


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
