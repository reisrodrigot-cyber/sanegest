CREATE OR REPLACE FUNCTION public.get_mapa_publico(_ss text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_base_id uuid;
  v_pode_preview boolean;
  v_result jsonb;
BEGIN
  -- Leitura: qualquer usuário autenticado. Edição continua restrita (RLS das tabelas).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para consultar o mapa público';
  END IF;

  v_pode_preview := public.pode_ver_mapa_base_preview(v_uid);

  SELECT id INTO v_base_id
  FROM public.mapa_bases
  WHERE ss = _ss
    AND (status = 'ativa' OR (v_pode_preview AND status = 'preview'))
  ORDER BY versao DESC
  LIMIT 1;

  IF v_base_id IS NULL THEN
    RETURN jsonb_build_object('base', NULL, 'trechos', '[]'::jsonb, 'pontos', '[]'::jsonb);
  END IF;

  WITH
  base AS (
    SELECT jsonb_build_object(
      'id', b.id, 'ss', b.ss, 'versao', b.versao, 'status', b.status,
      'bbox', b.bbox, 'feicoes_rede', b.feicoes_rede, 'feicoes_pv', b.feicoes_pv
    ) AS j
    FROM public.mapa_bases b WHERE b.id = v_base_id
  ),
  trecho_efetivo AS (
    SELECT
      COALESCE(op.id::text, t.id::text) AS id,
      COALESCE(op.rotulo, t.rotulo_original) AS rotulo,
      t.id AS trecho_origem_id,
      COALESCE(op.dn, t.dn) AS dn,
      COALESCE(op.material, t.material) AS material,
      COALESCE(op.extensao_m, t.l_escala) AS extensao_m,
      COALESCE(op.geom, t.geometry) AS geometry,
      CASE WHEN op.id IS NULL THEN 'original' ELSE op.tipo::text END AS tipo
    FROM public.mapa_trechos t
    LEFT JOIN LATERAL (
      SELECT * FROM public.mapa_trecho_operacional o
      WHERE o.trecho_origem_id = t.id AND o.tipo <> 'suprimido'
      ORDER BY o.updated_at DESC LIMIT 1
    ) op ON true
    WHERE t.base_id = v_base_id
    UNION ALL
    SELECT
      o.id::text, o.rotulo, o.trecho_origem_id,
      o.dn, o.material, o.extensao_m, o.geom AS geometry, o.tipo::text
    FROM public.mapa_trecho_operacional o
    WHERE o.base_id = v_base_id
      AND o.tipo IN ('derivado','manual')
  ),
  vinc AS (
    SELECT v.trecho_id, v.trecho_operacional_id, v.os_id
    FROM public.mapa_trecho_os v
    WHERE v.ativo = true
  ),
  ns AS (
    SELECT os.id, os.trecho, os.bacia, os.status
    FROM public.ordens_servico os
  ),
  pv_final AS (
    SELECT DISTINCT os_id FROM public.registros_producao WHERE pv_final_assentado = true
  ),
  trechos_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', te.id,
      'rotulo', te.rotulo,
      'dn', te.dn,
      'material', te.material,
      'extensao_m', te.extensao_m,
      'geometry', te.geometry,
      'tipo', te.tipo,
      'vinculos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'os_id', n.id, 'trecho', n.trecho, 'bacia', n.bacia,
          'status', n.status,
          'pv_final_assentado', (n.id IN (SELECT os_id FROM pv_final))
        ))
        FROM vinc v
        JOIN ns n ON n.id = v.os_id
        WHERE (te.tipo = 'original' AND v.trecho_id::text = te.id AND v.trecho_operacional_id IS NULL)
           OR (te.tipo <> 'original' AND v.trecho_operacional_id::text = te.id)
      ), '[]'::jsonb)
    )) AS j
    FROM trecho_efetivo te
  ),
  ponto_efetivo AS (
    SELECT
      COALESCE(op.id::text, p.id::text) AS id,
      COALESCE(op.rotulo, p.rotulo_original) AS rotulo,
      COALESCE(op.lat, p.lat) AS lat,
      COALESCE(op.lon, p.lon) AS lon,
      p.tipo_no,
      COALESCE(op.cota, p.cota_marg, p.cota_inv) AS cota,
      COALESCE(op.profundidade, p.prof) AS prof,
      CASE WHEN op.id IS NULL THEN 'original' ELSE op.tipo::text END AS tipo
    FROM public.mapa_pontos p
    LEFT JOIN LATERAL (
      SELECT * FROM public.mapa_pv_operacional o
      WHERE o.ponto_origem_id = p.id AND o.tipo <> 'suprimido'
      ORDER BY o.updated_at DESC LIMIT 1
    ) op ON true
    WHERE p.base_id = v_base_id AND p.lon IS NOT NULL
    UNION ALL
    SELECT o.id::text, o.rotulo, o.lat, o.lon,
      NULL AS tipo_no, o.cota, o.profundidade, o.tipo::text
    FROM public.mapa_pv_operacional o
    WHERE o.base_id = v_base_id AND o.tipo = 'manual'
  ),
  pontos_json AS (
    SELECT jsonb_agg(jsonb_build_object(
      'id', pe.id, 'rotulo', pe.rotulo, 'lat', pe.lat, 'lon', pe.lon,
      'tipo_no', pe.tipo_no, 'cota', pe.cota, 'prof', pe.prof, 'tipo', pe.tipo
    )) AS j FROM ponto_efetivo pe
  )
  SELECT jsonb_build_object(
    'base', (SELECT j FROM base),
    'trechos', COALESCE((SELECT j FROM trechos_json), '[]'::jsonb),
    'pontos', COALESCE((SELECT j FROM pontos_json), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;