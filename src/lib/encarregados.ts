/**
 * Normalização de nomes de encarregados (camada de apresentação/agregação).
 * Une variações de identificador da MESMA pessoa em um único nome canônico.
 * Não altera dados persistidos, contas, permissões ou vínculos de O.S.
 */
export const normalizarEncarregado = (raw: string | null | undefined): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const low = s.toLowerCase();
  if (low.includes('nilton')) return 'Nilton Alexandre';
  if (low.includes('ailton')) return 'Ailton Santos';
  if (low.includes('carlito')) return 'Carlito';
  return s;
};
