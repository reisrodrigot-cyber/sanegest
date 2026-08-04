ALTER TABLE public.registros_producao_auditoria
  DROP CONSTRAINT IF EXISTS registros_producao_auditoria_acao_check;

ALTER TABLE public.registros_producao_auditoria
  ADD CONSTRAINT registros_producao_auditoria_acao_check
  CHECK (acao = ANY (ARRAY['edicao'::text, 'exclusao'::text, 'lancamento_retroativo'::text]));