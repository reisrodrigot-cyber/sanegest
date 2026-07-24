
ALTER TABLE public.mapa_bases
  ADD COLUMN IF NOT EXISTS excluida_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS excluida_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_exclusao text;

CREATE INDEX IF NOT EXISTS idx_mapa_bases_excluida_em ON public.mapa_bases(excluida_em);
