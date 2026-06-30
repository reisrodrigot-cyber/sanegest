
ALTER TABLE public.registros_producao
  ADD COLUMN IF NOT EXISTS pv_final_assentado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pv_final_assentado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pv_final_assentado_por uuid;

CREATE INDEX IF NOT EXISTS idx_registros_producao_pv_final
  ON public.registros_producao (os_id)
  WHERE pv_final_assentado = true AND excluido = false AND status = 'ativo';

-- Atualiza trigger de proteção:
-- Encarregado pode marcar pv_final_assentado em seu próprio registro ativo e sem intervenção técnica.
-- Mantém todas as regras existentes para os demais campos técnicos.
CREATE OR REPLACE FUNCTION public.tg_protect_registros_tecnicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_tecnico boolean;
BEGIN
  v_is_tecnico :=
    public.has_role(auth.uid(), 'sala_tecnica'::app_role)
    OR public.has_role(auth.uid(), 'gerencia'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role);

  IF v_is_tecnico THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para alterar registro de outro usuário';
  END IF;

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

  IF OLD.status = 'cancelado' THEN
    RAISE EXCEPTION 'Este registro foi cancelado pela sala técnica e não pode ser alterado';
  END IF;

  IF OLD.comprimento_ajustado IS NOT NULL OR OLD.ligacoes_ajustadas IS NOT NULL THEN
    RAISE EXCEPTION 'Este registro foi ajustado pela sala técnica e não pode ser alterado';
  END IF;

  -- Coerência da marcação de PV final: quem marca tem que ser o dono do registro
  IF NEW.pv_final_assentado IS DISTINCT FROM OLD.pv_final_assentado THEN
    IF NEW.pv_final_assentado = true THEN
      IF NEW.pv_final_assentado_por IS NULL OR NEW.pv_final_assentado_por <> auth.uid() THEN
        RAISE EXCEPTION 'pv_final_assentado_por deve ser o próprio encarregado';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
