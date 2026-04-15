
ALTER TABLE public.ordens_servico 
ADD COLUMN liberado boolean NOT NULL DEFAULT false,
ADD COLUMN liberado_para text DEFAULT NULL;
