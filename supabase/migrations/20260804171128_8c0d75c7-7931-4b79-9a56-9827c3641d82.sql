ALTER TABLE public.registros_producao
  ADD COLUMN IF NOT EXISTS data_retroativa_confirmada boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.tg_validate_data_producao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Maceio')::date;
BEGIN
  IF NEW.data_registro IS NULL THEN
    NEW.data_registro := v_hoje;
  END IF;

  IF NEW.data_registro > v_hoje THEN
    RAISE EXCEPTION 'Data de produção não pode ser futura (hoje: %)', to_char(v_hoje, 'DD/MM/YYYY');
  END IF;

  IF NEW.data_registro <> v_hoje AND COALESCE(NEW.data_retroativa_confirmada, false) = false THEN
    RAISE EXCEPTION 'Lançamento retroativo exige confirmação explícita da data de produção';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_data_producao ON public.registros_producao;
CREATE TRIGGER trg_validate_data_producao
BEFORE INSERT ON public.registros_producao
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_data_producao();

CREATE OR REPLACE FUNCTION public.tg_audit_data_producao_retroativa()
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
      jsonb_build_object('data_digitacao', v_hoje),
      jsonb_build_object(
        'data_producao', NEW.data_registro,
        'created_at', NEW.created_at,
        'user_id', NEW.user_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_data_producao_retroativa ON public.registros_producao;
CREATE TRIGGER trg_audit_data_producao_retroativa
AFTER INSERT ON public.registros_producao
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_data_producao_retroativa();