ALTER TABLE public.ordens_servico
ADD COLUMN pav_extensoes_previsto jsonb DEFAULT '{}'::jsonb,
ADD COLUMN pav_extensoes_real jsonb DEFAULT '{}'::jsonb;