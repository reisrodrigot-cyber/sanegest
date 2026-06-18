ALTER TABLE public.os_revisoes
  ADD COLUMN IF NOT EXISTS trecho text,
  ADD COLUMN IF NOT EXISTS pv_montante text,
  ADD COLUMN IF NOT EXISTS pv_jusante text;