/**
 * Regras do fluxo de Registro Topográfico (As Built). Módulo puro.
 *
 * Etapas: PV assentado (VERDE) → topografia → As Built concluído (AZUL visual).
 */

export interface RegistroPvRow {
  os_id: string;
  pv_final_assentado: boolean | null;
  excluido: boolean | null;
  status: string | null;
}

/** N.S. com ao menos um registro ativo/não excluído com PV final assentado (OR/EXISTS). */
export function osIdsComPvAssentado(rows: RegistroPvRow[]): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.pv_final_assentado === true && !r.excluido && (r.status ?? 'ativo') === 'ativo') out.add(r.os_id);
  }
  return out;
}

export function isVigente(os: { status_vigencia?: string | null }): boolean {
  return (os.status_vigencia ?? 'ATIVO') === 'ATIVO';
}

/** Pendente de topografia: vigente, PV assentado e As Built ainda não concluído. */
export function isPendenteTopografia(
  os: { id: string; status_vigencia?: string | null },
  pvAssentado: Set<string>,
  asBuiltConcluido: Set<string>,
): boolean {
  return isVigente(os) && pvAssentado.has(os.id) && !asBuiltConcluido.has(os.id);
}

/** Pode concluir As Built: PVs montante/jusante com coordenada e nenhuma ligação sem coordenada. */
export function podeConcluirAsBuilt(input: {
  montanteComCoord: boolean;
  jusanteComCoord: boolean;
  ligacoesPendentes: number;
}): boolean {
  return input.montanteComCoord && input.jusanteComCoord && input.ligacoesPendentes === 0;
}

/** Status visual da N.S. na tela de topografia. */
export function statusVisualTopografia(
  osId: string,
  statusLegado: string | null | undefined,
  pvAssentado: Set<string>,
  asBuiltConcluido: Set<string>,
): string {
  if (asBuiltConcluido.has(osId)) return 'AZUL';
  if (pvAssentado.has(osId)) return 'VERDE';
  return statusLegado ?? 'CINZA';
}
