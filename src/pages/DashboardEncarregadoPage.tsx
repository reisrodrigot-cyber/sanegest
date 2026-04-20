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
import { MapaInterativo } from '@/components/mapa/MapaInterativo';

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

const toDateKey = (d: Date) => d.toISOString().slice(0, 10);
const formatDayLabel = (key: string) => {
  const [, m, day] = key.split('-');
  return `${day}/${m}`;
};

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
        supabase.from('ordens_servico').select('id, trecho, comprimento_previsto, prazo_previsto, liberado_para, executor, updated_at'),
      ]);
      setAllRegistros((regAll.data ?? []) as RegistroRow[]);
      // OS atribuídas a este encarregado: usa "executor" (encarregado da OS),
      // com fallback para "liberado_para" (display_name) por compatibilidade.
      const myName = user.nome;
      const mine = (osAll.data ?? []).filter(
        (o: any) => o.executor === myName || o.liberado_para === myName,
      ) as OSRow[];
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

  // Burn Up: meta acumulada por data de liberação da OS, realizado acumulado por data de registro
  const chartData = useMemo(() => {
    if (!user) return [] as { date: string; label: string; meta: number; realizado: number }[];

    if (myOS.length === 0) return [];

    // Soma das metas (comprimento previsto) por dia (data de liberação ≈ updated_at)
    const metaByDay = new Map<string, number>();
    myOS.forEach((os) => {
      const key = toDateKey(new Date(os.updated_at));
      metaByDay.set(key, (metaByDay.get(key) ?? 0) + (os.comprimento_previsto ?? 0));
    });

    // Soma do realizado por dia
    const realByDay = new Map<string, number>();
    allRegistros
      .filter((r) => r.user_id === user.id)
      .forEach((r) => {
        realByDay.set(
          r.data_registro,
          (realByDay.get(r.data_registro) ?? 0) + (Number(r.comprimento_dia) || 0),
        );
      });

    // Intervalo: do primeiro evento (meta ou registro) até hoje
    const allKeys = [...metaByDay.keys(), ...realByDay.keys()].sort();
    if (allKeys.length === 0) return [];
    const startDate = new Date(allKeys[0] + 'T00:00:00');
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const rows: { date: string; label: string; meta: number; realizado: number }[] = [];
    let metaAcc = 0;
    let realAcc = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = toDateKey(cursor);
      metaAcc += metaByDay.get(key) ?? 0;
      realAcc += realByDay.get(key) ?? 0;
      rows.push({
        date: key,
        label: formatDayLabel(key),
        meta: Math.round(metaAcc * 10) / 10,
        realizado: Math.round(realAcc * 10) / 10,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
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

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3 px-2">Mapa de Campo</h2>
        <MapaInterativo showLocation />
      </div>
    </AppLayout>
  );
};

export default DashboardEncarregadoPage;
