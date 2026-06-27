import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';
import { aplicarRealValidadoEmRegistros, type OSRealInput } from '@/lib/realEfetivo';

interface DailyRow {
  os_id: string;
  data_registro: string;
  comprimento_dia: number;
}

const formatDayLabel = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

export const ProducaoDiariaChart = () => {
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [ordens, setOrdens] = useState<OSRealInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);
    Promise.all([
      supabase
        .from('registros_producao')
        .select('os_id, data_registro, comprimento_dia')
        .eq('excluido', false)
        .gte('data_registro', sinceStr),
      supabase
        .from('ordens_servico')
        .select('id, comprimento_real, ligacoes_real, real_validado'),
    ]).then(([r, o]) => {
      setRows((r.data ?? []) as DailyRow[]);
      setOrdens((o.data ?? []) as OSRealInput[]);
      setLoading(false);
    });
  }, []);


  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; metros: number; key: string }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({ key, label: formatDayLabel(d), metros: 0 });
    }
    const ajustados = aplicarRealValidadoEmRegistros(rows, ordens);
    ajustados.forEach((r) => {
      const b = buckets.find((x) => x.key === r.data_registro);
      if (b) b.metros += Number(r.comprimento_dia) || 0;
    });
    return buckets.map((b) => ({ ...b, metros: Math.round(b.metros * 10) / 10 }));
  }, [rows, ordens]);


  return (
    <div className="bg-card rounded-xl p-6 border border-border shadow-sm mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">Produção Diária (m)</h2>
      <p className="text-sm text-muted-foreground mb-4">Últimos 30 dias</p>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-muted-foreground" size={18} />
        </div>
      ) : (
        <div className="h-44" style={{ width: '100%', minHeight: 180, display: 'block' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={Math.floor(data.length / 10)}
              />
              <YAxis tick={{ fontSize: 11 }} unit="m" />
              <Tooltip formatter={(v: number) => [`${v} m`, 'Produção']} />
              <Bar dataKey="metros" fill="#185FA5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
