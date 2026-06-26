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
  prazo_arredondado: number | null;
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
        supabase.from('ordens_servico').select('id, trecho, comprimento_previsto, prazo_previsto, prazo_arredondado, liberado_para, executor, updated_at'),
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

  // Avanço da Produção: executado acumulado vs. meta planejada SEQUENCIAL por OS
  const chartData = useMemo(() => {
    if (!effectiveUser) return [] as { date: string; label: string; meta: number; executado: number }[];
    if (myOS.length === 0) return [];

    const metaTotal = myOS.reduce(
      (s, os) => s + (Number(os.comprimento_previsto) || 0),
      0,
    );

    // Ordenar OS por ordem de execução: updated_at (liberação) → trecho
    const ordered = [...myOS].sort((a, b) => {
      const ta = new Date(a.updated_at).getTime();
      const tb = new Date(b.updated_at).getTime();
      if (ta !== tb) return ta - tb;
      return (a.trecho || '').localeCompare(b.trecho || '');
    });

    // Data inicial = primeira liberação
    const startDate = new Date(ordered[0].updated_at);
    startDate.setHours(0, 0, 0, 0);

    // Fila sequencial: cada OS começa quando a anterior termina
    type Plan = { startDay: number; prazo: number; comprimento: number; metaDiaria: number };
    const plans: Plan[] = [];
    let cursorDay = 0;
    for (const os of ordered) {
      const prazoRaw =
        (os.prazo_arredondado != null ? Number(os.prazo_arredondado) : null) ??
        (os.prazo_previsto != null ? Number(os.prazo_previsto) : null);
      const prazo = prazoRaw && prazoRaw > 0 ? Math.ceil(prazoRaw) : 1;
      const comprimento = Number(os.comprimento_previsto) || 0;
      plans.push({
        startDay: cursorDay,
        prazo,
        comprimento,
        metaDiaria: comprimento / prazo,
      });
      cursorDay += prazo;
    }
    const totalDaysPlanned = cursorDay;

    const metaAtDay = (day: number) => {
      let acc = 0;
      for (const p of plans) {
        if (day <= p.startDay) break;
        const diasDecorridos = Math.min(p.prazo, day - p.startDay);
        acc += p.metaDiaria * diasDecorridos;
      }
      return acc;
    };

    const realByDay = new Map<string, number>();
    allRegistros
      .filter((r) => r.user_id === effectiveUser.id)
      .forEach((r) => {
        realByDay.set(
          r.data_registro,
          (realByDay.get(r.data_registro) ?? 0) + (Number(r.comprimento_dia) || 0),
        );
      });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endTime = Math.max(
      today.getTime(),
      startDate.getTime() + totalDaysPlanned * 24 * 60 * 60 * 1000,
    );
    const endDate = new Date(endTime);

    const rows: { date: string; label: string; meta: number; executado: number }[] = [];
    let realAcc = 0;
    const cursor = new Date(startDate);
    let dayIdx = 0;
    while (cursor <= endDate) {
      const key = toDateKey(cursor);
      if (cursor <= today) {
        realAcc += realByDay.get(key) ?? 0;
      }
      const metaAcc = Math.min(metaTotal, metaAtDay(dayIdx + 1));
      rows.push({
        date: key,
        label: formatDayLabel(key),
        meta: Math.round(metaAcc * 10) / 10,
        executado: Math.round(realAcc * 10) / 10,
      });
      cursor.setDate(cursor.getDate() + 1);
      dayIdx++;
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

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Avanço da Produção</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Quanto você já executou comparado à meta planejada ao longo do prazo
        </p>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma OS liberada para você ainda.
          </p>
        ) : (
          <>
            <div className="h-64 sm:h-72 -mx-2 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={Math.max(0, Math.floor(chartData.length / 6))}
                  />
                  <YAxis tick={{ fontSize: 11 }} unit="m" width={48} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      color: 'hsl(var(--popover-foreground))',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 600 }}
                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    formatter={(v: number, name: string) => [
                      `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`,
                      name,
                    ]}
                    labelFormatter={(l) => `Data ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} iconType="plainline" />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    dot={false}
                    activeDot={false}
                    name="Meta planejada"
                  />
                  <Line
                    type="monotone"
                    dataKey="executado"
                    stroke="hsl(var(--status-green))"
                    strokeWidth={3}
                    dot={false}
                    name="Executado acumulado"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {(() => {
              const metaTotal = myOS.reduce((s, os) => s + (Number(os.comprimento_previsto) || 0), 0);
              const last = chartData[chartData.length - 1];
              const executado = last.executado;
              const falta = Math.max(0, metaTotal - executado);
              const pct = metaTotal > 0 ? Math.min(100, Math.round((executado / metaTotal) * 100)) : 0;
              const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
              return (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Meta</p>
                      <p className="text-xl font-bold text-foreground mt-1">{fmt(metaTotal)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Executado</p>
                      <p className="text-xl font-bold mt-1" style={{ color: 'hsl(var(--status-green))' }}>{fmt(executado)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Falta</p>
                      <p className="text-xl font-bold text-foreground mt-1">{fmt(falta)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Progresso</p>
                      <p className="text-xl font-bold text-foreground mt-1">{pct}<span className="text-sm font-normal text-muted-foreground">%</span></p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-semibold text-foreground">{pct}% concluído</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, background: 'hsl(var(--status-green))' }}
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
