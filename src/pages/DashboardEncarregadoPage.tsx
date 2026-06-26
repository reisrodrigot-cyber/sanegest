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
  const { effectiveUser } = useAuth();
  const [allRegistros, setAllRegistros] = useState<RegistroRow[]>([]);
  const [myOS, setMyOS] = useState<OSRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveUser) return;
    const load = async () => {
      const [regAll, osAll] = await Promise.all([
        supabase.from('registros_producao').select('os_id, data_registro, comprimento_dia, user_id'),
        supabase.from('ordens_servico').select('id, trecho, comprimento_previsto, prazo_previsto, liberado_para, executor, updated_at'),
      ]);
      setAllRegistros((regAll.data ?? []) as RegistroRow[]);
      // OS atribuídas a este encarregado: usa "executor" (encarregado da OS),
      // com fallback para "liberado_para" (display_name) por compatibilidade.
      const myName = effectiveUser.nome;
      const mine = (osAll.data ?? []).filter(
        (o: any) => o.executor === myName || o.liberado_para === myName,
      ) as OSRow[];
      setMyOS(mine);
      setLoading(false);
    };
    load();
  }, [effectiveUser]);

  // Card: produção geral mensal de TODOS encarregados no mês atual
  const totalMesAtual = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return allRegistros
      .filter((r) => r.data_registro.startsWith(ym))
      .reduce((s, r) => s + (Number(r.comprimento_dia) || 0), 0);
  }, [allRegistros]);

  // Avanço da Produção: executado acumulado por dia vs. referência liberada (linha linear constante)
  const chartData = useMemo(() => {
    if (!effectiveUser) return [] as { date: string; label: string; referencia: number; executado: number }[];
    if (myOS.length === 0) return [];

    // Total liberado para este encarregado (referência fixa)
    const totalLiberado = myOS.reduce(
      (s, os) => s + (Number(os.comprimento_previsto) || 0),
      0,
    );

    // Realizado por dia
    const realByDay = new Map<string, number>();
    allRegistros
      .filter((r) => r.user_id === effectiveUser.id)
      .forEach((r) => {
        realByDay.set(
          r.data_registro,
          (realByDay.get(r.data_registro) ?? 0) + (Number(r.comprimento_dia) || 0),
        );
      });

    // Intervalo: da primeira data relevante (liberação ou registro) até hoje
    const liberacaoKeys = myOS.map((os) => toDateKey(new Date(os.updated_at)));
    const allKeys = [...liberacaoKeys, ...realByDay.keys()].sort();
    if (allKeys.length === 0) return [];
    const startDate = new Date(allKeys[0] + 'T00:00:00');
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    const rows: { date: string; label: string; referencia: number; executado: number }[] = [];
    let realAcc = 0;
    const cursor = new Date(startDate);
    const refRounded = Math.round(totalLiberado * 10) / 10;
    while (cursor <= endDate) {
      const key = toDateKey(cursor);
      realAcc += realByDay.get(key) ?? 0;
      rows.push({
        date: key,
        label: formatDayLabel(key),
        referencia: refRounded,
        executado: Math.round(realAcc * 10) / 10,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }, [allRegistros, myOS, effectiveUser]);

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
        <p className="text-sm text-muted-foreground">{effectiveUser?.nome} — Encarregado</p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Minha produção este mês</p>
        <p className="text-3xl font-bold text-foreground mt-2">
          {(() => {
            const now = new Date();
            const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const minha = allRegistros
              .filter((r) => r.user_id === effectiveUser?.id && r.data_registro.startsWith(ym))
              .reduce((s, r) => s + (Number(r.comprimento_dia) || 0), 0);
            return minha.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
          })()}
          <span className="text-base font-normal text-muted-foreground ml-1">m</span>
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Meu Progresso</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Quanto você já executou do que foi liberado para você
        </p>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma OS liberada para você ainda.
          </p>
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={Math.max(0, Math.floor(chartData.length / 8))}
                  />
                  <YAxis tick={{ fontSize: 11 }} unit="m" />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v} m`, name]}
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    name="Total liberado pra você (metros)"
                  />
                  <Line
                    type="monotone"
                    dataKey="realizado"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2.5}
                    dot={false}
                    name="Quanto você já fez (metros)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {(() => {
              const last = chartData[chartData.length - 1];
              const liberado = last.meta;
              const executado = last.realizado;
              const falta = Math.max(0, liberado - executado);
              const pct = liberado > 0 ? Math.min(100, Math.round((executado / liberado) * 100)) : 0;
              const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
              return (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Liberado</p>
                      <p className="text-xl font-bold text-foreground mt-1">{fmt(liberado)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Executado</p>
                      <p className="text-xl font-bold text-secondary mt-1">{fmt(executado)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Falta</p>
                      <p className="text-xl font-bold text-foreground mt-1">{fmt(falta)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-semibold text-foreground">{pct}% concluído</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-secondary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
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
