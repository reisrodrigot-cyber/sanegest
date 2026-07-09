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
  
  Layers,
  Loader2,
  Radio,
  Cable,
} from 'lucide-react';
import { MapaInterativo } from '@/components/mapa/MapaInterativo';
import { aplicarRealValidadoEmRegistros, type OSRealInput } from '@/lib/realEfetivo';

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
  comprimento_real: number | null;
  ligacoes_real: number | null;
  real_validado: boolean | null;
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
  { label: 'Até 1,25m', max: 1.25 },
  { label: '1,25m a 2,00m', max: 2.0 },
  { label: '2,00m a 3,00m', max: 3.0 },
  { label: 'Acima de 3,00m', max: Infinity },
];
const faixaIndex = (prof: number | null) => {
  if (prof == null) return -1;
  if (prof <= 1.25) return 0;
  if (prof <= 2.0) return 1;
  if (prof <= 3.0) return 2;
  return 3;
};

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fmtDateBR = (iso: string) => iso.split('-').reverse().join('/');

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
  const [registrosBrutos, setRegistrosBrutos] = useState<any[]>([]);
  const [osRows, setOsRows] = useState<OSRow[]>([]);
  const [ligacoesRows, setLigacoesRows] = useState<{ os_id: string; comprimento: number | null; registro_producao_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [baciaFilter, setBaciaFilter] = useState('');
  const [baciaMode, setBaciaMode] = useState<'todas' | 'com_execucao'>('todas');
  const [subBaciaTab, setSubBaciaTab] = useState<'rede' | 'ligacoes' | 'resumo'>('rede');
  const [periodoInicio, setPeriodoInicio] = useState<string>('');
  const [periodoFim, setPeriodoFim] = useState<string>('');

  const [encNames, setEncNames] = useState<Record<string, string>>({});

  useEffect(() => {
    // Todos os fetches abaixo usam paginação em blocos de 1000, porque a API
    // do PostgREST corta a resposta em 1000 linhas por padrão. Sem isso, ordens
    // de serviço, registros de produção ou ligações que caíssem fora da
    // primeira página sumiriam silenciosamente dos KPIs e cards.
    const fetchAllPaged = async <T,>(
      build: (from: number, to: number) => any,
    ): Promise<T[]> => {
      const all: T[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await build(from, from + pageSize - 1);
        if (error) break;
        const rows = (data ?? []) as T[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    };

    const fetchAllOrdens = () => fetchAllPaged<OSRow>((from, to) =>
      supabase
        .from('ordens_servico')
        .select('id, prof_media_prevista, comprimento_real, ligacoes_real, real_validado')
        .order('id', { ascending: true })
        .range(from, to),
    );
    const fetchAllRegistros = () => fetchAllPaged<any>((from, to) =>
      supabase
        .from('registros_producao')
        .select('id, user_id, data_registro, comprimento_dia, os_id, comprimento_ajustado, ligacoes_dia, ligacoes_ajustadas, status')
        .eq('excluido', false).eq('status', 'ativo')
        .order('data_registro', { ascending: true })
        .range(from, to),
    );
    const fetchAllLigacoes = () => fetchAllPaged<{ os_id: string; comprimento: number | null; registro_producao_id: string | null }>((from, to) =>
      supabase
        .from('ligacoes')
        .select('os_id, comprimento, registro_producao_id')
        .order('created_at', { ascending: true })
        .range(from, to),
    );

    Promise.all([fetchAllRegistros(), fetchAllOrdens(), fetchAllLigacoes()])
      .then(([r, o, l]) => {
        setRegistrosBrutos(r);
        setOsRows(o);
        setLigacoesRows(l);
        setLoading(false);
      });
  }, []);



  useEffect(() => {
    supabase.from('profiles').select('user_id, display_name, email, apelido').then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.user_id] = p.apelido || p.display_name || p.email || '—'; });
      setEncNames(m);
    });
  }, []);

  // Aplica a regra do REAL validado da sala técnica: quando a OS está validada,
  // os registros brutos são escalonados para que o total bata com o valor oficial.
  // Isto evita que duplicidades de campo apareçam em qualquer dashboard/relatório.
  const registros = useMemo(
    () => aplicarRealValidadoEmRegistros(registrosBrutos, osRows as OSRealInput[]),
    [registrosBrutos, osRows],
  );

  // Primeira data com produção registrada (para o período "Todo o período").
  const firstProducaoDate = useMemo(() => {
    let min: string | null = null;
    (registrosBrutos as any[]).forEach((r) => {
      const d = String(r?.data_registro ?? '');
      if (!d) return;
      if (min === null || d < min) min = d;
    });
    return min;
  }, [registrosBrutos]);

  // Preenche o filtro com [primeira data de produção .. hoje] assim que os
  // registros carregam. O usuário pode ajustar depois; se limpar um dos
  // campos, o cálculo faz fallback para o padrão.
  useEffect(() => {
    if (!firstProducaoDate) return;
    const hojeIso = toISODate(new Date());
    setPeriodoInicio((v) => v || firstProducaoDate);
    setPeriodoFim((v) => v || hojeIso);
  }, [firstProducaoDate]);

  // Período selecionado — afeta APENAS "Produção por Encarregado" e
  // "Produtividade por Profundidade". Demais cards permanecem com suas
  // próprias regras (acumulado, ontem, últimos 30d, histórico mensal, KPI
  // superior "Produção diária média da obra").
  const periodo = useMemo(() => {
    const hojeIso = toISODate(new Date());
    const iniRaw = periodoInicio || firstProducaoDate || hojeIso;
    const fimRaw = periodoFim || hojeIso;
    const [inicio, fim] = iniRaw <= fimRaw ? [iniRaw, fimRaw] : [fimRaw, iniRaw];
    return { inicio, fim };
  }, [periodoInicio, periodoFim, firstProducaoDate]);

  const registrosPeriodo = useMemo(
    () => registros.filter((r) => r.data_registro >= periodo.inicio && r.data_registro <= periodo.fim),
    [registros, periodo.inicio, periodo.fim],
  );


  // Force Recharts ResponsiveContainer to recalc on mount (fixes empty charts on mobile)
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(fire, 100);
    const t2 = setTimeout(fire, 400);
    const t3 = setTimeout(fire, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const compAtual = (r: any) =>
    Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
  const ligAtual = (r: any) =>
    Number(r.ligacoes_ajustadas ?? r.ligacoes_dia) || 0;

  // Produção por encarregado no período — total, dias e média/dia (somente rede)
  const porEncarregado = useMemo(() => {
    const map = new Map<string, { nome: string; ns: Set<string>; total: number; days: Set<string> }>();
    registrosPeriodo.forEach((r) => {
      const metros = compAtual(r);
      if (metros <= 0) return;
      const nome = encNames[r.user_id] || '—';
      const c = map.get(r.user_id) ?? { nome, ns: new Set<string>(), total: 0, days: new Set<string>() };
      c.nome = nome;
      c.ns.add(r.os_id);
      c.total += metros;
      c.days.add(r.data_registro);
      map.set(r.user_id, c);
    });
    return Array.from(map.values())
      .map((v) => ({
        nome: v.nome,
        ns: v.ns.size,
        total: v.total,
        dias: v.days.size,
        media: v.days.size > 0 ? v.total / v.days.size : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [registrosPeriodo, encNames]);

  const kpis = useMemo(() => {
    const totalPrevisto = ordens.reduce((s, o) => s + (o.comprimento_previsto ?? 0), 0);
    const totalExecutado = ordens.reduce((s, o) => s + (o.comprimento_real ?? 0), 0);
    const pct = totalPrevisto > 0 ? Math.round((totalExecutado / totalPrevisto) * 100) : 0;

    // Produção ontem — sempre fixo em ontem (não segue o filtro de período).
    const regsOntem = registros.filter((r) => r.data_registro === yesterdayStr);
    const producaoOntem = regsOntem.reduce((s, r) => s + compAtual(r), 0);
    const ligacoesOntem = regsOntem.reduce((s, r) => s + ligAtual(r), 0);

    // Produção diária média da obra — INDEPENDENTE do filtro de período.
    // Soma das médias diárias de cada encarregado considerando TODO o
    // histórico ativo. Só rede; ligações não entram.
    const userAgg = new Map<string, { total: number; days: Set<string> }>();
    registros.forEach((r) => {
      const metros = compAtual(r);
      if (metros <= 0) return;
      const key = String(r.user_id ?? '—');
      const c = userAgg.get(key) ?? { total: 0, days: new Set<string>() };
      c.total += metros;
      c.days.add(r.data_registro);
      userAgg.set(key, c);
    });
    let producaoDiariaMediaObra = 0;
    userAgg.forEach((v) => { if (v.days.size > 0) producaoDiariaMediaObra += v.total / v.days.size; });

    return {
      avancoLabel: `${Math.round(totalExecutado).toLocaleString('pt-BR')} / ${Math.round(totalPrevisto).toLocaleString('pt-BR')} m`,
      avancoPct: `${pct}%`,
      producaoOntem: `${(Math.round(producaoOntem * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`,
      producaoOntemSub: ligacoesOntem > 0
        ? `${ligacoesOntem} ${ligacoesOntem === 1 ? 'ligação' : 'ligações'}`
        : 'sem ligações',
      producaoDiariaMediaObra: `${Math.round(producaoDiariaMediaObra * 10) / 10} m/dia`,
    };
  }, [ordens, registros, yesterdayStr]);

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

  // Produtividade por Profundidade (conceito APO):
  //   produtividade_faixa = metros_rede_da_faixa / dias_proporcionais_da_faixa
  //   Para cada par (encarregado, data), 1 dia é rateado entre as faixas em
  //   que ele produziu rede naquele dia, proporcionalmente aos metros de cada
  //   faixa. Ex.: 30m em <=1,25 e 70m em 1,25-2,00 no mesmo dia → 0,30 dia e
  //   0,70 dia respectivamente. Ligações não entram.
  const profStats = useMemo(() => {
    const osProf = new Map<string, number | null>();
    osRows.forEach((o) => osProf.set(o.id, o.prof_media_prevista != null ? Number(o.prof_media_prevista) : null));
    // Agrupa metros por (encarregado, data, faixa)
    const porPar = new Map<string, number[]>(); // key -> array por faixa
    registrosPeriodo.forEach((r) => {
      const metros = Number(r.comprimento_dia) || 0;
      if (metros <= 0) return;
      const idx = faixaIndex(osProf.get(r.os_id) ?? null);
      if (idx < 0) return;
      const key = `${r.user_id ?? 'sem-user'}|${r.data_registro}`;
      let arr = porPar.get(key);
      if (!arr) { arr = FAIXAS.map(() => 0); porPar.set(key, arr); }
      arr[idx] += metros;
    });
    const totais = FAIXAS.map(() => 0);
    const diasProp = FAIXAS.map(() => 0);
    porPar.forEach((arr) => {
      const totalDia = arr.reduce((s, v) => s + v, 0);
      if (totalDia <= 0) return;
      arr.forEach((m, i) => {
        if (m <= 0) return;
        totais[i] += m;
        diasProp[i] += m / totalDia;
      });
    });
    const medias = totais.map((t, i) => (diasProp[i] > 0 ? t / diasProp[i] : 0));
    const max = Math.max(1, ...medias);
    return FAIXAS.map((f, i) => ({
      label: f.label,
      media: Math.round(medias[i] * 10) / 10,
      total: Math.round(totais[i]),
      pctBar: (medias[i] / max) * 100,
    }));
  }, [registrosPeriodo, osRows]);

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


  // Ligações executadas — fonte de verdade é a tabela `ligacoes`, filtradas por
  // vinculação a um registro de produção ATIVO (não excluído, não cancelado).
  // A extensão é a soma direta de `ligacoes.comprimento` (valor final vigente;
  // `comprimento_original` é auditoria e nunca entra em produção executada).
  // Ligações são acumulado geral da obra — NÃO seguem o filtro de período dos
  // cards de análise. Consideramos todos os registros de produção ativos.
  const activeRegistroIds = useMemo(() => {
    const s = new Set<string>();
    (registrosBrutos as any[]).forEach((r) => {
      if (!r?.id) return;
      s.add(String(r.id));
    });
    return s;
  }, [registrosBrutos]);

  const ligacoesExecutadasPorOs = useMemo(() => {
    const map = new Map<string, { count: number; comprimento: number }>();
    ligacoesRows.forEach((l) => {
      if (!l.registro_producao_id) return;
      if (!activeRegistroIds.has(String(l.registro_producao_id))) return;
      const c = map.get(l.os_id) ?? { count: 0, comprimento: 0 };
      c.count += 1;
      c.comprimento += Number(l.comprimento) || 0;
      map.set(l.os_id, c);
    });
    return map;
  }, [ligacoesRows, activeRegistroIds]);

  // Aliases para preservar o restante do dashboard (sub-bacias, tabelas) usando
  // a MESMA fonte de verdade das ligações executadas.
  const qtdLigacoesPorOs = useMemo(() => {
    const m = new Map<string, number>();
    ligacoesExecutadasPorOs.forEach((v, k) => m.set(k, v.count));
    return m;
  }, [ligacoesExecutadasPorOs]);
  const ligCompExecutadoPorOs = useMemo(() => {
    const m = new Map<string, number>();
    ligacoesExecutadasPorOs.forEach((v, k) => m.set(k, v.comprimento));
    return m;
  }, [ligacoesExecutadasPorOs]);

  // Totais de ligações (para KPI) — soma direta de ligacoes.comprimento das
  // ligações vinculadas a registros ativos.
  const totaisLigacoes = useMemo(() => {
    let qtd = 0;
    let comprimento = 0;
    ligacoesExecutadasPorOs.forEach((v) => { qtd += v.count; comprimento += v.comprimento; });
    return { qtd, comprimento };
  }, [ligacoesExecutadasPorOs]);

  // Avanço por Sub-bacia (todas as NS, independente de status/liberação)
  const porTrecho = useMemo(() => {
    const map = new Map<string, { executado: number; total: number; ligQtd: number; ligComp: number }>();
    ordens.forEach((o) => {
      const bacia = o.bacia || 'Sem bacia';
      const prev = o.comprimento_previsto ?? 0;
      const exec = Math.min(o.comprimento_real ?? 0, prev);
      const c = map.get(bacia) ?? { executado: 0, total: 0, ligQtd: 0, ligComp: 0 };
      if (prev > 0) {
        c.executado += exec;
        c.total += prev;
      }
      c.ligQtd += qtdLigacoesPorOs.get(o.id) ?? 0;
      c.ligComp += ligCompExecutadoPorOs.get(o.id) ?? 0;
      map.set(bacia, c);
    });
    return Array.from(map.entries())
      .map(([bacia, v]) => ({
        trecho: bacia,
        executado: Math.round(v.executado),
        pendente: Math.round(Math.max(v.total - v.executado, 0)),
        total: Math.round(v.total),
        pct: v.total > 0 ? Math.round((v.executado / v.total) * 100) : 0,
        ligQtd: v.ligQtd,
        ligComp: Math.round(v.ligComp * 100) / 100,
      }))
      .sort((a, b) => String(a.trecho).localeCompare(String(b.trecho), 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [ordens, qtdLigacoesPorOs, ligCompExecutadoPorOs]);

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

  const totalPeriodo = porEncarregado.reduce((s, e) => s + e.total, 0);
  const somaMediasPeriodo = porEncarregado.reduce((s, e) => s + e.media, 0);

  // Dropdown discreto de período (usado apenas nos cards afetados)
  const PeriodoDropdown = () => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setPeriodoMenuOpen((v) => !v)}
        className="inline-flex items-center gap-1 h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded transition-colors"
        title="Alterar período de análise"
      >
        <span>Período: {PERIODO_LABELS[periodoTipo]}</span>
        <span className="opacity-60">▾</span>
      </button>
      {periodoMenuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPeriodoMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-card border border-border rounded-md shadow-lg p-1 min-w-[180px]">
            {(Object.keys(PERIODO_LABELS) as PeriodoTipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setPeriodoTipo(t); if (t !== 'personalizado') setPeriodoMenuOpen(false); }}
                className={`w-full text-left text-[11px] px-2 py-1 rounded hover:bg-muted transition-colors ${
                  periodoTipo === t ? 'text-foreground font-semibold bg-muted/60' : 'text-foreground/80'
                }`}
              >
                {PERIODO_LABELS[t]}
              </button>
            ))}
            {periodoTipo === 'personalizado' && (
              <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-border px-1">
                <input
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="h-6 px-1.5 text-[10px] rounded border border-border bg-background text-foreground"
                />
                <input
                  type="date"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  className="h-6 px-1.5 text-[10px] rounded border border-border bg-background text-foreground"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const periodoRangeLabel = `${fmtDateBR(periodo.inicio)} a ${fmtDateBR(periodo.fim)}`;

  return (
    <div className="dc-root flex flex-col gap-3">


      {/* Row 1 — KPIs */}
      <div className="dc-kpis grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp size={16} />}
          label="Avanço Físico"
          value={kpis.avancoPct}
          sub={kpis.avancoLabel}
          accent={accent.blueDark}
        />
        <KpiCard
          icon={<CalendarDays size={16} />}
          label="Produção Ontem"
          value={kpis.producaoOntem}
          sub={kpis.producaoOntemSub}
          accent={accent.green}
        />
        <KpiCard
          icon={<Activity size={16} />}
          label="Produção diária média da obra"
          value={kpis.producaoDiariaMediaObra}
          sub={`${PERIODO_LABELS[periodoTipo]} • ${periodoRangeLabel}`}
          accent={accent.blue}
        />
        <KpiCard
          icon={<Cable size={16} />}
          label="Ligações"
          value={`${totaisLigacoes.qtd.toLocaleString('pt-BR')} un`}
          sub={`${totaisLigacoes.comprimento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m executados`}
          accent={accent.purple}
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
                showLocation
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
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-foreground">Produção por Encarregado</h3>
              <div className="flex flex-col items-end -mt-0.5">
                <PeriodoDropdown />
                <span className="text-[10px] text-muted-foreground leading-tight">{periodoRangeLabel}</span>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-1 font-medium">Encarregado</th>
                    <th className="pb-1 font-medium text-right">Produção (m)</th>
                    <th className="pb-1 font-medium text-right">Média (m/dia)</th>
                  </tr>
                </thead>
                <tbody>
                  {porEncarregado.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-muted-foreground py-3">Sem dados</td></tr>
                  ) : porEncarregado.map((e) => (
                    <tr key={e.nome} className="border-b border-border/40">
                      <td className="py-1 text-foreground">{e.nome}</td>
                      <td className="py-1 text-right font-semibold">
                        {(Math.round(e.total * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                      </td>
                      <td className="py-1 text-right text-foreground">
                        {(Math.round(e.media * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {porEncarregado.length > 0 && (
              <div className="border-t border-border mt-2 pt-2 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total produção</span>
                  <span className="font-semibold text-foreground">
                    {(Math.round(totalPeriodo * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produção diária média da obra</span>
                  <span className="font-semibold text-foreground">
                    {(Math.round(somaMediasPeriodo * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m/dia
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="dc-table-bacia bg-card rounded-lg border border-border shadow-sm p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Layers size={14} className="text-muted-foreground" />
                Produtividade por Profundidade
              </div>
              <div className="flex flex-col items-end -mt-0.5">
                <PeriodoDropdown />
                <span className="text-[10px] text-muted-foreground leading-tight">{periodoRangeLabel}</span>
              </div>
            </div>
            {loading ? (
              <Loader2 className="animate-spin text-muted-foreground mx-auto my-2" size={14} />
            ) : (
              <div className="space-y-1.5 overflow-y-auto flex-1">
                {profStats.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-[11px] text-foreground w-[110px] truncate">{s.label}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.pctBar}%`, backgroundColor: accent.blue }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-foreground w-[58px] text-right">
                      {s.media.toLocaleString('pt-BR')} m/d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 — Bacia (50%) + NS em Execução (20%) + Activity Feed (30%) */}
      <div className="dc-row3 grid grid-cols-10 gap-3 items-stretch">
        {/* Avanço por Sub-bacia — 50% */}
        {(() => {
          const filtered = porTrecho.filter(b => {
            const temExec = b.executado > 0 || b.ligQtd > 0 || b.ligComp > 0;
            if (baciaMode === 'com_execucao' && !temExec) return false;
            if (baciaFilter && !String(b.trecho).toLowerCase().includes(baciaFilter.toLowerCase())) return false;
            return true;
          });
          // Aba Rede só considera sub-bacias com previsto > 0
          const filteredRede = filtered.filter((b) => b.total > 0);
          // Aba Ligações só sub-bacias com alguma ligação executada
          const filteredLig = filtered
            .filter((b) => b.ligQtd > 0 || b.ligComp > 0)
            .sort((a, b) => b.ligQtd - a.ligQtd);
          const innerHeight = Math.max(160, filteredRede.length * 22 + 30);
          const mobileBaciaHeight = Math.max(200, Math.min(360, innerHeight));
          const ligBarHeight = Math.max(160, filteredLig.length * 22 + 30);
          const mobileLigHeight = Math.max(200, Math.min(360, ligBarHeight));
          const tabBtn = (active: boolean) =>
            `h-7 px-2 text-[11px] rounded border ${active ? 'bg-[#4dd9ac] text-[#0d1b2a] border-[#4dd9ac]' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'}`;
          return (
            <div className="dc-bacia col-span-5 rounded-lg shadow-sm p-3 flex flex-col h-[420px]" style={darkCardStyle}>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white">Avanço por Sub-bacia</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSubBaciaTab('rede')} className={tabBtn(subBaciaTab === 'rede')}>Rede</button>
                  <button onClick={() => setSubBaciaTab('ligacoes')} className={tabBtn(subBaciaTab === 'ligacoes')}>Ligações</button>
                  <button onClick={() => setSubBaciaTab('resumo')} className={tabBtn(subBaciaTab === 'resumo')}>Resumo</button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBaciaMode('com_execucao')}
                    className={tabBtn(baciaMode === 'com_execucao')}
                  >
                    Com execução
                  </button>
                  <button
                    onClick={() => setBaciaMode('todas')}
                    className={tabBtn(baciaMode === 'todas')}
                  >
                    Todas
                  </button>
                </div>
              </div>

              {subBaciaTab === 'rede' && (
                <>
                  <div className="flex items-center gap-3 text-[11px] text-white/80 mb-1">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GREEN_EXEC }} />
                      Executado
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RED_PEND }} />
                      Pendente
                    </span>
                  </div>
                  {filteredRede.length === 0 ? (
                    <p className="text-xs text-white/60 text-center py-6">Sem dados.</p>
                  ) : (
                    <div className="overflow-y-auto flex-1 min-h-0">
                      <ChartFrame className="dc-chart-box" mobileHeight={mobileBaciaHeight} desktopHeight={innerHeight}>
                        {(chartWidth, chartHeight) => (
                          <BarChart
                            width={chartWidth}
                            height={chartHeight}
                            data={filteredRede}
                            layout="vertical"
                            margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
                            barCategoryGap={4}
                            barSize={14}
                          >
                            <CartesianGrid stroke={DARK_GRID} strokeDasharray="0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: DARK_AXIS }} stroke={DARK_GRID} />
                            <YAxis type="category" dataKey="trecho" tick={{ fontSize: 11, fill: DARK_AXIS }} stroke={DARK_GRID} width={120} />
                            <Tooltip
                              contentStyle={darkTooltipStyle}
                              labelStyle={{ color: '#fff' }}
                              formatter={(v: number, n: string) => [`${v.toLocaleString('pt-BR')} m`, n === 'executado' ? 'Executado' : 'Pendente']}
                            />
                            <Bar dataKey="executado" stackId="a" fill={GREEN_EXEC} name="executado" barSize={14}>
                              <LabelList dataKey="executado" position="center" formatter={(v: number) => (v > 0 ? v.toLocaleString('pt-BR') : '')} fill="#fff" fontSize={10} />
                            </Bar>
                            <Bar dataKey="pendente" stackId="a" fill={RED_PEND} name="pendente" barSize={14}>
                              <LabelList dataKey="pendente" position="center" formatter={(v: number) => (v > 0 ? v.toLocaleString('pt-BR') : '')} fill="#fff" fontSize={10} />
                              <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} fill="#4dd9ac" fontSize={11} offset={8} />
                            </Bar>
                          </BarChart>
                        )}
                      </ChartFrame>
                    </div>
                  )}
                </>
              )}

              {subBaciaTab === 'ligacoes' && (
                <>
                  <p className="text-[11px] text-white/60 mb-1">
                    Somente produção executada. Ligações não têm previsto confiável.
                  </p>
                  {filteredLig.length === 0 ? (
                    <p className="text-xs text-white/60 text-center py-6">Nenhuma ligação executada.</p>
                  ) : (
                    <div className="overflow-y-auto flex-1 min-h-0">
                      <table className="w-full text-xs text-white/90">
                        <thead className="sticky top-0" style={{ backgroundColor: DARK_BG }}>
                          <tr className="text-left text-white/60 border-b border-white/10">
                            <th className="py-1 pr-2 font-medium">Sub-bacia</th>
                            <th className="py-1 px-2 font-medium text-right">Ligações (un)</th>
                            <th className="py-1 pl-2 font-medium text-right">Comprimento (m)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLig.map((b) => (
                            <tr key={b.trecho} className="border-b border-white/5">
                              <td className="py-1 pr-2">{b.trecho}</td>
                              <td className="py-1 px-2 text-right tabular-nums font-semibold" style={{ color: TEAL }}>
                                {b.ligQtd.toLocaleString('pt-BR')}
                              </td>
                              <td className="py-1 pl-2 text-right tabular-nums">
                                {b.ligComp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {subBaciaTab === 'resumo' && (
                <>
                  <p className="text-[11px] text-white/60 mb-1">
                    Total em metros = rede + comprimento das ligações. Não é avanço físico total (ligações não têm previsto confiável).
                  </p>
                  {filtered.length === 0 ? (
                    <p className="text-xs text-white/60 text-center py-6">Sem dados.</p>
                  ) : (
                    <div className="overflow-y-auto flex-1 min-h-0">
                      <table className="w-full text-xs text-white/90">
                        <thead className="sticky top-0" style={{ backgroundColor: DARK_BG }}>
                          <tr className="text-left text-white/60 border-b border-white/10">
                            <th className="py-1 pr-2 font-medium">Sub-bacia</th>
                            <th className="py-1 px-2 font-medium text-right">Rede exec. (m)</th>
                            <th className="py-1 px-2 font-medium text-right">Avanço rede</th>
                            <th className="py-1 px-2 font-medium text-right">Lig. (un)</th>
                            <th className="py-1 px-2 font-medium text-right">Lig. (m)</th>
                            <th className="py-1 pl-2 font-medium text-right">Total (m)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((b) => (
                            <tr key={b.trecho} className="border-b border-white/5">
                              <td className="py-1 pr-2">{b.trecho}</td>
                              <td className="py-1 px-2 text-right tabular-nums">{b.executado.toLocaleString('pt-BR')}</td>
                              <td className="py-1 px-2 text-right tabular-nums" style={{ color: b.total > 0 ? TEAL : 'rgba(255,255,255,0.4)' }}>
                                {b.total > 0 ? `${b.pct}%` : '—'}
                              </td>
                              <td className="py-1 px-2 text-right tabular-nums">{b.ligQtd.toLocaleString('pt-BR')}</td>
                              <td className="py-1 px-2 text-right tabular-nums">
                                {b.ligComp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-1 pl-2 text-right tabular-nums font-semibold">
                                {(b.executado + b.ligComp).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
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
                    <span
                      className={`status-dot-${(os.status || 'CINZA').toLowerCase()} w-2 h-2 rounded-full flex-shrink-0`}
                      title={os.status}
                      aria-label={`Status: ${os.status}`}
                    />

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
          .select('id, data_registro, comprimento_dia, ligacoes_dia, comprimento_ajustado, ligacoes_ajustadas, user_id, os_id, created_at, updated_at, status')
          .eq('excluido', false)
          .order('updated_at', { ascending: false }).limit(40),
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
        userIds.size ? supabase.from('profiles').select('user_id, display_name, email, apelido').in('user_id', Array.from(userIds)) : Promise.resolve({ data: [] as any[] }),
        osIds.size ? supabase.from('ordens_servico').select('id, trecho, liberado_para').in('id', Array.from(osIds)) : Promise.resolve({ data: [] as any[] }),
      ]);
      const uMap: Record<string, string> = {};
      (profs.data || []).forEach((p: any) => { uMap[p.user_id] = p.apelido || p.display_name || p.email || ''; });
      const oMap: Record<string, { trecho: string; liberado_para: string | null }> = {};
      (oss.data || []).forEach((o: any) => { oMap[o.id] = { trecho: o.trecho, liberado_para: o.liberado_para }; });

      const all: FeedEvent[] = [];
      (prod.data || []).forEach((r: any) => {
        const compAtual = Number(r.comprimento_ajustado ?? r.comprimento_dia) || 0;
        const ligAtual = Number(r.ligacoes_ajustadas ?? r.ligacoes_dia) || 0;
        const parts: string[] = [];
        if (compAtual) parts.push(`${compAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m de rede`);
        if (ligAtual) parts.push(`${ligAtual} ${ligAtual === 1 ? 'ligação' : 'ligações'}`);
        const trecho = oMap[r.os_id]?.trecho;
        const dataBR = r.data_registro
          ? r.data_registro.split('-').reverse().join('/')
          : '';
        const createdMs = r.created_at ? new Date(r.created_at).getTime() : 0;
        const updatedMs = r.updated_at ? new Date(r.updated_at).getTime() : createdMs;
        const isEdit = updatedMs - createdMs > 60_000 || r.status === 'cancelado';
        if (isEdit) {
          const statusLabel = r.status === 'cancelado' ? 'cancelada' : 'contabilizada na produção';
          all.push({
            id: `pe-${r.id}`, type: 'producao', ts: new Date(updatedMs),
            who: uMap[r.user_id] || 'Usuário',
            description: `editou produção${trecho ? ` — ${trecho}` : ''}${dataBR ? ` — ${dataBR}` : ''} — ${parts.join(' e ') || '0m'} — ${statusLabel}`,
          });
        }
        all.push({
          id: `p-${r.id}`, type: 'producao', ts: new Date(r.created_at),
          who: uMap[r.user_id] || 'Usuário',
          description: `registrou ${parts.join(' e ') || 'produção'}${trecho ? ` em ${trecho}` : ''}`,
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
