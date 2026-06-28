/**
 * Produção real efetiva por OS.
 *
 * Regra atual (única fonte de verdade): `registros_producao`.
 * - Cada registro contabiliza `comprimento_ajustado ?? comprimento_dia`
 *   e `ligacoes_ajustadas ?? ligacoes_dia`.
 * - Apenas registros com `excluido != true` e `status = 'ativo'` contam.
 * - Os campos `ordens_servico.comprimento_real` e `ligacoes_real` funcionam
 *   como cache desse somatório, mantidos por trigger no banco.
 *
 * IMPORTANTE: o comprimento das ligações NUNCA é somado ao comprimento
 * de trecho/rede. São métricas separadas.
 */

export interface OSRealInput {
  id: string;
  comprimento_real: number | null;
  ligacoes_real: number | null;
  /** @deprecated Mantido apenas por compatibilidade. Não influencia mais o cálculo. */
  real_validado?: boolean;
}

export interface RegistroProducaoInput {
  os_id: string;
  comprimento_dia: number | null;
  ligacoes_dia?: number | null;
  comprimento_ajustado?: number | null;
  ligacoes_ajustadas?: number | null;
  excluido?: boolean | null;
  status?: string | null;
}

export interface RealEfetivo {
  comprimento: number;
  ligacoes: number;
  fonte: 'campo';
}

const isAtivo = (r: RegistroProducaoInput) =>
  r.excluido !== true && (r.status ?? 'ativo') === 'ativo';

const compContab = (r: RegistroProducaoInput) =>
  Number(r.comprimento_ajustado ?? r.comprimento_dia ?? 0) || 0;

const ligContab = (r: RegistroProducaoInput) =>
  Number(r.ligacoes_ajustadas ?? r.ligacoes_dia ?? 0) || 0;

export function realEfetivoForOS(
  os: OSRealInput,
  registros: RegistroProducaoInput[],
): RealEfetivo {
  let comp = 0;
  let ligs = 0;
  for (const r of registros) {
    if (r.os_id !== os.id) continue;
    if (!isAtivo(r)) continue;
    comp += compContab(r);
    ligs += ligContab(r);
  }
  // Fallback no cache da OS quando a lista de registros não foi fornecida
  // (mantém compatibilidade com chamadas antigas que só passam o resumo).
  if (comp === 0 && ligs === 0) {
    comp = Number(os.comprimento_real) || 0;
    ligs = Number(os.ligacoes_real) || 0;
  }
  return { comprimento: comp, ligacoes: ligs, fonte: 'campo' };
}

/** @deprecated Não há mais escala — a fonte é o próprio registro contabilizado. */
export function fatorEscalaValidado(
  _os: OSRealInput,
  _somaRegistros: number,
): number {
  return 1;
}

export interface RegistroDiarioBruto {
  os_id: string;
  data_registro: string;
  comprimento_dia: number | null;
  ligacoes_dia?: number | null;
  comprimento_ajustado?: number | null;
  ligacoes_ajustadas?: number | null;
  excluido?: boolean | null;
  status?: string | null;
  user_id?: string;
  [k: string]: any;
}

/**
 * Substitui os valores informados pelo valor contabilizado (ajustado quando
 * existir) e remove registros inativos (excluídos ou cancelados). Não escala
 * mais nada — a fonte é o próprio registro.
 */
export function aplicarRealValidadoEmRegistros<T extends RegistroDiarioBruto>(
  registros: T[],
  _ordens: OSRealInput[],
): T[] {
  return registros
    .filter((r) => isAtivo(r))
    .map((r) => ({
      ...r,
      comprimento_dia: compContab(r),
      ligacoes_dia: ligContab(r),
    }));
}
