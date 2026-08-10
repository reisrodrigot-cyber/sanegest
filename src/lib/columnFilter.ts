/**
 * Motor de filtros "padrão Excel" para as tabelas do SaneGest.
 * Puramente de apresentação: não altera dados, cálculos ou regras operacionais.
 */

export type ColFilterType = 'text' | 'number' | 'date';

export interface ColumnFilterValue {
  /** Operador ativo (depende do tipo). Vazio = sem condição. */
  op: string;
  v1: string;
  v2: string;
  /** Valores (texto exibido) desmarcados na lista de seleção. */
  excluded: string[];
}

export const emptyFilter = (): ColumnFilterValue => ({ op: '', v1: '', v2: '', excluded: [] });

export const TEXT_OPS: { value: string; label: string }[] = [
  { value: 'contains', label: 'Contém' },
  { value: 'notContains', label: 'Não contém' },
  { value: 'startsWith', label: 'Começa com' },
  { value: 'endsWith', label: 'Termina com' },
  { value: 'equals', label: 'Igual a' },
  { value: 'notEquals', label: 'Diferente de' },
];

export const NUMBER_OPS: { value: string; label: string; two?: boolean }[] = [
  { value: 'eq', label: 'Igual a' },
  { value: 'neq', label: 'Diferente de' },
  { value: 'gt', label: 'Maior que' },
  { value: 'gte', label: 'Maior ou igual a' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor ou igual a' },
  { value: 'between', label: 'Entre', two: true },
];

export const DATE_OPS: { value: string; label: string; two?: boolean }[] = [
  { value: 'before', label: 'Antes de' },
  { value: 'after', label: 'Depois de' },
  { value: 'on', label: 'Igual a' },
  { value: 'between', label: 'Entre', two: true },
];

export function opsForType(type: ColFilterType) {
  if (type === 'number') return NUMBER_OPS;
  if (type === 'date') return DATE_OPS;
  return TEXT_OPS;
}

export function isFilterActive(f: ColumnFilterValue | undefined): boolean {
  if (!f) return false;
  if (f.excluded && f.excluded.length > 0) return true;
  if (!f.op) return false;
  if (f.op === 'between') return f.v1.trim() !== '' || f.v2.trim() !== '';
  return f.v1.trim() !== '';
}

/** Converte texto pt-BR ("1.234,56") ou número puro em number. */
export function parseNumeroBR(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/** Normaliza data para "YYYY-MM-DD"; aceita ISO ou DD/MM/YYYY. */
export function normalizarData(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return iso ? iso[1] : null;
}

export interface CellValue {
  /** Texto exibido na célula (usado na seleção de valores e nos filtros de texto). */
  text: string;
  num?: number | null;
  date?: string | null;
}

function passaCondicao(f: ColumnFilterValue, type: ColFilterType, cell: CellValue): boolean {
  if (!f.op) return true;
  const v1 = f.v1?.trim() ?? '';
  const v2 = f.v2?.trim() ?? '';

  if (type === 'number') {
    const n = cell.num ?? parseNumeroBR(cell.text);
    const a = parseNumeroBR(v1);
    const b = parseNumeroBR(v2);
    if (f.op === 'between') {
      if (a === null && b === null) return true;
      if (n === null) return false;
      if (a !== null && n < a) return false;
      if (b !== null && n > b) return false;
      return true;
    }
    if (a === null) return true;
    if (n === null) return false;
    switch (f.op) {
      case 'eq': return n === a;
      case 'neq': return n !== a;
      case 'gt': return n > a;
      case 'gte': return n >= a;
      case 'lt': return n < a;
      case 'lte': return n <= a;
      default: return true;
    }
  }

  if (type === 'date') {
    const d = cell.date ?? normalizarData(cell.text);
    const a = normalizarData(v1);
    const b = normalizarData(v2);
    if (f.op === 'between') {
      if (!a && !b) return true;
      if (!d) return false;
      if (a && d < a) return false;
      if (b && d > b) return false;
      return true;
    }
    if (!a) return true;
    if (!d) return false;
    switch (f.op) {
      case 'before': return d < a;
      case 'after': return d > a;
      case 'on': return d === a;
      default: return true;
    }
  }

  if (v1 === '') return true;
  const t = cell.text.toLowerCase();
  const q = v1.toLowerCase();
  switch (f.op) {
    case 'contains': return t.includes(q);
    case 'notContains': return !t.includes(q);
    case 'startsWith': return t.startsWith(q);
    case 'endsWith': return t.endsWith(q);
    case 'equals': return t === q;
    case 'notEquals': return t !== q;
    default: return true;
  }
}

export function passesFilter(
  f: ColumnFilterValue | undefined,
  type: ColFilterType,
  cell: CellValue,
): boolean {
  if (!f) return true;
  if (f.excluded?.length && f.excluded.includes(cell.text)) return false;
  return passaCondicao(f, type, cell);
}

export function sanitizeFilter(raw: unknown): ColumnFilterValue {
  const base = emptyFilter();
  if (!raw || typeof raw !== 'object') return base;
  const f = raw as Partial<ColumnFilterValue>;
  return {
    op: typeof f.op === 'string' ? f.op : '',
    v1: typeof f.v1 === 'string' ? f.v1 : '',
    v2: typeof f.v2 === 'string' ? f.v2 : '',
    excluded: Array.isArray(f.excluded) ? f.excluded.filter(x => typeof x === 'string') : [],
  };
}
