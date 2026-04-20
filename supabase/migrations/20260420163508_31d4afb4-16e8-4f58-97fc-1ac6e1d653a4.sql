-- Trigger: ao inserir um registro de produção, promove a OS de VERMELHO para AMARELO
CREATE OR REPLACE FUNCTION public.promote_os_on_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só promove se houver produção real e a OS estiver VERMELHA
  IF (COALESCE(NEW.comprimento_dia, 0) > 0 OR COALESCE(NEW.ligacoes_dia, 0) > 0) THEN
    UPDATE public.ordens_servico
       SET status = 'AMARELO'
     WHERE id = NEW.os_id
       AND status = 'VERMELHO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_os_on_producao ON public.registros_producao;

CREATE TRIGGER trg_promote_os_on_producao
AFTER INSERT ON public.registros_producao
FOR EACH ROW
EXECUTE FUNCTION public.promote_os_on_producao();