
-- Endurecimento: trigger BEFORE UPDATE em registros_producao bloqueia campos técnicos
-- quando o ator não é sala_tecnica / gerencia / admin.

CREATE OR REPLACE FUNCTION public.tg_protect_registros_tecnicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_tecnico boolean;
BEGIN
  -- Quem tem privilégio técnico
  v_is_tecnico :=
    public.has_role(auth.uid(), 'sala_tecnica'::app_role)
    OR public.has_role(auth.uid(), 'gerencia'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role);

  IF v_is_tecnico THEN
    RETURN NEW;
  END IF;

  -- Não-técnico: só pode alterar o próprio registro
  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para alterar registro de outro usuário';
  END IF;

  -- Não-técnico: não pode mexer em campos técnicos (ajuste/cancelamento/auditoria)
  IF NEW.comprimento_ajustado IS DISTINCT FROM OLD.comprimento_ajustado
     OR NEW.ligacoes_ajustadas IS DISTINCT FROM OLD.ligacoes_ajustadas
     OR NEW.motivo_ajuste      IS DISTINCT FROM OLD.motivo_ajuste
     OR NEW.ajustado_por       IS DISTINCT FROM OLD.ajustado_por
     OR NEW.ajustado_em        IS DISTINCT FROM OLD.ajustado_em
     OR NEW.status             IS DISTINCT FROM OLD.status
     OR NEW.motivo_cancelamento IS DISTINCT FROM OLD.motivo_cancelamento
     OR NEW.cancelado_por      IS DISTINCT FROM OLD.cancelado_por
     OR NEW.cancelado_em       IS DISTINCT FROM OLD.cancelado_em
  THEN
    RAISE EXCEPTION 'Apenas a sala técnica/gerência pode ajustar, cancelar ou restaurar registros de produção';
  END IF;

  -- Não-técnico: não pode editar registro cancelado pela sala técnica
  IF OLD.status = 'cancelado' THEN
    RAISE EXCEPTION 'Este registro foi cancelado pela sala técnica e não pode ser alterado';
  END IF;

  -- Não-técnico: não pode editar registro com ajuste técnico aplicado
  IF OLD.comprimento_ajustado IS NOT NULL OR OLD.ligacoes_ajustadas IS NOT NULL THEN
    RAISE EXCEPTION 'Este registro foi ajustado pela sala técnica e não pode ser alterado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_protect_registros_tecnicos ON public.registros_producao;
CREATE TRIGGER tg_protect_registros_tecnicos
  BEFORE UPDATE ON public.registros_producao
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_protect_registros_tecnicos();
