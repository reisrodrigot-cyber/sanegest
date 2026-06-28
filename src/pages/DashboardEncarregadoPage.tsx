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
  ligacoes_dia: number;
  comprimento_ajustado: number | null;
  ligacoes_ajustadas: number | null;
  status: string;
  user_id: string;
}


interface OSRow {
  id: string;
  trecho: string;
  comprimento_previsto: number | null;
  comprimento_real: number | null;
  prazo_previsto: number | null;
  prazo_arredondado: number | null;
  liberado_para: string | null;
  executor: string | null;
  updated_at: string;
  real_validado: boolean;
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
        supabase.from('registros_producao').select('os_id, data_registro, comprimento_dia, ligacoes_dia, comprimento_ajustado, ligacoes_ajustadas, status, user_id').eq('excluido', false).eq('status', 'ativo'),
        supabase.from('ordens_servico').select('id, trecho, comprimento_previsto, comprimento_real, prazo_previsto, prazo_arredondado, liberado_para, executor, updated_at, real_validado'),
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

  // Avanço da Produção: executado acumulado vs. meta planejada
  // Janela: [hoje-3, max(hoje+7, data estimada de conclusão)]
  const chartData = useMemo(() => {
    if (!effectiveUser) return [] as { date: string; label: string; meta: number; executado: number; isToday?: boolean }[];
    if (myOS.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toDateKey(today);

    // Registros do encarregado nas suas OS (já filtrados por status='ativo' e excluido=false)
    const myOsIds = new Set(myOS.map((o) => o.id));
    const minhasRegistros = allRegistros.filter(
      (r) => r.user_id === effectiveUser.id && myOsIds.has(r.os_id),
    );

    // Executado total e por dia (usa valor ajustado quando existir)
    const realByDay = new Map<string, number>();
    let executadoTotal = 0;
    minhasRegistros.forEach((r) => {
      const valor = Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
      executadoTotal += valor;
      realByDay.set(r.data_registro, (realByDay.get(r.data_registro) ?? 0) + valor);
    });

    // Meta total = soma do saldo (previsto - executado_da_os, sem negativo)
    // Para distribuição uniforme usamos o saldo total restante.
    const previstoTotal = myOS.reduce((s, os) => s + (Number(os.comprimento_previsto) || 0), 0);
    const executadoPorOs = new Map<string, number>();
    minhasRegistros.forEach((r) => {
      const v = Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
      executadoPorOs.set(r.os_id, (executadoPorOs.get(r.os_id) ?? 0) + v);
    });
    const saldoTotal = myOS.reduce((s, os) => {
      const prev = Number(os.comprimento_previsto) || 0;
      const exec = executadoPorOs.get(os.id) ?? 0;
      return s + Math.max(0, prev - exec);
    }, 0);

    // Prazo total restante (soma dos prazos das OS liberadas) para estimar conclusão
    const prazoTotalDias = myOS.reduce((s, os) => {
      const p =
        (os.prazo_arredondado != null ? Number(os.prazo_arredondado) : null) ??
        (os.prazo_previsto != null ? Number(os.prazo_previsto) : null) ?? 0;
      return s + (p > 0 ? Math.ceil(p) : 0);
    }, 0);

    // Início = hoje - 3
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 3);

    // Fim estimado = hoje + prazo restante (dias), mínimo hoje+7 (=> 11 dias de janela após start)
    const estimatedEnd = new Date(today);
    estimatedEnd.setDate(estimatedEnd.getDate() + Math.max(0, prazoTotalDias));
    const minEnd = new Date(startDate);
    minEnd.setDate(minEnd.getDate() + 6); // mínimo 7 dias no eixo
    const sevenDayFloor = new Date(today);
    sevenDayFloor.setDate(sevenDayFloor.getDate() + 7);
    const endDate = new Date(Math.max(estimatedEnd.getTime(), minEnd.getTime(), sevenDayFloor.getTime()));

    // Acumulado inicial: produção anterior à janela
    let acumuladoInicial = 0;
    minhasRegistros.forEach((r) => {
      if (r.data_registro < toDateKey(startDate)) {
        acumuladoInicial += Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
      }
    });

    // Meta: distribuir saldo uniformemente entre hoje e endDate; meta começa em executadoTotal hoje
    const diasParaFim = Math.max(1, Math.round((endDate.getTime() - today.getTime()) / 86400000));
    const metaDiaria = saldoTotal / diasParaFim;
    const executadoAtual = executadoTotal; // = acumulado até hoje
    const metaTotalFinal = executadoAtual + saldoTotal; // alinhado com previstoTotal quando não há excesso

    const rows: { date: string; label: string; meta: number; executado: number; isToday?: boolean }[] = [];
    let realAcc = acumuladoInicial;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const key = toDateKey(cursor);
      if (cursor <= today) {
        realAcc += realByDay.get(key) ?? 0;
      }
      // meta acumulada: antes de hoje, projeção linear partindo de (hoje, executadoAtual) recuando metaDiaria;
      // a partir de hoje, executadoAtual + metaDiaria * diasDesdeHoje
      const diffDays = Math.round((cursor.getTime() - today.getTime()) / 86400000);
      let metaAcc: number;
      if (diffDays <= 0) {
        metaAcc = Math.max(0, executadoAtual + metaDiaria * diffDays);
      } else {
        metaAcc = Math.min(metaTotalFinal, executadoAtual + metaDiaria * diffDays);
      }
      rows.push({
        date: key,
        label: formatDayLabel(key),
        meta: Math.round(metaAcc * 10) / 10,
        executado: cursor <= today ? Math.round(realAcc * 10) / 10 : null as any,
        isToday: key === todayKey,
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
          Rede executada (trechos) comparada à meta planejada ao longo do prazo. A extensão das ligações é informação separada e não entra neste somatório.
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
                      <p className="text-xs text-muted-foreground">Meta de rede</p>
                      <p className="text-xl font-bold text-foreground mt-1">{fmt(metaTotal)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Rede executada</p>
                      <p className="text-xl font-bold mt-1" style={{ color: 'hsl(var(--status-green))' }}>{fmt(executado)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Falta de rede</p>
                      <p className="text-xl font-bold text-foreground mt-1">{fmt(falta)} <span className="text-sm font-normal text-muted-foreground">m</span></p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Progresso</p>
                      <p className="text-xl font-bold text-foreground mt-1">{pct}<span className="text-sm font-normal text-muted-foreground">%</span></p>
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
