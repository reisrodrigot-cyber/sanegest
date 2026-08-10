import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  consolidarLinhas,
  DEFAULT_VISIBLE,
  COLUMN_BY_ID,
  PLANILHAO_COLUMNS,
  type OrdemRaw,
  type PlanilhaoRow,
  type ProducaoRaw,
} from '@/lib/planilhaoTabela';
import { sanitizeFilter, type ColumnFilterValue } from '@/lib/columnFilter';

export interface PlanilhaoPrefs {
  visible: string[];
  order: string[];
  widths: Record<string, number>;
  /** Filtros padrão Excel por coluna. */
  colFilters: Record<string, ColumnFilterValue>;
  sort: { id: string; dir: 'asc' | 'desc' } | null;
}

export const defaultPrefs = (): PlanilhaoPrefs => ({
  visible: [...DEFAULT_VISIBLE],
  order: PLANILHAO_COLUMNS.map(c => c.id),
  widths: Object.fromEntries(PLANILHAO_COLUMNS.map(c => [c.id, c.width])),
  colFilters: {},
  sort: null,
});

const prefsKey = (userId: string | null | undefined) =>
  `sanegest.planilhao.prefs.${userId || 'anon'}`;

function sanitize(raw: unknown): PlanilhaoPrefs {
  const base = defaultPrefs();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<PlanilhaoPrefs>;
  const known = (ids?: string[]) => (ids || []).filter(id => !!COLUMN_BY_ID[id]);
  const order = [...new Set([...known(p.order), ...base.order])];
  const visible = known(p.visible);
  const colFilters: Record<string, ColumnFilterValue> = {};
  if (p.colFilters && typeof p.colFilters === 'object') {
    for (const [id, f] of Object.entries(p.colFilters)) {
      if (COLUMN_BY_ID[id]) colFilters[id] = sanitizeFilter(f);
    }
  }
  return {
    visible: visible.length ? visible : base.visible,
    order,
    widths: { ...base.widths, ...(p.widths || {}) },
    colFilters,
    sort: p.sort && COLUMN_BY_ID[p.sort.id] ? p.sort : null,
  };
}

async function fetchAllPaged<T>(
  q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const page = 1000;
  let from = 0;
  let out: T[] = [];
  for (;;) {
    const { data, error } = await q(from, from + page - 1);
    if (error) throw error;
    out = out.concat(data || []);
    if (!data || data.length < page) break;
    from += page;
  }
  return out;
}

/** Dados consolidados (somente leitura) + preferências de grade por usuário. */
export function usePlanilhaoTabela() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [rows, setRows] = useState<PlanilhaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PlanilhaoPrefs>(defaultPrefs);
  const [prefsCarregadas, setPrefsCarregadas] = useState(false);

  // Preferências por usuário autenticado
  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefsKey(userId));
      setPrefs(sanitize(raw ? JSON.parse(raw) : null));
    } catch {
      setPrefs(defaultPrefs());
    }
    setPrefsCarregadas(true);
  }, [userId]);

  useEffect(() => {
    if (!prefsCarregadas) return;
    try {
      localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
    } catch {
      /* storage indisponível — preferências apenas em memória */
    }
  }, [prefs, userId, prefsCarregadas]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [ordens, producao] = await Promise.all([
        fetchAllPaged<OrdemRaw>((from, to) =>
          supabase
            .from('ordens_servico')
            .select(
              'id,trecho,bacia,pv_montante,pv_jusante,status,comprimento_previsto,dn,prof_media_prevista,largura_vala,pav_previsto,ligacoes_previstas,prazo_previsto,liberado,liberado_para,executor_real,executor,status_vigencia',
            )
            .eq('status_vigencia', 'ATIVO')
            .order('bacia', { ascending: true })
            .range(from, to) as never,
        ),
        fetchAllPaged<ProducaoRaw>((from, to) =>
          supabase
            .from('relatorio_producao_diaria' as never)
            .select(
              'os_id,data_producao,responsavel_nome,comprimento_trecho_executado,quantidade_ligacoes_realizadas,comprimento_total_ligacoes,pv_final_assentado',
            )
            .range(from, to) as never,
        ),
      ]);
      setRows(consolidarLinhas(ordens, producao));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  /** Colunas visíveis, na ordem salva pelo usuário. */
  const visibleColumns = useMemo(
    () => prefs.order.filter(id => prefs.visible.includes(id)).map(id => COLUMN_BY_ID[id]).filter(Boolean),
    [prefs.order, prefs.visible],
  );

  return { rows, loading, erro, recarregar: carregar, prefs, setPrefs, visibleColumns };
}
