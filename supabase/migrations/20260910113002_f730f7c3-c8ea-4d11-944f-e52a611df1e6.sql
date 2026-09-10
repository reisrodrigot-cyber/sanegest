CREATE OR REPLACE FUNCTION public.pav_elegivel_os(_previsto text, _real text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT public.pav_elegivel(_previsto) OR public.pav_elegivel(_real)
$function$;

CREATE OR REPLACE FUNCTION public.liberar_pavimentacao(_os_id uuid, _encarregado_user_id uuid, _motivo text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_pav text; v_pav_real text;
BEGIN
  IF NOT public.pode_gerir_pavimentacao(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para liberar pavimentação';
  END IF;
  SELECT pav_previsto, pav_real INTO v_pav, v_pav_real FROM public.ordens_servico WHERE id = _os_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'N.S. inexistente'; END IF;
  IF NOT public.pav_elegivel_os(v_pav, v_pav_real) THEN
    RAISE EXCEPTION 'N.S. não elegível para pavimentação (previsto: %, executado: %)', COALESCE(v_pav,'—'), COALESCE(v_pav_real,'—');
  END IF;

  INSERT INTO public.os_liberacao_pavimentacao (os_id, liberado, liberado_para_user_id, liberado_em, revogado_em, motivo)
  VALUES (_os_id, true, _encarregado_user_id, now(), NULL, _motivo)
  ON CONFLICT (os_id) DO UPDATE
    SET liberado = true, liberado_para_user_id = EXCLUDED.liberado_para_user_id,
        liberado_em = now(), revogado_em = NULL, motivo = EXCLUDED.motivo;

  RETURN jsonb_build_object('os_id', _os_id, 'liberado', true);
END $function$;