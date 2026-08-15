CREATE OR REPLACE FUNCTION public.assistant_produtividade_encarregado(
  _data_inicial date,
  _data_final date,
  _encarregado text DEFAULT NULL::text
)
RETURNS TABLE(
  responsavel text,
  rede_m numeric,
  dias_com_rede integer,
  produtividade_rede_m_dia numeric,
  ligacoes_qtd integer,
  ligacoes_comprimento_m numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT v.*
    FROM public.relatorio_producao_diaria v
    WHERE _data_inicial IS NOT NULL
      AND _data_final IS NOT NULL
      AND _data_final >= _data_inicial
      AND v.data_producao BETWEEN _data_inicial AND _data_final
      AND (_encarregado IS NULL OR v.responsavel_nome ILIKE '%' || btrim(_encarregado) || '%')
  ),
  lig AS (
    SELECT
      responsavel_user_id,
      MAX(responsavel_nome) AS responsavel_nome,
      os_id,
      MAX(COALESCE(comprimento_total_ligacoes, 0)) AS comp_lig,
      SUM(COALESCE(quantidade_ligacoes_realizadas, 0))::int AS qtd_lig
    FROM base
    GROUP BY responsavel_user_id, os_id
  ),
  rede AS (
    SELECT
      responsavel_user_id,
      MAX(responsavel_nome) AS responsavel_nome,
      SUM(COALESCE(comprimento_trecho_executado, 0)) AS rede_m,
      COUNT(DISTINCT data_producao) FILTER (
        WHERE COALESCE(comprimento_trecho_executado, 0) > 0
      )::int AS dias
    FROM base
    GROUP BY responsavel_user_id
  )
  SELECT
    COALESCE(r.responsavel_nome, '(sem responsável)'),
    ROUND(r.rede_m, 2),
    r.dias,
    CASE WHEN r.dias > 0 THEN ROUND(r.rede_m / r.dias, 2) ELSE 0 END,
    COALESCE((
      SELECT SUM(l.qtd_lig)
      FROM lig l
      WHERE l.responsavel_user_id IS NOT DISTINCT FROM r.responsavel_user_id
    ), 0)::int,
    COALESCE((
      SELECT ROUND(SUM(l.comp_lig), 2)
      FROM lig l
      WHERE l.responsavel_user_id IS NOT DISTINCT FROM r.responsavel_user_id
    ), 0)
  FROM rede r
  ORDER BY 2 DESC
$function$;