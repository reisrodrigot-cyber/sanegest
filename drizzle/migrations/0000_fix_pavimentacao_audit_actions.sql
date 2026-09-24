CREATE OR REPLACE FUNCTION public.tg_audit_pav_retroativa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Maceio')::date;
BEGIN
  IF NEW.data_registro <> v_hoje THEN
    INSERT INTO public.registros_producao_auditoria
      (registro_producao_id, usuario_id, acao, valor_anterior, valor_novo)
    VALUES (
      NEW.id,
      NEW.user_id,
      'lancamento_retroativo',
      jsonb_build_object(
        'modulo', 'pavimentacao',
        'tipo_evento', 'lancamento_retroativo',
        'data_digitacao', v_hoje
      ),
      jsonb_build_object(
        'modulo', 'pavimentacao',
        'tipo_evento', 'lancamento_retroativo',
        'data_producao', NEW.data_registro,
        'os_id', NEW.os_id,
        'user_id', NEW.user_id,
        'responsavel_user_id', NEW.responsavel_user_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_audit_pav_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao text;
  v_tipo_evento text;
  v_usuario_id uuid;
BEGIN
  IF to_jsonb(OLD) = to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.excluido, false) = false AND COALESCE(NEW.excluido, false) = true THEN
    v_acao := 'exclusao';
    v_tipo_evento := 'exclusao_logica';
  ELSE
    v_acao := 'edicao';
    v_tipo_evento := 'edicao';
  END IF;

  v_usuario_id := COALESCE(auth.uid(), NEW.user_id);

  INSERT INTO public.registros_producao_auditoria
    (registro_producao_id, usuario_id, acao, valor_anterior, valor_novo)
  VALUES (
    NEW.id,
    v_usuario_id,
    v_acao,
    jsonb_build_object('modulo', 'pavimentacao', 'tipo_evento', v_tipo_evento, 'registro', to_jsonb(OLD)),
    jsonb_build_object('modulo', 'pavimentacao', 'tipo_evento', v_tipo_evento, 'registro', to_jsonb(NEW))
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pav_update ON public.registros_pavimentacao;
CREATE TRIGGER trg_audit_pav_update
AFTER UPDATE ON public.registros_pavimentacao
FOR EACH ROW
EXECUTE FUNCTION public.tg_audit_pav_update();