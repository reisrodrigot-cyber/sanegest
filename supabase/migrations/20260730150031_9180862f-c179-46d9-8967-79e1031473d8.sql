-- Função central de precedência de status (As Built > PV assentado > demais regras)
CREATE OR REPLACE FUNCTION public.recompute_os_status(_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_asbuilt boolean;
  v_pv boolean;
  v_prod boolean;
  v_novo public.os_status;
BEGIN
  IF _os_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = _os_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- 1) As Built confiável (>= 2 pontos com coordenada) nunca é sobrescrito
  SELECT COUNT(*) >= 2 INTO v_asbuilt
  FROM public.topografia_asbuilt t
  WHERE t.os_id = _os_id AND t.latitude IS NOT NULL AND t.longitude IS NOT NULL;
  IF v_asbuilt THEN RETURN; END IF;

  -- 2) PV final assentado válido: ativo, não excluído, não cancelado
  SELECT EXISTS (
    SELECT 1 FROM public.registros_producao r
    WHERE r.os_id = _os_id
      AND r.pv_final_assentado = true
      AND r.excluido IS NOT TRUE
      AND r.status = 'ativo'
  ) INTO v_pv;

  IF v_pv THEN
    v_novo := 'VERDE';
  ELSE
    -- 3) demais regras atuais
    IF v_os.status = 'VERDE' OR v_os.status = 'AMARELO' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.registros_producao r
        WHERE r.os_id = _os_id
          AND r.excluido IS NOT TRUE
          AND r.status = 'ativo'
          AND (COALESCE(r.comprimento_ajustado, r.comprimento_dia, 0) > 0
               OR COALESCE(r.ligacoes_ajustadas, r.ligacoes_dia, 0) > 0)
      ) INTO v_prod;

      IF NOT COALESCE(v_os.liberado, false) THEN
        v_novo := 'CINZA';
      ELSIF v_prod THEN
        v_novo := 'AMARELO';
      ELSIF v_os.material_entregue_em IS NOT NULL THEN
        v_novo := 'LARANJA';
      ELSE
        v_novo := 'VERMELHO';
      END IF;
    ELSE
      RETURN; -- CINZA/VERMELHO/LARANJA continuam sob as regras existentes
    END IF;
  END IF;

  IF v_novo IS DISTINCT FROM v_os.status THEN
    UPDATE public.ordens_servico SET status = v_novo WHERE id = _os_id;
  END IF;
END;
$$;

-- Trigger de recálculo reagindo a INSERT/UPDATE/DELETE de produção
CREATE OR REPLACE FUNCTION public.promote_os_on_pv_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_os_status(OLD.os_id);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_os_status(NEW.os_id);
  IF TG_OP = 'UPDATE' AND NEW.os_id IS DISTINCT FROM OLD.os_id THEN
    PERFORM public.recompute_os_status(OLD.os_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_os_on_pv_final ON public.registros_producao;
CREATE TRIGGER trg_promote_os_on_pv_final
AFTER INSERT OR DELETE OR UPDATE OF pv_final_assentado, status, excluido, motivo_cancelamento, cancelado_em, cancelado_por, os_id
ON public.registros_producao
FOR EACH ROW EXECUTE FUNCTION public.promote_os_on_pv_final();