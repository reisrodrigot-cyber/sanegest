
DROP VIEW IF EXISTS public.relatorio_producao_diaria;

CREATE VIEW public.relatorio_producao_diaria
WITH (security_invoker = true) AS
SELECT
  os.id                                                  AS os_id,
  os.bacia                                               AS obra_id,
  os.bacia                                               AS obra_nome,
  os.trecho                                              AS trecho,
  COALESCE(NULLIF(os.liberado_para, ''),
           NULLIF(os.executor_real, ''),
           NULLIF(os.executor, ''))                      AS encarregado,
  os.liberado_para                                       AS liberado_para,
  os.updated_at::date                                    AS data_producao,
  os.comprimento_real                                    AS comprimento_trecho_executado,
  os.ligacoes_real                                       AS quantidade_ligacoes_realizadas,
  lig.ligacoes_detalhadas                                AS ligacoes_detalhadas,
  lig.comprimento_total_ligacoes                         AS comprimento_total_ligacoes,
  os.updated_at                                          AS updated_at
FROM public.ordens_servico os
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'referencia', l.referencia,
        'comprimento', l.comprimento,
        'latitude', l.latitude,
        'longitude', l.longitude
      )
      ORDER BY l.created_at
    )                                          AS ligacoes_detalhadas,
    NULLIF(SUM(COALESCE(l.comprimento, 0)), 0) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.os_id = os.id
) lig ON TRUE
WHERE os.comprimento_real IS NOT NULL
   OR os.ligacoes_real    IS NOT NULL;

COMMENT ON VIEW public.relatorio_producao_diaria IS
  'Read-only. Base: ordens_servico. data_producao = updated_at::date (placeholder até existir um campo dedicado). '
  'comprimento individual por ligação vive em public.ligacoes.comprimento; quando nulo, comprimento_total_ligacoes é nulo.';

GRANT SELECT ON public.relatorio_producao_diaria TO authenticated;
GRANT SELECT ON public.relatorio_producao_diaria TO service_role;
