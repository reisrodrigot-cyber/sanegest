CREATE OR REPLACE VIEW public.relatorio_producao_diaria AS
WITH reg_dia AS (
  SELECT
    rp.os_id,
    rp.data_registro AS data_producao,
    rp.user_id AS responsavel_user_id,
    SUM(COALESCE(rp.comprimento_ajustado, rp.comprimento_dia, 0::numeric)) AS soma_comprimento,
    SUM(COALESCE(rp.ligacoes_ajustadas, rp.ligacoes_dia, 0))::integer AS soma_ligacoes,
    ARRAY_AGG(rp.id) AS registro_ids,
    BOOL_OR(COALESCE(rp.pv_final_assentado, false)) AS pv_final_assentado,
    MAX(CASE WHEN rp.pv_final_assentado THEN rp.pv_final_assentado_em END) AS pv_final_assentado_em,
    (ARRAY_AGG(
      rp.pv_final_assentado_por
      ORDER BY CASE WHEN rp.pv_final_assentado THEN 0 ELSE 1 END,
               rp.pv_final_assentado_em DESC NULLS LAST
    ))[1] AS pv_final_por
  FROM public.registros_producao rp
  WHERE COALESCE(rp.excluido, false) = false
    AND rp.status = 'ativo'::text
  GROUP BY rp.os_id, rp.data_registro, rp.user_id
)
SELECT
  os.id AS os_id,
  os.bacia AS obra_id,
  os.bacia AS obra_nome,
  os.trecho,
  COALESCE(
    NULLIF(p.apelido, ''::text),
    NULLIF(p.display_name, ''::text),
    NULLIF(p.email, ''::text),
    NULLIF(os.liberado_para, ''::text),
    NULLIF(os.executor_real, ''::text),
    NULLIF(os.executor, ''::text)
  ) AS encarregado,
  os.liberado_para,
  COALESCE(
    NULLIF(p.apelido, ''::text),
    NULLIF(p.display_name, ''::text),
    NULLIF(p.email, ''::text),
    NULLIF(os.executor_real, ''::text),
    NULLIF(os.liberado_para, ''::text),
    NULLIF(os.executor, ''::text)
  ) AS responsavel_nome,
  COALESCE(os.real_validado, false) AS real_validado,
  reg.data_producao,
  reg.soma_comprimento AS comprimento_trecho_executado,
  reg.soma_ligacoes AS quantidade_ligacoes_realizadas,
  lig.ligacoes_detalhadas,
  lig.comprimento_total_ligacoes,
  os.updated_at,
  COALESCE(reg.pv_final_assentado, false) AS pv_final_assentado,
  CASE WHEN reg.pv_final_assentado THEN reg.pv_final_assentado_em END AS pv_final_assentado_em,
  CASE
    WHEN reg.pv_final_assentado THEN COALESCE(NULLIF(pp.apelido, ''::text), NULLIF(pp.display_name, ''::text), pp.email)
    ELSE NULL::text
  END AS pv_final_assentado_por_nome,
  CASE
    WHEN COALESCE(reg.pv_final_assentado, false) THEN 'PV final assentado — trecho concluído pelo encarregado.'::text
    ELSE NULL::text
  END AS observacao_conclusao,
  reg.responsavel_user_id
FROM reg_dia reg
JOIN public.ordens_servico os ON os.id = reg.os_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer AS ligacoes_detalhadas,
    COALESCE(SUM(COALESCE(l.comprimento, 0::numeric)), 0::numeric) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.registro_producao_id = ANY(reg.registro_ids)
) lig ON true
LEFT JOIN public.profiles p ON p.user_id = reg.responsavel_user_id
LEFT JOIN public.profiles pp ON pp.user_id = reg.pv_final_por;

ALTER VIEW public.relatorio_producao_diaria SET (security_invoker = false);
GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated, service_role;

COMMENT ON VIEW public.relatorio_producao_diaria IS
  'Relatório diário canônico por O.S., data e usuário responsável, com identidade resolvida por user_id e comprimentos efetivos das ligações do lançamento.';