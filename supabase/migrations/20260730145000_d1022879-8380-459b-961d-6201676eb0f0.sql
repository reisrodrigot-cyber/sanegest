CREATE OR REPLACE FUNCTION public.promote_os_on_pv_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.pv_final_assentado, false) = true
     AND NEW.excluido IS NOT TRUE
     AND NEW.status = 'ativo' THEN
    UPDATE public.ordens_servico
       SET status = 'VERDE'
     WHERE id = NEW.os_id
       AND status <> 'VERDE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_os_on_pv_final ON public.registros_producao;
CREATE TRIGGER trg_promote_os_on_pv_final
AFTER INSERT OR UPDATE OF pv_final_assentado, status, excluido ON public.registros_producao
FOR EACH ROW EXECUTE FUNCTION public.promote_os_on_pv_final();