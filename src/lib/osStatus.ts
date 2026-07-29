/**
 * Fonte única de verdade para status de N.S./trechos (apresentação).
 *
 * Módulo puro: sem React, Leaflet ou Supabase.
 *
 * - `OSStatus`  → tipo técnico persistido no banco (enum SQL, inalterado).
 * - `OSDisplayStatus` → tipo visual do front-end, que inclui AZUL (As Built).
 *
 * AZUL existe apenas como status de exibição/configuração. Nenhum dado atual
 * pode resolver para AZUL (não há vínculo As Built confiável).
 */
import type { OSStatus } from '@/types/sanegest';

export type { OSStatus };

export type OSDisplayStatus = 'CINZA' | 'VERMELHO' | 'AMARELO' | 'VERDE' | 'AZUL';

export interface StatusMeta {
  /** chave técnica de exibição */
  key: OSDisplayStatus;
  /** rótulo oficial mostrado ao usuário */
  label: string;
  /** descrição curta (tooltip/legenda) */
  description: string;
  /** hex para Leaflet / SVG */
  hex: string;
  /** classes literais e estáticas (nunca montadas por template string) */
  badgeClass: string;
  dotClass: string;
  bgClass: string;
  ringClass: string;
  /** prioridade de agregação visual: maior vence */
  priority: number;
}

export const STATUS_META: Record<OSDisplayStatus, StatusMeta> = {
  CINZA: {
    key: 'CINZA',
    label: 'N.S. não liberada',
    description: 'N.S. ainda não liberada para execução',
    hex: '#8a8a8a',
    badgeClass: 'status-cinza',
    dotClass: 'status-dot-cinza',
    bgClass: 'bg-status-gray',
    ringClass: 'ring-status-gray',
    priority: 1,
  },
  VERMELHO: {
    key: 'VERMELHO',
    label: 'N.S. liberada sem execução',
    description: 'N.S. liberada, sem produção registrada',
    hex: '#dc2626',
    badgeClass: 'status-vermelho',
    dotClass: 'status-dot-vermelho',
    bgClass: 'bg-status-red',
    ringClass: 'ring-status-red',
    priority: 2,
  },
  AMARELO: {
    key: 'AMARELO',
    label: 'Em execução',
    description: 'Produção registrada, PV final ainda não assentado',
    hex: '#ca8a04',
    badgeClass: 'status-amarelo',
    dotClass: 'status-dot-amarelo',
    bgClass: 'bg-status-yellow',
    ringClass: 'ring-status-yellow',
    priority: 3,
  },
  VERDE: {
    key: 'VERDE',
    label: 'PV assentado',
    description: 'PV final assentado — trecho concluído em campo',
    hex: '#16a34a',
    badgeClass: 'status-verde',
    dotClass: 'status-dot-verde',
    bgClass: 'bg-status-green',
    ringClass: 'ring-status-green',
    priority: 4,
  },
  AZUL: {
    key: 'AZUL',
    label: 'Trecho com coordenada definida pelo topógrafo (As Built)',
    description: 'Reservado ao fluxo futuro de As Built — sem ocorrências',
    hex: '#2563eb',
    badgeClass: 'status-azul',
    dotClass: 'status-dot-azul',
    bgClass: 'bg-status-blue',
    ringClass: 'ring-status-blue',
    priority: 5,
  },
};

/** Ordem oficial para legenda/renderização (do menor para o maior). */
export const STATUS_ORDER: OSDisplayStatus[] = ['CINZA', 'VERMELHO', 'AMARELO', 'VERDE', 'AZUL'];

/** Ordem de precedência visual (maior primeiro): Azul > Verde > Amarelo > Vermelho > Cinza. */
export const STATUS_PRIORITY_DESC: OSDisplayStatus[] = ['AZUL', 'VERDE', 'AMARELO', 'VERMELHO', 'CINZA'];

/**
 * Converte o status técnico legado (enum SQL) no status visual.
 * LARANJA (legado: material entregue, aguardando produção) é apresentado como
 * "N.S. liberada sem execução".
 */
export function toDisplayStatus(status: OSStatus | OSDisplayStatus | string | null | undefined): OSDisplayStatus {
  switch (status) {
    case 'VERDE':
      return 'VERDE';
    case 'AMARELO':
      return 'AMARELO';
    case 'LARANJA':
    case 'VERMELHO':
      return 'VERMELHO';
    case 'AZUL':
      return 'AZUL';
    case 'CINZA':
      return 'CINZA';
    default:
      return 'CINZA';
  }
}

/** Metadados com fallback seguro (nunca retorna AZUL por fallback). */
export function getStatusMeta(status: OSStatus | OSDisplayStatus | string | null | undefined): StatusMeta {
  return STATUS_META[toDisplayStatus(status)];
}

/** Rótulo oficial. Nunca expõe a chave crua do enum. */
export function statusLabel(status: OSStatus | OSDisplayStatus | string | null | undefined): string {
  return getStatusMeta(status).label;
}

export function statusHex(status: OSStatus | OSDisplayStatus | string | null | undefined): string {
  return getStatusMeta(status).hex;
}

export interface ResolveInput {
  /** N.S. liberada para o encarregado */
  liberado?: boolean | null;
  /** existe produção executada registrada */
  temProducao?: boolean | null;
  /** PV final assentado */
  pvFinalAssentado?: boolean | null;
  /**
   * Evidência As Built topográfica confiável e vinculada ao trecho.
   * Nesta entrega sempre falso — não existe vínculo confiável.
   */
  asBuiltVinculado?: boolean | null;
  /** status técnico legado, usado apenas como fallback visual seguro */
  statusLegado?: OSStatus | string | null;
}

/**
 * Resolve o status visual a partir da condição operacional.
 * Quando não há dados suficientes, cai no status legado (nunca AZUL).
 */
export function resolveDisplayStatus(input: ResolveInput): OSDisplayStatus {
  const { liberado, temProducao, pvFinalAssentado, statusLegado } = input;
  // As Built não é inferível nesta entrega.
  if (hasAsBuiltVinculado(input)) return 'AZUL';
  if (pvFinalAssentado) return 'VERDE';
  if (liberado == null && temProducao == null) return toDisplayStatus(statusLegado);
  if (liberado === false) return 'CINZA';
  if (temProducao) return 'AMARELO';
  if (liberado === true) return 'VERMELHO';
  return toDisplayStatus(statusLegado);
}

/**
 * Enquanto não existir relação confiável entre topografia_asbuilt e o trecho
 * do mapa, esta função retorna sempre falso por construção.
 */
export function hasAsBuiltVinculado(_input: ResolveInput): boolean {
  return false;
}

/**
 * Status visual de UMA N.S. vinculada a um trecho do mapa.
 *
 * Regra operacional obrigatória: se existir pelo menos um registro de produção
 * ativo/não excluído com `pv_final_assentado = true` para a os_id, o vínculo é
 * VERDE ("PV assentado") — o enum técnico legado (AMARELO/LARANJA) não pode
 * rebaixar essa condição. Lançamentos posteriores com PV falso e execução zero
 * não anulam um PV assentado anterior (a fonte é OR/EXISTS, não o último).
 */
export function vinculoDisplayStatus(v: {
  status?: OSStatus | string | null;
  pv_final_assentado?: boolean | null;
}): OSDisplayStatus {
  if (v.pv_final_assentado) return 'VERDE';
  return toDisplayStatus(v.status);
}

/** Agrega vários status visuais pela precedência central. */
export function aggregateDisplayStatus(
  statuses: Array<OSStatus | OSDisplayStatus | string | null | undefined>,
): OSDisplayStatus {
  if (!statuses.length) return 'CINZA';
  let best: OSDisplayStatus = 'CINZA';
  for (const s of statuses) {
    const d = toDisplayStatus(s);
    if (STATUS_META[d].priority > STATUS_META[best].priority) best = d;
  }
  return best;
}

/** Agrega os vínculos de um trecho já aplicando a regra operacional de PV assentado. */
export function aggregateVinculosStatus(
  vinculos: Array<{ status?: OSStatus | string | null; pv_final_assentado?: boolean | null }>,
): OSDisplayStatus {
  if (!vinculos.length) return 'CINZA';
  let best: OSDisplayStatus = 'CINZA';
  for (const v of vinculos) {
    const d = vinculoDisplayStatus(v);
    if (STATUS_META[d].priority > STATUS_META[best].priority) best = d;
  }
  return best;
}


/** Prioridade visual de um status técnico ou visual. */
export function statusPriority(status: OSStatus | OSDisplayStatus | string | null | undefined): number {
  return getStatusMeta(status).priority;
}

/**
 * Opções de escrita do status técnico (enum SQL inalterado), com rótulos
 * operacionais. Usado pelo controle da Sala Técnica.
 */
export const LEGACY_STATUS_OPTIONS: Array<{
  value: OSStatus;
  label: string;
  description: string;
  bgClass: string;
  ringClass: string;
}> = [
  { value: 'CINZA', label: STATUS_META.CINZA.label, description: 'N.S. ainda não liberada', bgClass: STATUS_META.CINZA.bgClass, ringClass: STATUS_META.CINZA.ringClass },
  { value: 'VERMELHO', label: STATUS_META.VERMELHO.label, description: 'Aguardando entrega de material', bgClass: STATUS_META.VERMELHO.bgClass, ringClass: STATUS_META.VERMELHO.ringClass },
  { value: 'LARANJA', label: STATUS_META.VERMELHO.label, description: 'Material entregue, aguardando produção', bgClass: 'bg-status-orange', ringClass: 'ring-status-orange' },
  { value: 'AMARELO', label: STATUS_META.AMARELO.label, description: 'Aguardando registro topográfico', bgClass: STATUS_META.AMARELO.bgClass, ringClass: STATUS_META.AMARELO.ringClass },
  { value: 'VERDE', label: STATUS_META.VERDE.label, description: 'Concluída em campo', bgClass: STATUS_META.VERDE.bgClass, ringClass: STATUS_META.VERDE.ringClass },
];
