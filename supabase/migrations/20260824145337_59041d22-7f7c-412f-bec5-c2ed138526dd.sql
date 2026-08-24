CREATE OR REPLACE FUNCTION public.set_os_pav_previsto_lote(_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF EXISTS (SELECT 1 FROM _pav_in WHERE pav NOT IN ('Solo Natural','Asfalto','Paralelepípedo')) THEN
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
$$;

REVOKE ALL ON FUNCTION public.set_os_pav_previsto_lote(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_os_pav_previsto_lote(jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.pav_normalizacao_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id uuid NOT NULL,
  valor_anterior text,
  valor_novo text NOT NULL,
  origem text NOT NULL,
  requisicao_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pav_normalizacao_log TO authenticated;
GRANT ALL ON public.pav_normalizacao_log TO service_role;

ALTER TABLE public.pav_normalizacao_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin e sala tecnica leem log de normalizacao pav" ON public.pav_normalizacao_log;
CREATE POLICY "Admin e sala tecnica leem log de normalizacao pav"
ON public.pav_normalizacao_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sala_tecnica'::app_role));

WITH alvo AS (
  SELECT DISTINCT unnest(os_ids) AS os_id
  FROM public.os_pavimento_update_log
  WHERE requisicao_id = 'f70a69f5-1d99-424a-8da1-027ad62da52d'
), upd AS (
  UPDATE public.ordens_servico o
     SET pav_previsto = CASE o.pav_previsto
           WHEN 'Terreno Natural' THEN 'Solo Natural'
           WHEN 'Paralelo' THEN 'Paralelepípedo'
         END
    FROM alvo a
   WHERE o.id = a.os_id
     AND o.pav_previsto IN ('Terreno Natural','Paralelo')
  RETURNING o.id, o.pav_previsto AS novo
)
INSERT INTO public.pav_normalizacao_log (os_id, valor_anterior, valor_novo, origem, requisicao_id)
SELECT u.id,
       CASE u.novo WHEN 'Solo Natural' THEN 'Terreno Natural' ELSE 'Paralelo' END,
       u.novo,
       'correcao_padronizacao_pavimento',
       'f70a69f5-1d99-424a-8da1-027ad62da52d'
FROM upd u;