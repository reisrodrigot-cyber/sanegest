import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

interface Row {
  data_registro: string;
  comprimento_dia: number;
}

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const ProducaoMensalChart = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date();
    since.setMonth(since.getMonth() - 4);
    since.setDate(1);
    const sinceStr = since.toISOString().slice(0, 10);
    supabase
      .from('registros_producao')
      .select('data_registro, comprimento_dia')
      .gte('data_registro', sinceStr)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; metros: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      buckets.push({ key, label, metros: 0 });
    }
    rows.forEach((r) => {
      const k = r.data_registro.slice(0, 7);
      const b = buckets.find((x) => x.key === k);
      if (b) b.metros += Number(r.comprimento_dia) || 0;
    });
    return buckets.map((b) => ({ ...b, metros: Math.round(b.metros * 10) / 10 }));
  }, [rows]);

  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">Produção Mensal (m)</h2>
      <p className="text-sm text-muted-foreground mb-4">Últimos 4 meses</p>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-muted-foreground" size={18} />
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="m" />
              <Tooltip formatter={(v: number) => [`${v} m`, 'Produção']} />
              <Bar dataKey="metros" fill="#0C447C" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
