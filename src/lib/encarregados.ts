export interface IdentidadeEncarregadoInput {
  userId?: string | null;
  nome?: string | null;
  apelido?: string | null;
  displayName?: string | null;
  email?: string | null;
}

const textoChave = (raw: string | null | undefined) =>
  String(raw ?? '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');

/** Rótulo de apresentação. Nunca deve ser usado como chave de agrupamento. */
export const normalizarEncarregado = (raw: string | null | undefined): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const low = s.toLowerCase();
  if (low.includes('nilton')) return 'Nilton Alexandre';
  if (low.includes('ailton')) return 'Ailton Santos';
  if (low.includes('carlito')) return 'Carlito';
  return s;
};

/**
 * Identidade usada em relatórios. Contas conhecidas agrupam exclusivamente por
 * user_id; texto legado só agrupa com o mesmo texto exato normalizado.
 */
export const resolverIdentidadeEncarregado = (input: IdentidadeEncarregadoInput) => {
  const rawNome = input.apelido || input.displayName || input.email || input.nome;
  const nome = normalizarEncarregado(rawNome);
  const userId = String(input.userId ?? '').trim();
  return {
    id: userId ? `user:${userId}` : `legado:${textoChave(rawNome) || 'sem-identidade'}`,
    userId: userId || null,
    nome,
  };
};
