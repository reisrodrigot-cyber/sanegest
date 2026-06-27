/**
 * Resolução da "produção real efetiva" por OS.
 *
 * Regra:
 * - Quando a Sala Técnica valida a OS (os.real_validado = true), o valor
 *   armazenado em `comprimento_real` / `ligacoes_real` é considerado a
 *   "produção real validada" e prevalece sobre qualquer somatório bruto
 *   de registros de campo. Isto permite corrigir duplicidades.
 * - Caso contrário, usa-se o somatório bruto dos registros de campo
 *   ("produção informada em campo") como valor provisório.
 *
 * IMPORTANTE: o comprimento das ligações NUNCA é somado ao comprimento
 * de trecho/rede. São métricas separadas.
 */

export interface OSRealInput {
  id: string;
  comprimento_real: number | null;
  ligacoes_real: number | null;
  real_validado?: boolean;
}

export interface RegistroProducaoInput {
  os_id: string;
  comprimento_dia: number | null;
  ligacoes_dia?: number | null;
}

export interface RealEfetivo {
  comprimento: number; // metros de rede
  ligacoes: number;    // quantidade de ligações
  fonte: 'validado' | 'campo';
}

/**
 * Calcula o valor real efetivo para uma OS dada a lista de registros de campo
 * associados a ela (pode estar pré-filtrada ou não).
 */
export function realEfetivoForOS(
  os: OSRealInput,
  registros: RegistroProducaoInput[],
): RealEfetivo {
  if (os.real_validado) {
    return {
      comprimento: Number(os.comprimento_real) || 0,
      ligacoes: Number(os.ligacoes_real) || 0,
      fonte: 'validado',
    };
  }
  let comp = 0;
  let ligs = 0;
  for (const r of registros) {
    if (r.os_id !== os.id) continue;
    comp += Number(r.comprimento_dia) || 0;
    ligs += Number(r.ligacoes_dia) || 0;
  }
  return { comprimento: comp, ligacoes: ligs, fonte: 'campo' };
}

/**
 * Fator de escala diário para honrar o valor validado quando há diferença
 * entre o somatório bruto dos registros e o valor validado pela sala técnica.
 * Retorna 1 quando não há validação ou quando o somatório bruto é zero.
 */
export function fatorEscalaValidado(
  os: OSRealInput,
  somaRegistros: number,
): number {
  if (!os.real_validado || somaRegistros <= 0) return 1;
  const validado = Number(os.comprimento_real) || 0;
  return validado / somaRegistros;
}
