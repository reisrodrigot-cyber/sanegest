ALTER TABLE public.topografia_asbuilt
  ADD COLUMN IF NOT EXISTS encarregado text,
  ADD COLUMN IF NOT EXISTS profundidade numeric,
  ADD COLUMN IF NOT EXISTS ns_relacionada text;