
-- Remove existing unique constraint on trecho if any
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_trecho_key;

-- Add composite unique constraint
ALTER TABLE public.ordens_servico ADD CONSTRAINT ordens_servico_composite_key UNIQUE (trecho, bacia, pv_montante, pv_jusante);
