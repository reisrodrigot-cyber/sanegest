/**
 * Faixas oficiais de profundidade PRÓPRIA do PV (não usar profundidade média
 * da N.S., do trecho, prevista ou executada). Sem lacunas e sem sobreposição.
 */
export interface FaixaProfPV {
  key: string;
  label: string;
  hex: string;
}

export const PV_PROF_FAIXAS: FaixaProfPV[] = [
  { key: 'ate125', label: 'Até 1,25 m', hex: '#86efac' },      // verde claro
  { key: '125a180', label: '1,25 a 1,80 m', hex: '#15803d' },  // verde escuro
  { key: '180a280', label: '1,80 a 2,80 m', hex: '#eab308' },  // amarelo
  { key: '280a380', label: '2,80 a 3,80 m', hex: '#f97316' },  // laranja
  { key: 'acima380', label: 'Acima de 3,80 m', hex: '#dc2626' },// vermelho
  { key: 'sem', label: 'Sem profundidade', hex: '#9ca3af' },   // cinza
];

const SEM = PV_PROF_FAIXAS[5];

export function faixaProfundidadePV(prof: number | null | undefined): FaixaProfPV {
  if (prof == null) return SEM;
  const p = Number(prof);
  if (!Number.isFinite(p)) return SEM;
  if (p <= 1.25) return PV_PROF_FAIXAS[0];
  if (p <= 1.8) return PV_PROF_FAIXAS[1];
  if (p <= 2.8) return PV_PROF_FAIXAS[2];
  if (p <= 3.8) return PV_PROF_FAIXAS[3];
  return PV_PROF_FAIXAS[4];
}

export const corProfundidadePV = (prof: number | null | undefined): string =>
  faixaProfundidadePV(prof).hex;
