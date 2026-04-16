
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS dn_real numeric,
  ADD COLUMN IF NOT EXISTS largura_vala_real numeric,
  ADD COLUMN IF NOT EXISTS prof_montante_real numeric,
  ADD COLUMN IF NOT EXISTS prof_jusante_real numeric,
  ADD COLUMN IF NOT EXISTS areia_real text,
  ADD COLUMN IF NOT EXISTS brita_real text,
  ADD COLUMN IF NOT EXISTS prazo_real integer,
  ADD COLUMN IF NOT EXISTS bms_real text,
  ADD COLUMN IF NOT EXISTS executor_real text;
