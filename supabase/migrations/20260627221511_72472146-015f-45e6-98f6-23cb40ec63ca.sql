DROP VIEW IF EXISTS public.relatorio_producao_diaria;

CREATE VIEW public.relatorio_producao_diaria AS
SELECT
  os.id AS os_id,
  os.bacia AS obra_id,
  os.bacia AS obra_nome,
  os.trecho,
  COALESCE(NULLIF(os.liberado_para, ''), NULLIF(os.executor_real, ''), NULLIF(os.executor, '')) AS encarregado,
  os.liberado_para,
  COALESCE(
    NULLIF(p.apelido, ''),
    NULLIF(os.executor_real, ''),
    NULLIF(os.liberado_para, ''),
    NULLIF(os.executor, '')
  ) AS responsavel_nome,
  COALESCE(os.real_validado, false) AS real_validado,
  CASE
    WHEN COALESCE(os.real_validado, false) THEN os.updated_at::date
    ELSE COALESCE(reg.ultima_data, os.updated_at::date)
  END AS data_producao,
  -- Rede executada (trechos). NUNCA inclui extensão de ligações.
  -- Quando a sala técnica valida, prevalece o valor oficial; senão usa soma de campo.
  CASE
    WHEN COALESCE(os.real_validado, false) THEN os.comprimento_real
    ELSE reg.soma_comprimento
  END AS comprimento_trecho_executado,
  CASE
    WHEN COALESCE(os.real_validado, false) THEN os.ligacoes_real
    ELSE reg.soma_ligacoes
  END AS quantidade_ligacoes_realizadas,
  -- Extensão das ligações segue separada da rede.
  lig.ligacoes_detalhadas,
  lig.comprimento_total_ligacoes,
  os.updated_at
FROM public.ordens_servico os
LEFT JOIN LATERAL (
  SELECT
    SUM(COALESCE(rp.comprimento_dia, 0)) AS soma_comprimento,
    SUM(COALESCE(rp.ligacoes_dia, 0))    AS soma_ligacoes,
    MAX(rp.data_registro)                AS ultima_data
  FROM public.registros_producao rp
  WHERE rp.os_id = os.id
) reg ON TRUE
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'referencia', l.referencia,
        'comprimento', l.comprimento,
        'latitude', l.latitude,
        'longitude', l.longitude
      ) ORDER BY l.created_at
    ) AS ligacoes_detalhadas,
    NULLIF(SUM(COALESCE(l.comprimento, 0)), 0) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.os_id = os.id
) lig ON TRUE
LEFT JOIN LATERAL (
  SELECT pr.apelido
  FROM public.profiles pr
  WHERE pr.apelido IS NOT NULL
    AND pr.apelido <> ''
    AND (
      pr.apelido = COALESCE(NULLIF(os.executor_real, ''), NULLIF(os.liberado_para, ''), NULLIF(os.executor, ''))
      OR pr.display_name = COALESCE(NULLIF(os.executor_real, ''), NULLIF(os.liberado_para, ''), NULLIF(os.executor, ''))
    )
  LIMIT 1
) p ON TRUE
WHERE
  (COALESCE(os.real_validado, false) AND (os.comprimento_real IS NOT NULL OR os.ligacoes_real IS NOT NULL))
  OR (NOT COALESCE(os.real_validado, false) AND (COALESCE(reg.soma_comprimento, 0) > 0 OR COALESCE(reg.soma_ligacoes, 0) > 0));

ALTER VIEW public.relatorio_producao_diaria SET (security_invoker = true);
GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated, service_role;

COMMENT ON VIEW public.relatorio_producao_diaria IS
  'Relatório oficial de produção diária. Quando a OS está com real_validado=true, '
  'os campos de rede e ligações vêm de comprimento_real/ligacoes_real (sala técnica). '
  'Caso contrário, são somados a partir de registros_producao como valor provisório. '
  'A extensão das ligações é exposta separadamente e NUNCA é somada ao comprimento de rede.';
