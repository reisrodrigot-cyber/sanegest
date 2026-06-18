CREATE UNIQUE INDEX IF NOT EXISTS ordens_servico_trecho_bacia_uniq
  ON public.ordens_servico (LOWER(TRIM(trecho)), LOWER(TRIM(COALESCE(bacia, ''))));