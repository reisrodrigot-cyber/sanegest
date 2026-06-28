
-- Trigger que mantém ordens_servico.comprimento_real / ligacoes_real sempre
-- iguais à soma dos registros_producao não excluídos, ENQUANTO a OS não
-- estiver validada (real_validado = false). Após validação, os valores
-- oficiais preenchidos pela Sala Técnica são preservados e nunca
-- sobrescritos por mudanças em registros_producao.

CREATE OR REPLACE FUNCTION public.recompute_os_real_from_registros(_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validado boolean;
  v_comp numeric;
  v_lig int;
BEGIN
  SELECT real_validado INTO v_validado FROM public.ordens_servico WHERE id = _os_id;
  IF v_validado IS TRUE THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(comprimento_dia), 0),
    COALESCE(SUM(ligacoes_dia), 0)
  INTO v_comp, v_lig
  FROM public.registros_producao
  WHERE os_id = _os_id AND excluido IS NOT TRUE;

  UPDATE public.ordens_servico
     SET comprimento_real = CASE WHEN v_comp > 0 THEN v_comp ELSE NULL END,
         ligacoes_real    = CASE WHEN v_lig  > 0 THEN v_lig  ELSE NULL END
   WHERE id = _os_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_registros_producao_sync_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_os_real_from_registros(OLD.os_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_os_real_from_registros(NEW.os_id);
    RETURN NEW;
  ELSE -- UPDATE
    PERFORM public.recompute_os_real_from_registros(NEW.os_id);
    IF NEW.os_id IS DISTINCT FROM OLD.os_id THEN
      PERFORM public.recompute_os_real_from_registros(OLD.os_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_registros_producao_sync_os ON public.registros_producao;
CREATE TRIGGER trg_registros_producao_sync_os
AFTER INSERT OR UPDATE OR DELETE ON public.registros_producao
FOR EACH ROW EXECUTE FUNCTION public.tg_registros_producao_sync_os();

-- Backfill: recomputa todas as OS ainda não validadas para corrigir drift
-- acumulado (ex.: TR-8.11 estava com 24m mas tinha 2 registros = 48m).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.ordens_servico WHERE real_validado IS NOT TRUE LOOP
    PERFORM public.recompute_os_real_from_registros(r.id);
  END LOOP;
END $$;
