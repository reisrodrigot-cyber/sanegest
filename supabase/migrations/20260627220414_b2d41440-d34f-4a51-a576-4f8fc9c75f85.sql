ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS real_validado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS real_validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS real_validado_por uuid;