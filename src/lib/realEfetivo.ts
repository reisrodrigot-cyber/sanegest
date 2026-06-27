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

/**
 * Aplica o "REAL validado" sobre uma lista de registros de campo.
 *
 * Para cada OS com `real_validado = true`, escala proporcionalmente os valores
 * diários (`comprimento_dia` e `ligacoes_dia`) para que a soma bata com o
 * valor oficial registrado em `comprimento_real` / `ligacoes_real`. Isto
 * preserva a distribuição diária mas garante que dashboards, gráficos e
 * relatórios oficiais nunca exibam um total maior do que o validado pela
 * sala técnica (ex.: duplicidades lançadas em campo).
 *
 * Para OS sem validação, os valores brutos são mantidos.
 *
 * Os registros originais NÃO são alterados — uma nova lista é retornada.
 * O histórico bruto continua disponível em `registros_producao` para
 * auditoria.
 */
export interface RegistroDiarioBruto {
  os_id: string;
  data_registro: string;
  comprimento_dia: number | null;
  ligacoes_dia?: number | null;
  user_id?: string;
  [k: string]: any;
}

export function aplicarRealValidadoEmRegistros<T extends RegistroDiarioBruto>(
  registros: T[],
  ordens: OSRealInput[],
): T[] {
  const osById = new Map<string, OSRealInput>();
  ordens.forEach((o) => osById.set(o.id, o));

  // Somatórios brutos por OS (apenas necessário para OS validadas).
  const somaPorOs = new Map<string, { comp: number; lig: number }>();
  for (const r of registros) {
    const os = osById.get(r.os_id);
    if (!os?.real_validado) continue;
    const cur = somaPorOs.get(r.os_id) ?? { comp: 0, lig: 0 };
    cur.comp += Number(r.comprimento_dia) || 0;
    cur.lig += Number(r.ligacoes_dia) || 0;
    somaPorOs.set(r.os_id, cur);
  }

  return registros.map((r) => {
    const os = osById.get(r.os_id);
    if (!os?.real_validado) return r;
    const soma = somaPorOs.get(r.os_id);
    if (!soma) return r;
    const compValid = Number(os.comprimento_real) || 0;
    const ligValid = Number(os.ligacoes_real) || 0;
    const fComp = soma.comp > 0 ? compValid / soma.comp : 0;
    const fLig = soma.lig > 0 ? ligValid / soma.lig : 0;
    return {
      ...r,
      comprimento_dia: (Number(r.comprimento_dia) || 0) * fComp,
      ligacoes_dia: (Number(r.ligacoes_dia) || 0) * fLig,
    };
  });
}

