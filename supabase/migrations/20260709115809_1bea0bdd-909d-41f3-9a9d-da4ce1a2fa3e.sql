ALTER TABLE public.ligacoes
  ADD COLUMN IF NOT EXISTS comprimento_original numeric NULL,
  ADD COLUMN IF NOT EXISTS ajustado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS ajustado_em timestamptz NULL;

COMMENT ON COLUMN public.ligacoes.comprimento_original IS 'Valor original informado pelo encarregado, preservado antes de qualquer ajuste técnico. NULL enquanto ninguém ajustou.';