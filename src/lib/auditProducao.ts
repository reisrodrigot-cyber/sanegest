/**
 * Auditoria de edições de produção — SOMENTE LEITURA / VISUALIZAÇÃO.
 *
 * Lê `registros_producao_auditoria` e transforma os snapshots
 * (valor_anterior / valor_novo) em uma lista de campos realmente alterados.
 * Nada aqui altera produção, cálculos, relatórios ou indicadores.
 */
import { supabase } from '@/integrations/supabase/client';

export interface CampoAlterado {
  /** Rótulo exibido, ex.: "Rede". */
  campo: string;
  /** Valor formatado antes da edição. */
  antes: string;
  /** Valor formatado depois da edição. */
  depois: string;
  /** Diferença já formatada com sinal, ex.: "+3,73 m". Null para campos não numéricos. */
  diferenca: string | null;
  /** Direção da variação (para cor). Nunca é a única pista: sinal e valores ficam explícitos. */
  direcao: 'aumento' | 'reducao' | null;
  /** Marca alterações de reclassificação de data. */
  reclassificacaoData?: boolean;
}

export interface EdicaoProducaoEvento {
  id: string;
  registroId: string;
  usuarioId: string | null;
  /** Momento da edição. */
  ts: Date;
  /** Data de produção vigente após a edição (yyyy-mm-dd) — null se o snapshot não tiver. */
  dataProducao: string | null;
  alteracoes: CampoAlterado[];
  /** Snapshot anterior ausente/incompleto (registro histórico). */
  snapshotIndisponivel: boolean;
}

const nf = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtMetros = (v: number) => `${nf(v)} m`;
const fmtUn = (v: number) => `${v}`;
const fmtData = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split('-').reverse().join('/') : v);

const numOuNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Soma de comprimentos de ligações a partir dos formatos gravados nos snapshots. */
const somaLigacoes = (snap: any): number | null => {
  if (!snap) return null;
  const arr = snap.ligacoes_comprimentos ?? snap.ligacoes;
  if (!Array.isArray(arr)) return null;
  let total = 0;
  for (const item of arr) {
    if (typeof item === 'number') total += item;
    else if (item && typeof item === 'object') {
      const v = numOuNull(item.comprimento ?? item.comprimentoAtual ?? item.comprimento_atual);
      if (v != null) total += v;
    }
  }
  return total;
};

const diffNumerico = (
  campo: string,
  antes: number | null,
  depois: number | null,
  fmt: (v: number) => string,
  fmtDelta: (v: number) => string,
): CampoAlterado | null => {
  if (antes == null || depois == null) return null;
  if (Math.abs(antes - depois) < 1e-9) return null;
  const delta = depois - antes;
  return {
    campo,
    antes: fmt(antes),
    depois: fmt(depois),
    diferenca: `${delta > 0 ? '+' : '−'}${fmtDelta(Math.abs(delta))}`,
    direcao: delta > 0 ? 'aumento' : 'reducao',
  };
};

/**
 * Compara os snapshots de uma linha de auditoria e devolve apenas os campos alterados.
 * Nunca compara com o estado atual do registro — usa exclusivamente o par antes/depois gravado.
 */
export const diffSnapshots = (anterior: any, novo: any): CampoAlterado[] => {
  const out: CampoAlterado[] = [];
  if (!anterior || !novo) return out;

  // Rede (m) — cobre edição do encarregado (comprimento_dia) e ajuste técnico (comprimento_ajustado).
  const redeAntes = numOuNull(anterior.comprimento_dia ?? anterior.comprimento_ajustado);
  const redeDepois = numOuNull(novo.comprimento_dia ?? novo.comprimento_ajustado);
  const rede = diffNumerico('Rede', redeAntes, redeDepois, fmtMetros, fmtMetros);
  if (rede) out.push(rede);

  // Ligações (un.)
  const ligAntes = numOuNull(anterior.ligacoes_dia ?? anterior.ligacoes_ajustadas);
  const ligDepois = numOuNull(novo.ligacoes_dia ?? novo.ligacoes_ajustadas);
  const lig = diffNumerico('Ligações', ligAntes, ligDepois, fmtUn, (v) => String(v));
  if (lig) out.push(lig);

  // Extensão dos ramais (m)
  const extAntes = somaLigacoes(anterior);
  const extDepois = somaLigacoes(novo);
  const ext = diffNumerico('Extensão dos ramais', extAntes, extDepois, fmtMetros, fmtMetros);
  if (ext) out.push(ext);

  // Data de produção — reclassificação, não é nova produção física.
  const dAntes = typeof anterior.data_registro === 'string' ? anterior.data_registro.slice(0, 10) : null;
  const dDepois = typeof novo.data_registro === 'string' ? novo.data_registro.slice(0, 10) : null;
  if (dAntes && dDepois && dAntes !== dDepois) {
    out.push({
      campo: 'Produção referente a',
      antes: fmtData(dAntes),
      depois: fmtData(dDepois),
      diferenca: null,
      direcao: null,
      reclassificacaoData: true,
    });
  }

  // Observação / motivo (texto)
  const txt = (v: unknown) => (v == null || v === '' ? null : String(v));
  const obsAntes = txt(anterior.observacao);
  const obsDepois = txt(novo.observacao);
  if (obsAntes !== obsDepois && (obsAntes || obsDepois)) {
    out.push({
      campo: 'Observação',
      antes: obsAntes ?? '—',
      depois: obsDepois ?? '—',
      diferenca: null,
      direcao: null,
    });
  }
  const motAntes = txt(anterior.motivo_ajuste);
  const motDepois = txt(novo.motivo_ajuste);
  if (motAntes !== motDepois && (motAntes || motDepois)) {
    out.push({
      campo: 'Motivo do ajuste',
      antes: motAntes ?? '—',
      depois: motDepois ?? '—',
      diferenca: null,
      direcao: null,
    });
  }

  return out;
};

const temSnapshotUtil = (anterior: any) =>
  !!anterior && typeof anterior === 'object' && Object.keys(anterior).length > 0;

/** Busca as edições/ajustes de produção do período com seus snapshots antes/depois. */
export const buscarEdicoesProducao = async (
  startIso: string,
  endIso: string,
  limite = 400,
): Promise<EdicaoProducaoEvento[]> => {
  const { data, error } = await supabase
    .from('registros_producao_auditoria')
    .select('id, registro_producao_id, usuario_id, acao, valor_anterior, valor_novo, criado_em')
    .in('acao', ['edicao', 'ajuste'])
    .gte('criado_em', startIso)
    .lte('criado_em', endIso)
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw error;

  return (data || []).map((r: any) => {
    const alteracoes = diffSnapshots(r.valor_anterior, r.valor_novo);
    const dataProducao =
      typeof r.valor_novo?.data_registro === 'string' ? r.valor_novo.data_registro.slice(0, 10) : null;
    return {
      id: `ed-${r.id}`,
      registroId: r.registro_producao_id,
      usuarioId: r.usuario_id ?? null,
      ts: new Date(r.criado_em),
      dataProducao,
      alteracoes,
      snapshotIndisponivel: !temSnapshotUtil(r.valor_anterior) || alteracoes.length === 0,
    };
  });
};

/** Resumo curto (uma linha) para o card compacto. */
export const resumoAlteracao = (a: CampoAlterado) =>
  `${a.campo}: ${a.antes} → ${a.depois}${a.diferenca ? ` (${a.diferenca})` : ''}`;

export const SEM_SNAPSHOT = 'Detalhe da alteração não disponível para este registro histórico';
