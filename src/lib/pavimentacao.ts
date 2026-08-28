/**
 * Regras de Pavimentação — isoladas da produção de Rede/Ramais.
 * Nunca usa comprimento_real, produção de rede, ligações ou ramais.
 */

/** Remove acentos, normaliza caixa e espaços. */
export const normalizarPav = (t: string | null | undefined): string =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** N.S. elegível para pavimentação: pav_previsto contém paralelepipedo ou asfalto. */
export const pavElegivel = (pav: string | null | undefined): boolean => {
  const n = normalizarPav(pav);
  return n.includes('paralelepipedo') || n.includes('asfalto');
};

/** Quantidade de tipos de pavimento informados (separados por "/"). */
export const qtdTiposPav = (pav: string | null | undefined): number => {
  const n = normalizarPav(pav);
  if (!n) return 1;
  const partes = n.split('/').map((p) => p.trim()).filter(Boolean);
  return Math.max(partes.length, 1);
};

/**
 * Área prevista de pavimentação (m²).
 * = comprimento_previsto × largura_vala ÷ (qtd de tipos em pav_previsto)
 * Retorna null quando não há previsão confiável.
 */
export const areaPrevistaPav = (
  comprimentoPrevisto: number | null | undefined,
  larguraVala: number | null | undefined,
  pavPrevisto: string | null | undefined,
): number | null => {
  const c = Number(comprimentoPrevisto);
  const l = Number(larguraVala);
  if (!isFinite(c) || !isFinite(l) || c <= 0 || l <= 0) return null;
  if (!pavElegivel(pavPrevisto)) return null;
  return Math.round((c * l * 100) / qtdTiposPav(pavPrevisto)) / 100;
};

export const fmtM2 = (v: number | null | undefined): string =>
  v == null || !isFinite(Number(v))
    ? '—'
    : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Hoje" em America/Maceio, no formato YYYY-MM-DD. */
export const hojeMaceio = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const formatBR = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
