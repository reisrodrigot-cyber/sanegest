DROP VIEW IF EXISTS public.relatorio_producao_diaria;

CREATE VIEW public.relatorio_producao_diaria
WITH (security_invoker = false) AS
WITH reg_dia AS (
  SELECT
    rp.os_id,
    rp.data_registro AS data_producao,
    SUM(COALESCE(rp.comprimento_ajustado, rp.comprimento_dia, 0))::numeric AS soma_comprimento,
    SUM(COALESCE(rp.ligacoes_ajustadas, rp.ligacoes_dia, 0))::int AS soma_ligacoes,
    bool_or(COALESCE(rp.pv_final_assentado, false)) AS pv_final_assentado,
    MAX(CASE WHEN rp.pv_final_assentado THEN rp.pv_final_assentado_em END) AS pv_final_assentado_em,
    (array_agg(rp.pv_final_assentado_por ORDER BY
       CASE WHEN rp.pv_final_assentado THEN 0 ELSE 1 END,
       rp.pv_final_assentado_em DESC NULLS LAST))[1] AS pv_final_por
  FROM public.registros_producao rp
  WHERE COALESCE(rp.excluido, false) = false
    AND rp.status = 'ativo'
  GROUP BY rp.os_id, rp.data_registro
)
SELECT
  os.id AS os_id,
  os.bacia AS obra_id,
  os.bacia AS obra_nome,
  os.trecho,
  COALESCE(NULLIF(os.liberado_para, ''), NULLIF(os.executor_real, ''), NULLIF(os.executor, '')) AS encarregado,
  os.liberado_para,
  COALESCE(NULLIF(p.apelido, ''), NULLIF(p.display_name, ''), NULLIF(os.executor_real, ''), NULLIF(os.liberado_para, ''), NULLIF(os.executor, '')) AS responsavel_nome,
  COALESCE(os.real_validado, false) AS real_validado,
  reg.data_producao,
  reg.soma_comprimento AS comprimento_trecho_executado,
  reg.soma_ligacoes AS quantidade_ligacoes_realizadas,
  lig.ligacoes_detalhadas,
  lig.comprimento_total_ligacoes,
  os.updated_at,
  COALESCE(reg.pv_final_assentado, false) AS pv_final_assentado,
  CASE WHEN reg.pv_final_assentado THEN reg.pv_final_assentado_em END AS pv_final_assentado_em,
  CASE WHEN reg.pv_final_assentado
       THEN COALESCE(NULLIF(pp.apelido, ''), NULLIF(pp.display_name, ''), pp.email)
       END AS pv_final_assentado_por_nome,
  CASE WHEN COALESCE(reg.pv_final_assentado, false)
       THEN 'PV final assentado — trecho concluído pelo encarregado.'
       ELSE NULL END AS observacao_conclusao
FROM reg_dia reg
JOIN public.ordens_servico os ON os.id = reg.os_id
LEFT JOIN LATERAL (
  SELECT count(*) AS ligacoes_detalhadas,
         sum(COALESCE(l.comprimento, 0)) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.os_id = os.id
) lig ON true
LEFT JOIN public.profiles p
  ON lower(p.email) = lower(COALESCE(NULLIF(os.liberado_para, ''), NULLIF(os.executor_real, ''), NULLIF(os.executor, '')))
LEFT JOIN public.profiles pp
  ON pp.user_id = reg.pv_final_por;

GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated, service_role;