import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Activity,
  CalendarDays,
  TrendingUp,
  ListChecks,
  Gauge,
  Layers,
  Loader2,
  Radio,
} from 'lucide-react';
import { MapaInterativo } from '@/components/mapa/MapaInterativo';
import { StatusBadge } from '@/components/StatusBadge';
import type { OrdemServico } from '@/types/sanegest';

interface DailyRow {
  user_id: string;
  data_registro: string;
  comprimento_dia: number;
  os_id: string;
}

interface OSRow {
  id: string;
  prof_media_prevista: number | null;
}

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatDayLabel = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const FAIXAS = [
  { label: 'Até 1,15m', max: 1.15 },
  { label: '1,15m a 2,00m', max: 2.0 },
  { label: '2,00m a 3,00m', max: 3.0 },
  { label: 'Acima de 3,00m', max: Infinity },
];
const faixaIndex = (prof: number | null) => {
  if (prof == null) return -1;
  if (prof <= 1.15) return 0;
  if (prof <= 2.0) return 1;
  if (prof <= 3.0) return 2;
  return 3;
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

const KpiCard = ({ icon, label, value, sub, accent }: KpiCardProps) => (
  <div
    className="relative bg-card rounded-lg border border-border shadow-sm px-4 py-3 flex flex-col justify-between overflow-hidden"
    style={{ borderTop: `3px solid ${accent}` }}
  >
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      <span style={{ color: accent }}>{icon}</span>
    </div>
    <div className="mt-1">
      <div className="text-2xl font-bold text-foreground leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  </div>
);

interface Props {
  ordens: OrdemServico[];
  divergenciasCount: number;
}

export const DashboardCompact = ({ ordens, divergenciasCount }: Props) => {
  const [registros, setRegistros] = useState<DailyRow[]>([]);
  const [osRows, setOsRows] = useState<OSRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('registros_producao').select('user_id, data_registro, comprimento_dia, os_id'),
      supabase.from('ordens_servico').select('id, prof_media_prevista'),
    ]).then(([r, o]) => {
      setRegistros((r.data ?? []) as DailyRow[]);
      setOsRows((o.data ?? []) as OSRow[]);
      setLoading(false);
    });
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const totalPrevisto = ordens.reduce((s, o) => s + (o.comprimento_previsto ?? 0), 0);
    const totalExecutado = ordens.reduce((s, o) => s + (o.comprimento_real ?? 0), 0);
    const pct = totalPrevisto > 0 ? Math.round((totalExecutado / totalPrevisto) * 100) : 0;

    const producaoHoje = registros
      .filter((r) => r.data_registro === todayStr)
      .reduce((s, r) => s + Number(r.comprimento_dia || 0), 0);

    const totalReg = registros.reduce((s, r) => s + Number(r.comprimento_dia || 0), 0);
    const diasUnicos = new Set(registros.map((r) => r.data_registro)).size;
    const mediaDiaria = diasUnicos > 0 ? totalReg / diasUnicos : 0;

    const nsExec = ordens.filter(
      (o) => o.liberado && (o.status === 'VERMELHO' || o.status === 'LARANJA' || o.status === 'AMARELO'),
    ).length;

    // ativos últimos 30 dias
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);
    const ativos = new Set(registros.filter((r) => r.data_registro >= sinceStr).map((r) => r.user_id)).size;

    const usuariosDias = new Map<string, { total: number; days: Set<string> }>();
    registros.forEach((r) => {
      const c = usuariosDias.get(r.user_id) ?? { total: 0, days: new Set<string>() };
      c.total += Number(r.comprimento_dia || 0);
      c.days.add(r.data_registro);
      usuariosDias.set(r.user_id, c);
    });
    const medias = Array.from(usuariosDias.values()).map((v) => (v.days.size > 0 ? v.total / v.days.size : 0));
    const produtividadeGeral = medias.length > 0 ? medias.reduce((a, b) => a + b, 0) / medias.length : 0;

    return {
      avancoLabel: `${Math.round(totalExecutado).toLocaleString('pt-BR')} / ${Math.round(totalPrevisto).toLocaleString('pt-BR')} m`,
      avancoPct: `${pct}%`,
      producaoHoje: `${Math.round(producaoHoje * 10) / 10} m`,
      mediaDiaria: `${Math.round(mediaDiaria * 10) / 10} m/dia`,
      nsExec: String(nsExec),
      ativos: String(ativos),
      produtividadeGeral: `${Math.round(produtividadeGeral * 10) / 10} m/dia`,
    };
  }, [ordens, registros, todayStr]);

  // Produção diária (30 dias)
  const dailyData = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; metros: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.push({ key, label: formatDayLabel(d), metros: 0 });
    }
    registros.forEach((r) => {
      const b = buckets.find((x) => x.key === r.data_registro);
      if (b) b.metros += Number(r.comprimento_dia) || 0;
    });
    return buckets.map((b) => ({ ...b, metros: Math.round(b.metros * 10) / 10 }));
  }, [registros]);

  // Produção mensal (4 meses)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; metros: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      buckets.push({ key, label, metros: 0 });
    }
    registros.forEach((r) => {
      const k = r.data_registro.slice(0, 7);
      const b = buckets.find((x) => x.key === k);
      if (b) b.metros += Number(r.comprimento_dia) || 0;
    });
    return buckets.map((b) => ({ ...b, metros: Math.round(b.metros) }));
  }, [registros]);

  // Produção por encarregado (a partir de OS)
  const porEncarregado = useMemo(() => {
    const map = new Map<string, { nome: string; ns: number; total: number; days: Set<string> }>();
    ordens
      .filter((o) => o.comprimento_real != null && o.comprimento_real > 0 && o.liberado_para)
      .forEach((o) => {
        const c = map.get(o.liberado_para!) ?? { nome: o.liberado_para!, ns: 0, total: 0, days: new Set<string>() };
        c.ns += 1;
        c.total += o.comprimento_real!;
        map.set(o.liberado_para!, c);
      });
    // dias por encarregado vem de registros — usar regs por user_id seria ideal mas aqui simplificamos
    return Array.from(map.values())
      .map((v) => ({ ...v, media: 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [ordens]);

  // Avanço por bacia
  const porBacia = useMemo(() => {
    const map = new Map<string, { previsto: number; executado: number }>();
    ordens.filter((o) => o.liberado).forEach((o) => {
      const b = o.bacia || 'Sem bacia';
      const c = map.get(b) ?? { previsto: 0, executado: 0 };
      c.previsto += o.comprimento_previsto ?? 0;
      c.executado += o.comprimento_real ?? 0;
      map.set(b, c);
    });
    return Array.from(map.entries())
      .map(([bacia, v]) => ({
        bacia,
        previsto: Math.round(v.previsto),
        executado: Math.round(v.executado),
        pct: v.previsto > 0 ? Math.round((v.executado / v.previsto) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [ordens]);

  // Profundidade
  const profStats = useMemo(() => {
    const osProf = new Map<string, number | null>();
    osRows.forEach((o) => osProf.set(o.id, o.prof_media_prevista != null ? Number(o.prof_media_prevista) : null));
    const data = FAIXAS.map(() => ({ total: 0, days: new Set<string>() }));
    registros.forEach((r) => {
      const idx = faixaIndex(osProf.get(r.os_id) ?? null);
      if (idx < 0) return;
      data[idx].total += Number(r.comprimento_dia) || 0;
      data[idx].days.add(r.data_registro);
    });
    const max = Math.max(1, ...data.map((d) => (d.days.size > 0 ? d.total / d.days.size : 0)));
    return FAIXAS.map((f, i) => ({
      label: f.label,
      media: data[i].days.size > 0 ? Math.round((data[i].total / data[i].days.size) * 10) / 10 : 0,
      total: Math.round(data[i].total),
      pctBar: data[i].days.size > 0 ? ((data[i].total / data[i].days.size) / max) * 100 : 0,
    }));
  }, [registros, osRows]);

  // NS em execução
  const nsEmExec = useMemo(
    () =>
      ordens
        .filter((o) => o.liberado && (o.status === 'VERMELHO' || o.status === 'LARANJA' || o.status === 'AMARELO'))
        .sort((a, b) => {
          const order = { AMARELO: 0, LARANJA: 1, VERMELHO: 2 } as Record<string, number>;
          return (order[a.status] ?? 9) - (order[b.status] ?? 9);
        })
        .slice(0, 9),
    [ordens],
  );

  const accent = {
    blue: '#185FA5',
    blueDark: '#0C447C',
    amber: '#D97706',
    green: '#16A34A',
    red: '#DC2626',
    purple: '#7C3AED',
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1 — KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Avanço Físico"
          value={kpis.avancoPct}
          sub={kpis.avancoLabel}
          accent={accent.blueDark}
        />
        <KpiCard
          icon={<CalendarDays size={16} />}
          label="Produção Hoje"
          value={kpis.producaoHoje}
          sub="metros executados"
          accent={accent.green}
        />
        <KpiCard
          icon={<Activity size={16} />}
          label="Média Diária"
          value={kpis.mediaDiaria}
          sub="todos os encarregados"
          accent={accent.blue}
        />
        <KpiCard
          icon={<ListChecks size={16} />}
          label="NS em Execução"
          value={kpis.nsExec}
          sub={divergenciasCount > 0 ? `${divergenciasCount} divergência(s)` : 'sem divergências'}
          accent={accent.amber}
        />
        <KpiCard
          icon={<Gauge size={16} />}
          label="Produtividade Geral"
          value={kpis.produtividadeGeral}
          sub="média por encarregado"
          accent={accent.red}
        />
      </div>

      {/* Row 2 — Map + Charts + Tables */}
      <div className="grid grid-cols-10 gap-3">
        {/* Map */}
        <div className="col-span-4 bg-card rounded-lg border border-border shadow-sm p-2 flex flex-col">
          <div className="flex items-center justify-between px-1 pb-1">
            <h3 className="text-sm font-semibold text-foreground">Mapa Interativo</h3>
            <Link to="/mapa" className="text-xs text-secondary hover:underline">Abrir</Link>
          </div>
          <div className="flex-1 min-h-0">
            <MapaInterativo height="100%" className="" />
          </div>
        </div>

        {/* Charts */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex-1 min-h-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">Produção Diária <span className="text-[10px] text-muted-foreground font-normal">(30d)</span></h3>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: number) => [`${v} m`, 'Produção']} />
                  <Bar dataKey="metros" fill={accent.blue} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex-1 min-h-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">Produção Mensal <span className="text-[10px] text-muted-foreground font-normal">(4 meses)</span></h3>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: number) => [`${v} m`, 'Produção']} />
                  <Bar dataKey="metros" fill={accent.blueDark} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tables */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-foreground mb-2">Produção por Encarregado</h3>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-1 font-medium">Encarregado</th>
                    <th className="pb-1 font-medium text-right">NS</th>
                    <th className="pb-1 font-medium text-right">Total (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {porEncarregado.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-muted-foreground py-3">Sem dados</td></tr>
                  ) : porEncarregado.map((e) => (
                    <tr key={e.nome} className="border-b border-border/40">
                      <td className="py-1 text-foreground">{e.nome}</td>
                      <td className="py-1 text-right text-muted-foreground">{e.ns}</td>
                      <td className="py-1 text-right font-semibold">{Math.round(e.total).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-foreground mb-2">Avanço por Bacia</h3>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-1 font-medium">Bacia</th>
                    <th className="pb-1 font-medium text-right">Prev.</th>
                    <th className="pb-1 font-medium text-right">Exec.</th>
                    <th className="pb-1 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {porBacia.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-3">Sem dados</td></tr>
                  ) : porBacia.map((b) => (
                    <tr key={b.bacia} className="border-b border-border/40">
                      <td className="py-1 text-foreground">{b.bacia}</td>
                      <td className="py-1 text-right text-muted-foreground">{b.previsto.toLocaleString('pt-BR')}</td>
                      <td className="py-1 text-right text-muted-foreground">{b.executado.toLocaleString('pt-BR')}</td>
                      <td className="py-1 text-right font-semibold">{b.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Profundidade + NS em Execução */}
      <div className="grid grid-cols-10 gap-3">
        <div className="col-span-4 bg-card rounded-lg border border-border shadow-sm p-3">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Layers size={14} className="text-muted-foreground" />
            Produtividade por Profundidade
          </h3>
          {loading ? (
            <Loader2 className="animate-spin text-muted-foreground mx-auto my-4" size={16} />
          ) : (
            <div className="space-y-2">
              {profStats.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-foreground font-medium">{s.label}</span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{s.media.toLocaleString('pt-BR')}</span> m/dia
                      <span className="text-[10px] ml-2">total {s.total.toLocaleString('pt-BR')} m</span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.pctBar}%`, backgroundColor: accent.blue }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-6 bg-card rounded-lg border border-border shadow-sm p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">NS em Execução</h3>
            <Link to="/ordens" className="text-xs text-secondary hover:underline">Ver todas</Link>
          </div>
          {nsEmExec.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma NS em execução.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {nsEmExec.map((os) => (
                <Link
                  key={os.id}
                  to={`/ordens/${os.id}`}
                  className="rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors p-2 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground truncate">{os.trecho}</span>
                    <StatusBadge status={os.status} size="sm" />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{os.bacia}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {(os.comprimento_previsto ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4 — Activity Feed */}
      <ActivityFeed />
    </div>
  );
};

type EventType = 'producao' | 'topografia' | 'ns' | 'almoxarifado';

interface FeedEvent {
  id: string;
  type: EventType;
  ts: Date;
  who: string;
  description: string;
}

const EVENT_META: Record<EventType, { label: string; color: string; bg: string; dot: string }> = {
  producao:     { label: 'Produção',     color: '#16A34A', bg: 'rgba(22,163,74,0.10)',  dot: '🟢' },
  topografia:   { label: 'Topografia',   color: '#185FA5', bg: 'rgba(24,95,165,0.10)',  dot: '🔵' },
  ns:           { label: 'NS Aplicada',  color: '#CA8A04', bg: 'rgba(202,138,4,0.12)',  dot: '🟡' },
  almoxarifado: { label: 'Almoxarifado', color: '#EA580C', bg: 'rgba(234,88,12,0.10)',  dot: '🟠' },
};

const MOCK_EVENTS: FeedEvent[] = (() => {
  const now = Date.now();
  const min = 60 * 1000;
  const h = 60 * min;
  const raw: Array<{ type: EventType; who: string; description: string; offset: number }> = [
    { type: 'producao',     who: 'Cleiber',        description: 'registrou 12m na TR-1.3',                              offset: 8 * min },
    { type: 'topografia',   who: 'Maria Topógrafa', description: 'estaqueou TR-2.1 — 45 pontos',                         offset: 22 * min },
    { type: 'ns',           who: 'Ana Técnica',    description: 'NS TR-1.10 atribuída a Jonas',                         offset: 47 * min },
    { type: 'almoxarifado', who: 'João Almoxarife', description: 'Entrega: 50 tubos DN200 para Encarregado 1',          offset: 1 * h + 12 * min },
    { type: 'producao',     who: 'Jonas',           description: 'registrou 18m na TR-1.10',                            offset: 1 * h + 50 * min },
    { type: 'producao',     who: 'Encarregado 2',   description: 'registrou 9,5m na TR-3.4',                            offset: 2 * h + 5 * min },
    { type: 'topografia',   who: 'Maria Topógrafa', description: 'cadastrou 12 ligações em TR-2.1',                     offset: 2 * h + 40 * min },
    { type: 'almoxarifado', who: 'João Almoxarife', description: 'Entrega: 80m de PVC DN150 para Cleiber',              offset: 3 * h + 18 * min },
    { type: 'ns',           who: 'Ana Técnica',    description: 'NS TR-3.7 atribuída a Encarregado 2',                  offset: 4 * h + 2 * min },
    { type: 'producao',     who: 'Cleiber',        description: 'registrou 15m na TR-1.3 (profundidade 2,4m)',          offset: 4 * h + 35 * min },
    { type: 'almoxarifado', who: 'João Almoxarife', description: 'Divergência: faltam 4 tampões TR-2.5',                offset: 5 * h + 10 * min },
    { type: 'topografia',   who: 'Maria Topógrafa', description: 'estaqueou TR-3.7 — 28 pontos',                        offset: 6 * h + 5 * min },
    { type: 'ns',           who: 'Ana Técnica',    description: 'NS TR-2.8 atribuída a Cleiber',                        offset: 7 * h + 22 * min },
    { type: 'producao',     who: 'Encarregado 2',   description: 'registrou 11m na TR-3.4',                             offset: 1 * 24 * h + 1 * h },
    { type: 'producao',     who: 'Jonas',           description: 'registrou 22m na TR-1.10',                            offset: 1 * 24 * h + 3 * h },
    { type: 'almoxarifado', who: 'João Almoxarife', description: 'Entrega: 30 anéis de borracha para Jonas',            offset: 1 * 24 * h + 5 * h },
    { type: 'topografia',   who: 'Maria Topógrafa', description: 'as-built carregado para TR-1.3',                      offset: 1 * 24 * h + 7 * h },
    { type: 'producao',     who: 'Cleiber',        description: 'registrou 14m na TR-2.8',                              offset: 2 * 24 * h + 2 * h },
    { type: 'ns',           who: 'Ana Técnica',    description: 'NS TR-4.1 atribuída a Encarregado 2',                  offset: 2 * 24 * h + 4 * h },
    { type: 'almoxarifado', who: 'João Almoxarife', description: 'Entrega: cimento (20 sacos) para frente TR-1',        offset: 2 * 24 * h + 6 * h },
  ] as any;
  return raw.map((r, i) => ({
    id: String(i),
    type: r.type,
    who: r.who,
    description: r.description,
    ts: new Date(now - r.offset),
  }));
})();

const formatRelative = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return `há ${days}d`;
};

const formatStamp = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const ActivityFeed = () => {
  const events = MOCK_EVENTS.slice(0, 20);
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Radio size={14} className="text-secondary" />
          O que está acontecendo?
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {(Object.keys(EVENT_META) as EventType[]).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_META[t].color }} />
              {EVENT_META[t].label}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto max-h-[320px] pr-1">
        <ul className="space-y-1.5">
          {events.map((e) => {
            const meta = EVENT_META[e.type];
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-md py-1.5 pl-2.5 pr-2 bg-muted/20 hover:bg-muted/40 transition-colors"
                style={{ borderLeft: `3px solid ${meta.color}` }}
              >
                <div className="flex flex-col min-w-[88px]">
                  <span className="text-[10px] font-semibold text-foreground">{formatStamp(e.ts)}</span>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(e.ts)}</span>
                </div>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide whitespace-nowrap"
                  style={{ color: meta.color, backgroundColor: meta.bg }}
                >
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground">
                    <span className="font-semibold">{e.who}</span>{' '}
                    <span className="text-muted-foreground">— {e.description}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
