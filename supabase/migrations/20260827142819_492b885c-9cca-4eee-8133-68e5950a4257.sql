ALTER TABLE public.quantitativos_referencia
  ADD COLUMN IF NOT EXISTS ramais_previstos_metros numeric NOT NULL DEFAULT 0;