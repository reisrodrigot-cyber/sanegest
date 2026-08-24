CREATE OR REPLACE FUNCTION public.set_os_pav_previsto_lote(_itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total int;
  v_faltantes uuid[];
  v_atualizados int := 0;
BEGIN
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'lista_vazia';
  END IF;

  CREATE TEMP TABLE _pav_in (os_id uuid PRIMARY KEY, pav text NOT NULL) ON COMMIT DROP;

  INSERT INTO _pav_in (os_id, pav)
  SELECT (e->>'os_id')::uuid, e->>'pav_previsto'
  FROM jsonb_array_elements(_itens) e;

  SELECT count(*) INTO v_total FROM _pav_in;

  IF EXISTS (
    SELECT 1 FROM _pav_in WHERE pav NOT IN (
      'Solo Natural',
      'Asfalto',
      'Paralelepipedo',
      'Solo Natural / Asfalto',
      'Solo Natural / Paralelepipedo',
      'Asfalto / Paralelepipedo',
      'Solo Natural / Asfalto / Paralelepipedo'
    )
  ) THEN
    RAISE EXCEPTION 'pavimento_invalido';
  END IF;

  SELECT array_agg(i.os_id) INTO v_faltantes
  FROM _pav_in i
  WHERE NOT EXISTS (SELECT 1 FROM public.ordens_servico o WHERE o.id = i.os_id);

  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'ns_inexistente:%', array_to_string(v_faltantes, ',');
  END IF;

  WITH upd AS (
    UPDATE public.ordens_servico o
       SET pav_previsto = i.pav
      FROM _pav_in i
     WHERE o.id = i.os_id
       AND COALESCE(o.pav_previsto,'') <> i.pav
    RETURNING o.id
  )
  SELECT count(*) INTO v_atualizados FROM upd;

  RETURN jsonb_build_object(
    'total', v_total,
    'atualizados', v_atualizados,
    'inalterados', v_total - v_atualizados
  );
END;
$function$;