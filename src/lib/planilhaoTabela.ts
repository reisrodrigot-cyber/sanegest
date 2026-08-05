import type { OSDisplayStatus } from '@/lib/osStatus';
import { statusLabel, vinculoDisplayStatus, STATUS_PRIORITY_DESC } from '@/lib/osStatus';

/** Uma linha consolidada da grade: exatamente uma por Bacia + Trecho. */
export interface PlanilhaoRow {
  key: string;
  osIds: string[];
  bacia: string;
  trecho: string;
  pv_montante: string;
  pv_jusante: string;
  previsto_m: number | null;
  real_m: number | null;
  saldo_m: number | null;
  encarregados: string;
  periodo: string;
  primeira_data: string | null;
  ultima_data: string | null;
  dias_producao: number;
  status: OSDisplayStatus;
  status_label: string;
  concluido: boolean;
  dn: number | null;
  prof_media_prevista: number | null;
  largura_vala: number | null;
  pav_previsto: string;
  ligacoes_previstas: number | null;
  ligacoes_realizadas: number | null;
  ligacoes_comprimento_m: number | null;
  prazo_previsto: number | null;
  liberado: string;
  responsavel_previsto: string;
}

export type ColumnType = 'text' | 'number';

export interface PlanilhaoColumn {
  id: keyof PlanilhaoRow & string;
  label: string;
  type: ColumnType;
  width: number;
  /** Casas decimais para colunas numéricas. */
  decimals?: number;
  /** Soma no totalizador. */
  total?: boolean;
}

/** Colunas visíveis por padrão, na ordem inicial exigida. */
export const DEFAULT_VISIBLE: string[] = [
  'trecho', 'bacia', 'previsto_m', 'real_m', 'saldo_m', 'encarregados', 'periodo', 'status_label',
];

export const PLANILHAO_COLUMNS: PlanilhaoColumn[] = [
  { id: 'trecho', label: 'Trecho', type: 'text', width: 120 },
  { id: 'bacia', label: 'Bacia', type: 'text', width: 140 },
  { id: 'previsto_m', label: 'Previsto (m)', type: 'number', width: 120, decimals: 2, total: true },
  { id: 'real_m', label: 'Real (m)', type: 'number', width: 110, decimals: 2, total: true },
  { id: 'saldo_m', label: 'Saldo (m)', type: 'number', width: 110, decimals: 2, total: true },
  { id: 'encarregados', label: 'Encarregado(s)', type: 'text', width: 220 },
  { id: 'periodo', label: 'Período', type: 'text', width: 180 },
  { id: 'status_label', label: 'Status', type: 'text', width: 140 },
  { id: 'pv_montante', label: 'PV Montante', type: 'text', width: 130 },
  { id: 'pv_jusante', label: 'PV Jusante', type: 'text', width: 130 },
  { id: 'dn', label: 'DN', type: 'number', width: 90, decimals: 2 },
  { id: 'prof_media_prevista', label: 'Prof. média prevista (m)', type: 'number', width: 170, decimals: 2 },
  { id: 'largura_vala', label: 'Largura de vala (m)', type: 'number', width: 150, decimals: 2 },
  { id: 'pav_previsto', label: 'Pavimento previsto', type: 'text', width: 160 },
  { id: 'ligacoes_previstas', label: 'Ligações previstas', type: 'number', width: 150, decimals: 0, total: true },
  { id: 'ligacoes_realizadas', label: 'Ligações realizadas', type: 'number', width: 155, decimals: 0, total: true },
  { id: 'ligacoes_comprimento_m', label: 'Ligações (m)', type: 'number', width: 130, decimals: 2, total: true },
  { id: 'prazo_previsto', label: 'Prazo previsto (dias)', type: 'number', width: 160, decimals: 0 },
  { id: 'dias_producao', label: 'Dias com produção', type: 'number', width: 150, decimals: 0, total: true },
  { id: 'liberado', label: 'Liberada', type: 'text', width: 110 },
  { id: 'responsavel_previsto', label: 'Liberada para', type: 'text', width: 170 },
  { id: 'primeira_data', label: 'Primeira produção', type: 'text', width: 150 },
  { id: 'ultima_data', label: 'Última produção', type: 'text', width: 150 },
];

export const COLUMN_BY_ID: Record<string, PlanilhaoColumn> = Object.fromEntries(
  PLANILHAO_COLUMNS.map(c => [c.id, c]),
);

export function fmtNumber(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

/** Valor exibido em uma célula (grade e exportações usam o mesmo). */
export function cellText(row: PlanilhaoRow, col: PlanilhaoColumn): string {
  const raw = row[col.id];
  if (col.id === 'primeira_data' || col.id === 'ultima_data') {
    return fmtDateBR(raw as string) || '—';
  }
  if (col.type === 'number') return fmtNumber(raw as number | null, col.decimals ?? 2);
  const s = raw === null || raw === undefined || raw === '' ? '—' : String(raw);
  return s;
}

export function naturalCompare(a: string, b: string) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

// ---------------------------------------------------------------------------
// Consolidação
// ---------------------------------------------------------------------------

export interface OrdemRaw {
  id: string;
  trecho: string | null;
  bacia: string | null;
  pv_montante: string | null;
  pv_jusante: string | null;
  status: string;
  comprimento_previsto: number | null;
  dn: number | null;
  prof_media_prevista: number | null;
  largura_vala: number | null;
  pav_previsto: string | null;
  ligacoes_previstas: number | null;
  prazo_previsto: number | null;
  liberado: boolean | null;
  liberado_para: string | null;
  executor_real: string | null;
  executor: string | null;
}

export interface ProducaoRaw {
  os_id: string;
  data_producao: string | null;
  responsavel_nome: string | null;
  comprimento_trecho_executado: number | null;
  quantidade_ligacoes_realizadas: number | null;
  comprimento_total_ligacoes: number | null;
  pv_final_assentado: boolean | null;
}

interface ProdAgg {
  rede: number;
  ligQtd: number;
  ligM: number;
  dias: Set<string>;
  encarregados: Set<string>;
  primeira: string | null;
  ultima: string | null;
  pvFinal: boolean;
}

/**
 * Agrega a produção por O.S. Ligações usam o MAIOR comprimento_total_ligacoes
 * do grupo (regra anti-duplicidade já adotada no dashboard).
 */
function aggregarProducao(producao: ProducaoRaw[]): Map<string, ProdAgg> {
  const map = new Map<string, ProdAgg>();
  for (const p of producao) {
    if (!p.os_id) continue;
    let a = map.get(p.os_id);
    if (!a) {
      a = { rede: 0, ligQtd: 0, ligM: 0, dias: new Set(), encarregados: new Set(), primeira: null, ultima: null, pvFinal: false };
      map.set(p.os_id, a);
    }
    const rede = Number(p.comprimento_trecho_executado || 0);
    a.rede += rede;
    a.ligQtd += Number(p.quantidade_ligacoes_realizadas || 0);
    a.ligM = Math.max(a.ligM, Number(p.comprimento_total_ligacoes || 0));
    if (p.pv_final_assentado) a.pvFinal = true;
    const nome = (p.responsavel_nome || '').trim();
    if (nome) a.encarregados.add(nome);
    const d = p.data_producao ? String(p.data_producao).slice(0, 10) : null;
    if (d) {
      if (rede > 0 || Number(p.quantidade_ligacoes_realizadas || 0) > 0) a.dias.add(d);
      if (!a.primeira || d < a.primeira) a.primeira = d;
      if (!a.ultima || d > a.ultima) a.ultima = d;
    }
  }
  return map;
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Uma linha por Bacia + Trecho. Múltiplas O.S. com a mesma chave são
 * somadas (previsto/real) e seus encarregados/períodos unificados — nunca
 * geram linhas repetidas. Lançamentos diários, ligações, revisões e
 * geometria jamais entram como linha.
 */
export function consolidarLinhas(ordens: OrdemRaw[], producao: ProducaoRaw[]): PlanilhaoRow[] {
  const prodByOs = aggregarProducao(producao);
  const groups = new Map<string, { bacia: string; trecho: string; oss: OrdemRaw[] }>();

  for (const os of ordens) {
    const bacia = (os.bacia || '').trim();
    const trecho = (os.trecho || '').trim();
    const key = `${bacia.toUpperCase()}||${trecho.toUpperCase()}`;
    let g = groups.get(key);
    if (!g) { g = { bacia, trecho, oss: [] }; groups.set(key, g); }
    g.oss.push(os);
  }

  const rows: PlanilhaoRow[] = [];
  for (const [key, g] of groups) {
    let previsto = 0, previstoCount = 0;
    let rede = 0, ligQtd = 0, ligM = 0;
    let temProducao = false;
    let pvFinal = false;
    const encarregados = new Set<string>();
    const diasSet = new Set<string>();
    let primeira: string | null = null;
    let ultima: string | null = null;
    const statuses: OSDisplayStatus[] = [];

    for (const os of g.oss) {
      const p = prodByOs.get(os.id);
      if (os.comprimento_previsto != null) { previsto += Number(os.comprimento_previsto); previstoCount++; }
      if (p) {
        rede += p.rede;
        ligQtd += p.ligQtd;
        ligM += p.ligM;
        p.encarregados.forEach(e => encarregados.add(e));
        p.dias.forEach(d => diasSet.add(d));
        if (p.primeira && (!primeira || p.primeira < primeira)) primeira = p.primeira;
        if (p.ultima && (!ultima || p.ultima > ultima)) ultima = p.ultima;
        if (p.pvFinal) pvFinal = true;
        if (p.rede > 0 || p.ligQtd > 0 || p.ligM > 0) temProducao = true;
      }
      statuses.push(vinculoDisplayStatus({ status: os.status as never, pv_final_assentado: p?.pvFinal || false }));
      const resp = (os.liberado_para || os.executor_real || os.executor || '').trim();
      if (resp && !p?.encarregados.size) encarregados.add(resp);
    }

    // Status agregado: prioriza a situação mais avançada do grupo
    const status = STATUS_PRIORITY_DESC.find(s => statuses.includes(s)) || statuses[0] || 'CINZA';

    const previstoVal = previstoCount > 0 ? previsto : null;
    const realVal = temProducao ? rede : null;
    // Regra única: saldo = previsto − executado (sem clamp, negativo é exibido)
    const saldo: number | null = previstoVal != null ? previstoVal - (realVal ?? 0) : null;

    const respPrev = [...new Set(g.oss.map(o => (o.liberado_para || o.executor_real || o.executor || '').trim()).filter(Boolean))].join(', ');

    rows.push({
      key,
      osIds: g.oss.map(o => o.id),
      bacia: g.bacia,
      trecho: g.trecho,
      pv_montante: [...new Set(g.oss.map(o => o.pv_montante || '').filter(Boolean))].join(', '),
      pv_jusante: [...new Set(g.oss.map(o => o.pv_jusante || '').filter(Boolean))].join(', '),
      previsto_m: previstoVal,
      real_m: realVal,
      saldo_m: saldo,
      encarregados: [...encarregados].sort((a, b) => naturalCompare(a, b)).join(', '),
      periodo: primeira && ultima
        ? (primeira === ultima ? fmtDateBR(primeira) : `${fmtDateBR(primeira)} – ${fmtDateBR(ultima)}`)
        : '',
      primeira_data: primeira,
      ultima_data: ultima,
      dias_producao: diasSet.size,
      status,
      status_label: statusLabel(status),
      concluido: pvFinal,
      dn: num(g.oss.find(o => o.dn != null)?.dn),
      prof_media_prevista: num(g.oss.find(o => o.prof_media_prevista != null)?.prof_media_prevista),
      largura_vala: num(g.oss.find(o => o.largura_vala != null)?.largura_vala),
      pav_previsto: [...new Set(g.oss.map(o => o.pav_previsto || '').filter(Boolean))].join(', '),
      ligacoes_previstas: g.oss.some(o => o.ligacoes_previstas != null)
        ? g.oss.reduce((s, o) => s + Number(o.ligacoes_previstas || 0), 0)
        : null,
      ligacoes_realizadas: temProducao ? ligQtd : null,
      ligacoes_comprimento_m: temProducao ? ligM : null,
      prazo_previsto: num(g.oss.find(o => o.prazo_previsto != null)?.prazo_previsto),
      liberado: g.oss.some(o => o.liberado) ? 'Sim' : 'Não',
      responsavel_previsto: respPrev,
    });
  }

  rows.sort((a, b) => naturalCompare(a.bacia, b.bacia) || naturalCompare(a.trecho, b.trecho));
  return rows;
}

// ---------------------------------------------------------------------------
// Filtro / ordenação
// ---------------------------------------------------------------------------

export function aplicarFiltros(
  rows: PlanilhaoRow[],
  filters: Record<string, string>,
  busca: string,
  visible: string[],
): PlanilhaoRow[] {
  const q = busca.trim().toLowerCase();
  return rows.filter(r => {
    for (const [colId, term] of Object.entries(filters)) {
      const t = term.trim().toLowerCase();
      if (!t) continue;
      const col = COLUMN_BY_ID[colId];
      if (!col) continue;
      if (!cellText(r, col).toLowerCase().includes(t)) return false;
    }
    if (!q) return true;
    return visible.some(id => {
      const col = COLUMN_BY_ID[id];
      return col ? cellText(r, col).toLowerCase().includes(q) : false;
    });
  });
}

export function ordenar(
  rows: PlanilhaoRow[],
  sort: { id: string; dir: 'asc' | 'desc' } | null,
): PlanilhaoRow[] {
  if (!sort) return rows;
  const col = COLUMN_BY_ID[sort.id];
  if (!col) return rows;
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (col.type === 'number') {
      const av = a[col.id] as number | null;
      const bv = b[col.id] as number | null;
      const an = av == null ? Number.NEGATIVE_INFINITY : av;
      const bn = bv == null ? Number.NEGATIVE_INFINITY : bv;
      return (an - bn) * mult;
    }
    return naturalCompare(String(a[col.id] ?? ''), String(b[col.id] ?? '')) * mult;
  });
}

/** Totais das colunas numéricas visíveis. Sem execução conta 0. */
export function calcularTotais(rows: PlanilhaoRow[], visible: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of visible) {
    const col = COLUMN_BY_ID[id];
    if (!col || col.type !== 'number' || !col.total) continue;
    totals[id] = rows.reduce((s, r) => s + Number((r[col.id] as number | null) ?? 0), 0);
  }
  // Coerência obrigatória: saldo total = previsto total − real total
  if (totals.saldo_m !== undefined) {
    const prev = rows.reduce((s, r) => s + Number(r.previsto_m ?? 0), 0);
    const real = rows.reduce((s, r) => s + Number(r.real_m ?? 0), 0);
    totals.saldo_m = prev - real;
  }
  return totals;
}
