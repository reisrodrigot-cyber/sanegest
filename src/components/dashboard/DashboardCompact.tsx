import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  LabelList,
  Cell,
} from 'recharts';
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

const useMobileChartWidth = (minWidth = 260) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const media = window.matchMedia('(max-width: 1023px)');
    const measure = () => {
      if (!media.matches) {
        setWidth(0);
        return;
      }
      const rectWidth = el.getBoundingClientRect().width || el.clientWidth || window.innerWidth - 48;
      setWidth(Math.max(minWidth, Math.floor(rectWidth)));
    };
    measure();
    const raf = window.requestAnimationFrame(measure);
    const timers = [100, 300, 700].map((ms) => window.setTimeout(measure, ms));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    media.addEventListener?.('change', measure);
    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      media.removeEventListener?.('change', measure);
    };
  }, [minWidth]);

  return [ref, width] as const;
};

const ChartFrame = ({
  className,
  mobileHeight,
  desktopHeight,
  children,
}: {
  className: string;
  mobileHeight: number;
  desktopHeight?: number;
  children: (width?: number, height?: number) => React.ReactElement;
}) => {
  const [ref, mobileWidth] = useMobileChartWidth();
  return (
    <div
      ref={ref}
      className={className}
      style={{ width: '100%', height: mobileWidth > 0 ? mobileHeight : desktopHeight, minHeight: 150, display: 'block' }}
    >
      {mobileWidth > 0 ? (
        children(mobileWidth, mobileHeight)
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {children()}
        </ResponsiveContainer>
      )}
    </div>
  );
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const focusOsId = (location.state as any)?.focusOsId ?? null;
  // Clear state after first read so revisits don't re-trigger
  useEffect(() => {
    if (focusOsId) {
      const t = setTimeout(() => navigate(location.pathname, { replace: true, state: {} }), 4500);
      return () => clearTimeout(t);
    }
  }, [focusOsId, navigate, location.pathname]);

  // Track whether we're in the mobile dashboard layout (≤1023px) so the map
  // can mount with an explicit pixel height. Without this, on mobile the
  // Leaflet container initializes inside a flex parent whose height isn't
  // resolved on the first paint, leaving the map stuck with 0×0 panes
  // (drag/zoom locked, no markers).
  const [isMobileLayout, setIsMobileLayout] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobileLayout(mql.matches);
    apply();
    mql.addEventListener?.('change', apply);
    return () => mql.removeEventListener?.('change', apply);
  }, []);
  const [registros, setRegistros] = useState<DailyRow[]>([]);
  const [osRows, setOsRows] = useState<OSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [baciaFilter, setBaciaFilter] = useState('');
  const [baciaMode, setBaciaMode] = useState<'todas' | 'com_execucao'>('todas');

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

  // Force Recharts ResponsiveContainer to recalc on mount (fixes empty charts on mobile)
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(fire, 100);
    const t2 = setTimeout(fire, 400);
    const t3 = setTimeout(fire, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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

  // Produção por encarregado — APENAS mês corrente (a partir de registros_producao)
  const [encNames, setEncNames] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from('profiles').select('user_id, display_name, email').then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.user_id] = p.display_name || p.email || '—'; });
      setEncNames(m);
    });
  }, []);
  const porEncarregado = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const map = new Map<string, { nome: string; ns: Set<string>; total: number }>();
    registros
      .filter((r) => r.data_registro.startsWith(ym))
      .forEach((r) => {
        const nome = encNames[r.user_id] || '—';
        const c = map.get(r.user_id) ?? { nome, ns: new Set<string>(), total: 0 };
        c.nome = nome;
        c.ns.add(r.os_id);
        c.total += Number(r.comprimento_dia) || 0;
        map.set(r.user_id, c);
      });
    return Array.from(map.values())
      .map((v) => ({ nome: v.nome, ns: v.ns.size, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [registros, encNames]);

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

  // Avanço por Bacia (todas as NS, independente de status/liberação)
  const porTrecho = useMemo(() => {
    const map = new Map<string, { executado: number; total: number }>();
    ordens.forEach((o) => {
      const prev = o.comprimento_previsto ?? 0;
      if (prev <= 0) return;
      const bacia = o.bacia || 'Sem bacia';
      const exec = Math.min(o.comprimento_real ?? 0, prev);
      const c = map.get(bacia) ?? { executado: 0, total: 0 };
      c.executado += exec;
      c.total += prev;
      map.set(bacia, c);
    });
    return Array.from(map.entries())
      .map(([bacia, v]) => ({
        trecho: bacia,
        executado: Math.round(v.executado),
        pendente: Math.round(Math.max(v.total - v.executado, 0)),
        total: Math.round(v.total),
        pct: v.total > 0 ? Math.round((v.executado / v.total) * 100) : 0,
      }))
      .sort((a, b) => String(a.trecho).localeCompare(String(b.trecho), 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [ordens]);

  const accent = {
    blue: '#185FA5',
    blueDark: '#0C447C',
    amber: '#D97706',
    green: '#16A34A',
    red: '#DC2626',
    purple: '#7C3AED',
  };

  // Dark chart palette
  const DARK_BG = '#0d1b2a';
  const DARK_BORDER = 'rgba(255,255,255,0.1)';
  const DARK_GRID = 'rgba(255,255,255,0.1)';
  const DARK_AXIS = 'rgba(255,255,255,0.7)';
  const TEAL = '#4dd9ac';
  const RED_PEND = '#e63946';
  const GREEN_EXEC = '#2dc653';

  const darkCardStyle: React.CSSProperties = {
    backgroundColor: DARK_BG,
    border: `1px solid ${DARK_BORDER}`,
    color: '#ffffff',
  };
  const darkTooltipStyle: React.CSSProperties = {
    backgroundColor: '#0d1b2a',
    border: `1px solid ${DARK_BORDER}`,
    color: '#fff',
    fontSize: 11,
    borderRadius: 6,
  };

  const formatKm = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')}km`;
    return `${Math.round(m)}m`;
  };

  return (
    <div className="dc-root flex flex-col gap-3">
      {/* Row 1 — KPIs */}
      <div className="dc-kpis grid grid-cols-5 gap-3">
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
      <div className="dc-row2 grid grid-cols-10 gap-3">
        {/* Map */}
        <div className="dc-map col-span-4 bg-card rounded-lg border border-border shadow-sm p-2 flex flex-col">
          <div className="flex items-center justify-between px-1 pb-1">
            <h3 className="text-sm font-semibold text-foreground">Mapa Interativo</h3>
          </div>
          <div className="dc-map-inner flex-1 min-h-0">
            {isMobileLayout !== null && (
              <MapaInterativo
                key={isMobileLayout ? 'mobile' : 'desktop'}
                height={isMobileLayout ? 220 : '100%'}
                preferCanvas={!isMobileLayout}
                className=""
                focusOsId={focusOsId}
              />
            )}
          </div>
        </div>


        {/* Charts (dark) */}
        <div className="dc-charts col-span-3 flex flex-col gap-3">
          <div className="dc-chart dc-chart-daily rounded-lg shadow-sm p-3 flex-1 min-h-0" style={darkCardStyle}>
            <h3 className="text-sm font-semibold text-white mb-1">
              Produção Diária <span className="text-[10px] text-white/60 font-normal">(30d)</span>
            </h3>
            <ChartFrame className="dc-chart-box h-[150px]" mobileHeight={180}>
              {(chartWidth, chartHeight) => (
                <LineChart width={chartWidth} height={chartHeight} data={dailyData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={DARK_GRID} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: DARK_AXIS }} interval={4} stroke={DARK_GRID} />
                  <YAxis tick={{ fontSize: 9, fill: DARK_AXIS }} stroke={DARK_GRID} />
                  <Tooltip
                    contentStyle={darkTooltipStyle}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v: number) => [`${v} m`, 'Produção']}
                  />
                  <Line
                    type="monotone"
                    dataKey="metros"
                    stroke={TEAL}
                    strokeWidth={2}
                    dot={{ r: 4, fill: TEAL, stroke: '#fff', strokeWidth: 1 }}
                    activeDot={{ r: 5, fill: TEAL, stroke: '#fff', strokeWidth: 1 }}
                  />
                </LineChart>
              )}
            </ChartFrame>
          </div>
          <div className="dc-chart dc-chart-monthly rounded-lg shadow-sm p-3 flex-1 min-h-0" style={darkCardStyle}>
            <h3 className="text-sm font-semibold text-white mb-1">
              Produção Mensal <span className="text-[10px] text-white/60 font-normal">(4 meses)</span>
            </h3>
            <ChartFrame className="dc-chart-box h-[150px]" mobileHeight={160}>
              {(chartWidth, chartHeight) => (
                <LineChart width={chartWidth} height={chartHeight} data={monthlyData} margin={{ top: 18, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={DARK_GRID} strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: DARK_AXIS }} stroke={DARK_GRID} />
                  <YAxis tick={{ fontSize: 9, fill: DARK_AXIS }} stroke={DARK_GRID} />
                  <Tooltip
                    contentStyle={darkTooltipStyle}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v: number) => [`${v} m`, 'Produção']}
                  />
                  <Line
                    type="monotone"
                    dataKey="metros"
                    stroke={TEAL}
                    strokeWidth={2}
                    dot={{ r: 4, fill: TEAL, stroke: '#fff', strokeWidth: 1 }}
                    activeDot={{ r: 5, fill: TEAL, stroke: '#fff', strokeWidth: 1 }}
                  >
                    <LabelList
                      dataKey="metros"
                      position="top"
                      offset={8}
                      formatter={(v: number) => formatKm(v)}
                      fill="#fff"
                      fontSize={10}
                    />
                  </Line>
                </LineChart>
              )}
            </ChartFrame>
          </div>
        </div>

        {/* Tables + Produtividade strip */}
        <div className="dc-tables col-span-3 flex flex-col gap-3">
          <div className="dc-table-encarregado bg-card rounded-lg border border-border shadow-sm p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-foreground mb-2">Produção por Encarregado (mês atual)</h3>
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
          <div className="dc-table-bacia bg-card rounded-lg border border-border shadow-sm p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
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
            {/* Produtividade strip compacto */}
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
                <Layers size={12} className="text-muted-foreground" />
                Produtividade por Profundidade
              </div>
              {loading ? (
                <Loader2 className="animate-spin text-muted-foreground mx-auto my-2" size={14} />
              ) : (
                <div className="space-y-1">
                  {profStats.map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-foreground w-[110px] truncate">{s.label}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${s.pctBar}%`, backgroundColor: accent.blue }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-foreground w-[58px] text-right">
                        {s.media.toLocaleString('pt-BR')} m/d
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Bacia (50%) + NS em Execução (20%) + Activity Feed (30%) */}
      <div className="dc-row3 grid grid-cols-10 gap-3 items-stretch">
        {/* Avanço por Bacia — 50% */}
        {(() => {
          const filtered = porTrecho.filter(b => {
            if (baciaMode === 'com_execucao' && !(b.executado > 0)) return false;
            if (baciaFilter && !String(b.trecho).toLowerCase().includes(baciaFilter.toLowerCase())) return false;
            return true;
          });
          const innerHeight = Math.max(160, filtered.length * 22 + 30);
          const mobileBaciaHeight = Math.max(200, Math.min(360, innerHeight));
          return (
            <div className="dc-bacia col-span-5 rounded-lg shadow-sm p-3 flex flex-col h-[420px]" style={darkCardStyle}>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">Avanço por Bacia</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBaciaMode('com_execucao')}
                    className={`h-7 px-2 text-[11px] rounded border ${baciaMode === 'com_execucao' ? 'bg-[#4dd9ac] text-[#0d1b2a] border-[#4dd9ac]' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'}`}
                  >
                    Com execução
                  </button>
                  <button
                    onClick={() => setBaciaMode('todas')}
                    className={`h-7 px-2 text-[11px] rounded border ${baciaMode === 'todas' ? 'bg-[#4dd9ac] text-[#0d1b2a] border-[#4dd9ac]' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'}`}
                  >
                    Todas
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/80">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RED_PEND }} />
                    Pendente
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GREEN_EXEC }} />
                    Executado
                  </span>
                </div>
              </div>
              {filtered.length === 0 ? (
                <p className="text-xs text-white/60 text-center py-6">Sem dados.</p>
              ) : (
                <div className="overflow-y-auto flex-1 min-h-0">
                  <ChartFrame className="dc-chart-box" mobileHeight={mobileBaciaHeight} desktopHeight={innerHeight}>
                    {(chartWidth, chartHeight) => (
                      <BarChart
                        width={chartWidth}
                        height={chartHeight}
                        data={filtered}
                        layout="vertical"
                        margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
                        barCategoryGap={4}
                        barSize={14}
                      >
                        <CartesianGrid stroke={DARK_GRID} strokeDasharray="0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: DARK_AXIS }} stroke={DARK_GRID} />
                        <YAxis
                          type="category"
                          dataKey="trecho"
                          tick={{ fontSize: 11, fill: DARK_AXIS }}
                          stroke={DARK_GRID}
                          width={120}
                        />
                        <Tooltip
                          contentStyle={darkTooltipStyle}
                          labelStyle={{ color: '#fff' }}
                          formatter={(v: number, n: string) => [`${v.toLocaleString('pt-BR')} m`, n === 'executado' ? 'Executado' : 'Pendente']}
                        />
                        <Bar dataKey="executado" stackId="a" fill={GREEN_EXEC} name="executado" barSize={14}>
                          <LabelList
                            dataKey="executado"
                            position="center"
                            formatter={(v: number) => (v > 0 ? v.toLocaleString('pt-BR') : '')}
                            fill="#fff"
                            fontSize={10}
                          />
                        </Bar>
                        <Bar dataKey="pendente" stackId="a" fill={RED_PEND} name="pendente" barSize={14}>
                          <LabelList
                            dataKey="pendente"
                            position="center"
                            formatter={(v: number) => (v > 0 ? v.toLocaleString('pt-BR') : '')}
                            fill="#fff"
                            fontSize={10}
                          />
                          <LabelList
                            dataKey="pct"
                            position="right"
                            formatter={(v: number) => `${v}%`}
                            fill="#4dd9ac"
                            fontSize={11}
                            offset={8}
                          />
                        </Bar>
                      </BarChart>
                    )}
                  </ChartFrame>
                </div>
              )}
            </div>
          );
        })()}

        {/* NS em Execução — 20% */}
        <div className="dc-ns col-span-2 bg-card rounded-lg border border-border shadow-sm p-3 flex flex-col h-[420px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">NS em Execução</h3>
            <Link to="/ordens" className="text-xs text-secondary hover:underline">Ver todas</Link>
          </div>
          {nsEmExec.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma NS em execução.</p>
          ) : (
            <ul className="overflow-y-auto flex-1 min-h-0 divide-y divide-border/50">
              {nsEmExec.map((os) => (
                <li key={os.id}>
                  <Link
                    to={`/ordens/${os.id}`}
                    className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/40 rounded transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground w-[68px] truncate">{os.trecho}</span>
                    <span className="text-[11px] text-muted-foreground flex-1 truncate">{os.bacia}</span>
                    <span className="text-[11px] text-foreground font-medium tabular-nums w-[58px] text-right">
                      {(os.comprimento_previsto ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}m
                    </span>
                    <StatusBadge status={os.status} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity Feed — 30% */}
        <div className="dc-activity col-span-3 h-[420px]">
          <ActivityFeed />
        </div>
      </div>
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

const useRealEvents = () => {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [prod, topo, mat, status] = await Promise.all([
        supabase.from('registros_producao')
          .select('id, data_registro, comprimento_dia, ligacoes_dia, user_id, os_id, created_at')
          .order('created_at', { ascending: false }).limit(30),
        supabase.from('topografia_asbuilt')
          .select('id, nome_estaca, registrado_por, os_id, created_at')
          .order('created_at', { ascending: false }).limit(30),
        supabase.from('materiais_entrega')
          .select('id, descricao, quantidade, unidade, registrado_por, os_id, created_at')
          .order('created_at', { ascending: false }).limit(30),
        supabase.from('os_status_historico')
          .select('id, status_anterior, status_novo, user_id, os_id, created_at')
          .eq('status_novo', 'VERMELHO')
          .order('created_at', { ascending: false }).limit(30),
      ]);

      const userIds = new Set<string>();
      const osIds = new Set<string>();
      (prod.data || []).forEach((r: any) => { r.user_id && userIds.add(r.user_id); r.os_id && osIds.add(r.os_id); });
      (topo.data || []).forEach((r: any) => { r.registrado_por && userIds.add(r.registrado_por); r.os_id && osIds.add(r.os_id); });
      (mat.data || []).forEach((r: any) => { r.registrado_por && userIds.add(r.registrado_por); r.os_id && osIds.add(r.os_id); });
      (status.data || []).forEach((r: any) => { r.user_id && userIds.add(r.user_id); r.os_id && osIds.add(r.os_id); });

      const [profs, oss] = await Promise.all([
        userIds.size ? supabase.from('profiles').select('user_id, display_name, email').in('user_id', Array.from(userIds)) : Promise.resolve({ data: [] as any[] }),
        osIds.size ? supabase.from('ordens_servico').select('id, trecho, liberado_para').in('id', Array.from(osIds)) : Promise.resolve({ data: [] as any[] }),
      ]);
      const uMap: Record<string, string> = {};
      (profs.data || []).forEach((p: any) => { uMap[p.user_id] = p.display_name || p.email || ''; });
      const oMap: Record<string, { trecho: string; liberado_para: string | null }> = {};
      (oss.data || []).forEach((o: any) => { oMap[o.id] = { trecho: o.trecho, liberado_para: o.liberado_para }; });

      const all: FeedEvent[] = [];
      (prod.data || []).forEach((r: any) => {
        const parts: string[] = [];
        if (r.comprimento_dia) parts.push(`${Number(r.comprimento_dia).toLocaleString('pt-BR')}m`);
        if (r.ligacoes_dia) parts.push(`${r.ligacoes_dia} ligações`);
        all.push({
          id: `p-${r.id}`, type: 'producao', ts: new Date(r.created_at),
          who: uMap[r.user_id] || 'Usuário',
          description: `registrou ${parts.join(' e ') || 'produção'}${oMap[r.os_id] ? ` em ${oMap[r.os_id].trecho}` : ''}`,
        });
      });
      (topo.data || []).forEach((r: any) => {
        all.push({
          id: `t-${r.id}`, type: 'topografia', ts: new Date(r.created_at),
          who: uMap[r.registrado_por] || 'Topógrafo',
          description: `registrou estaca ${r.nome_estaca || ''}${oMap[r.os_id] ? ` em ${oMap[r.os_id].trecho}` : ''}`.trim(),
        });
      });
      (mat.data || []).forEach((r: any) => {
        all.push({
          id: `m-${r.id}`, type: 'almoxarifado', ts: new Date(r.created_at),
          who: uMap[r.registrado_por] || 'Almoxarifado',
          description: `Entrega: ${r.quantidade} ${r.unidade} de ${r.descricao}${oMap[r.os_id] ? ` para ${oMap[r.os_id].trecho}` : ''}`,
        });
      });
      (status.data || []).forEach((r: any) => {
        const os = oMap[r.os_id];
        all.push({
          id: `s-${r.id}`, type: 'ns', ts: new Date(r.created_at),
          who: uMap[r.user_id] || 'Sala Técnica',
          description: `NS ${os?.trecho || ''} liberada${os?.liberado_para ? ` para ${os.liberado_para}` : ''}`,
        });
      });

      all.sort((a, b) => b.ts.getTime() - a.ts.getTime());
      if (!cancelled) {
        setEvents(all.slice(0, 30));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { events, loading };
};

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
  const { events, loading } = useRealEvents();
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Radio size={14} className="text-secondary" />
          O que está acontecendo?
        </h3>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 pr-1">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            <Loader2 className="animate-spin mr-2" size={14} /> Carregando…
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground text-center px-4">
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};
