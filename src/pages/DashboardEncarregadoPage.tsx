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

  // Avanço da Produção: executado acumulado vs. meta planejada linear ao longo do prazo da N.S.
  const chartData = useMemo(() => {
    if (!effectiveUser) return [] as { date: string; label: string; meta: number; executado: number }[];
    if (myOS.length === 0) return [];

    // Meta total = soma dos comprimentos previstos das OS atribuídas
    const metaTotal = myOS.reduce(
      (s, os) => s + (Number(os.comprimento_previsto) || 0),
      0,
    );

    // Para cada OS: data de liberação (updated_at como melhor referência disponível) e prazo
    const osPlans = myOS.map((os) => {
      const liberacao = new Date(os.updated_at);
      liberacao.setHours(0, 0, 0, 0);
      const prazo =
        (os.prazo_arredondado != null ? Number(os.prazo_arredondado) : null) ??
        (os.prazo_previsto != null ? Number(os.prazo_previsto) : null);
      const comprimento = Number(os.comprimento_previsto) || 0;
      return { liberacao, prazo: prazo && prazo > 0 ? prazo : null, comprimento };
    });

    // Meta acumulada de uma OS na data dateKey
    const metaAcumuladaOS = (plan: typeof osPlans[number], date: Date) => {
      if (date < plan.liberacao) return 0;
      if (plan.prazo == null) {
        // Sem prazo: considera meta liberada integralmente na data de liberação
        return plan.comprimento;
      }
      const diasDecorridos =
        Math.floor((date.getTime() - plan.liberacao.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const metaDiaria = plan.comprimento / plan.prazo;
      return Math.min(plan.comprimento, metaDiaria * diasDecorridos);
    };

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

    // Intervalo: da primeira liberação até hoje (ou fim do maior prazo, o que for maior)
    const liberacaoTimes = osPlans.map((p) => p.liberacao.getTime());
    const startDate = new Date(Math.min(...liberacaoTimes));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fimPrazos = osPlans.map((p) =>
      p.prazo ? p.liberacao.getTime() + p.prazo * 24 * 60 * 60 * 1000 : p.liberacao.getTime(),
    );
    const endDate = new Date(Math.max(today.getTime(), ...fimPrazos));

    const rows: { date: string; label: string; meta: number; executado: number }[] = [];
    let realAcc = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = toDateKey(cursor);
      // Só acumula execução até hoje
      if (cursor <= today) {
        realAcc += realByDay.get(key) ?? 0;
      }
      const metaAcc = osPlans.reduce((s, p) => s + metaAcumuladaOS(p, cursor), 0);
      rows.push({
        date: key,
        label: formatDayLabel(key),
        meta: Math.min(metaTotal, Math.round(metaAcc * 10) / 10),
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
                    formatter={(v: number, name: string) => [`${v} m`, name]}
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
