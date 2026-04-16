import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';

interface RegistroRow {
  os_id: string;
  data_registro: string;
  comprimento_dia: number;
  user_id: string;
}

interface OSRow {
  id: string;
  trecho: string;
  comprimento_previsto: number | null;
  prazo_previsto: number | null;
  liberado_para: string | null;
  executor: string | null;
  updated_at: string;
}

const dayDiff = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));

const DashboardEncarregadoPage = () => {
  const { user } = useAuth();
  const [allRegistros, setAllRegistros] = useState<RegistroRow[]>([]);
  const [myOS, setMyOS] = useState<OSRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [regAll, osAll] = await Promise.all([
        supabase.from('registros_producao').select('os_id, data_registro, comprimento_dia, user_id'),
        supabase.from('ordens_servico').select('id, trecho, comprimento_previsto, prazo_previsto, liberado_para, updated_at'),
      ]);
      setAllRegistros((regAll.data ?? []) as RegistroRow[]);
      // OS atribuídas a este encarregado (via display_name salvo em liberado_para)
      const myName = user.nome;
      const mine = (osAll.data ?? []).filter((o: any) => o.liberado_para === myName) as OSRow[];
      setMyOS(mine);
      setLoading(false);
    };
    load();
  }, [user]);

  // Card: produção geral mensal de TODOS encarregados no mês atual
  const totalMesAtual = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return allRegistros
      .filter((r) => r.data_registro.startsWith(ym))
      .reduce((s, r) => s + (Number(r.comprimento_dia) || 0), 0);
  }, [allRegistros]);

  // Gráfico Meta vs Realizado
  const chartData = useMemo(() => {
    if (!user) return { rows: [], maxDay: 0 };
    const myReg = allRegistros
      .filter((r) => r.user_id === user.id)
      .sort((a, b) => a.data_registro.localeCompare(b.data_registro));

    if (myOS.length === 0) return { rows: [], maxDay: 0 };

    // Dia 0 = primeira OS liberada
    const firstReleaseDate = new Date(
      Math.min(...myOS.map((o) => new Date(o.updated_at).getTime())),
    );
    firstReleaseDate.setHours(0, 0, 0, 0);

    // META: para cada OS, distribuir comprimento ao longo de prazo*1.2 dias
    const metaPerDay = new Map<number, number>();
    myOS.forEach((os) => {
      const releaseDay = dayDiff(new Date(os.updated_at), firstReleaseDate);
      const totalDays = Math.max(1, Math.ceil((os.prazo_previsto ?? 1) * 1.2));
      const perDay = (os.comprimento_previsto ?? 0) / totalDays;
      for (let d = 1; d <= totalDays; d++) {
        const day = releaseDay + d;
        metaPerDay.set(day, (metaPerDay.get(day) ?? 0) + perDay);
      }
    });

    // REAL acumulado
    const realPerDay = new Map<number, number>();
    myReg.forEach((r) => {
      const day = dayDiff(new Date(r.data_registro + 'T00:00:00'), firstReleaseDate);
      realPerDay.set(day, (realPerDay.get(day) ?? 0) + (Number(r.comprimento_dia) || 0));
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDay = Math.max(
      dayDiff(today, firstReleaseDate),
      ...Array.from(metaPerDay.keys()),
      ...Array.from(realPerDay.keys()),
      0,
    );

    let metaAcc = 0;
    let realAcc = 0;
    const rows: { dia: number; meta: number; realizado: number }[] = [];
    for (let d = 0; d <= maxDay; d++) {
      metaAcc += metaPerDay.get(d) ?? 0;
      realAcc += realPerDay.get(d) ?? 0;
      rows.push({
        dia: d,
        meta: Math.round(metaAcc * 10) / 10,
        realizado: Math.round(realAcc * 10) / 10,
      });
    }
    return { rows, maxDay };
  }, [allRegistros, myOS, user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={28} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Meu Painel</h1>
        <p className="text-sm text-muted-foreground">{user?.nome} — Encarregado</p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Produção geral mensal (todos encarregados)</p>
        <p className="text-3xl font-bold text-foreground mt-2">
          {totalMesAtual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          <span className="text-base font-normal text-muted-foreground ml-1">m</span>
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Meta vs Realizado</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Dias desde a primeira NS liberada para você ({myOS.length} OS atribuídas)
        </p>
        {chartData.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma OS liberada para você ainda.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.rows}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} label={{ value: 'Dia', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="m" />
                <Tooltip formatter={(v: number) => `${v} m`} labelFormatter={(l) => `Dia ${l}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="stepAfter"
                  dataKey="meta"
                  stroke="#888780"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  name="Meta"
                />
                <Line
                  type="monotone"
                  dataKey="realizado"
                  stroke="#185FA5"
                  strokeWidth={2}
                  dot={false}
                  name="Realizado"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardEncarregadoPage;
