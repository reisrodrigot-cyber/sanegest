-- Trigger function to record status changes
CREATE OR REPLACE FUNCTION public.record_os_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.os_status_historico (os_id, status_anterior, status_novo, user_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_os_status_change ON public.ordens_servico;
CREATE TRIGGER trg_record_os_status_change
AFTER UPDATE OF status ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.record_os_status_change();