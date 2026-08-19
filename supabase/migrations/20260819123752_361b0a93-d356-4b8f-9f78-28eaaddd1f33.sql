DROP VIEW IF EXISTS public.relatorio_producao_diaria;

CREATE VIEW public.relatorio_producao_diaria AS
WITH reg_dia AS (
  SELECT
    rp.os_id,
    rp.data_registro AS data_producao,
    rp.user_id AS autor_user_id,
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
    NULLIF(enc.apelido, ''::text),
    NULLIF(enc.display_name, ''::text),
    NULLIF(btrim(os.liberado_para), ''::text),
    'Encarregado não definido'::text
  ) AS encarregado,
  os.liberado_para,
  COALESCE(
    NULLIF(enc.apelido, ''::text),
    NULLIF(enc.display_name, ''::text),
    NULLIF(btrim(os.liberado_para), ''::text),
    'Encarregado não definido'::text
  ) AS responsavel_nome,
  enc.user_id AS responsavel_user_id,
  (COALESCE(NULLIF(btrim(os.liberado_para), ''::text), '') = '') AS encarregado_indefinido,
  reg.autor_user_id,
  COALESCE(NULLIF(a.apelido, ''::text), NULLIF(a.display_name, ''::text), a.email) AS autor_nome,
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
  END AS observacao_conclusao
FROM reg_dia reg
JOIN public.ordens_servico os ON os.id = reg.os_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::integer AS ligacoes_detalhadas,
    COALESCE(SUM(COALESCE(l.comprimento, 0::numeric)), 0::numeric) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.registro_producao_id = ANY(reg.registro_ids)
) lig ON true
LEFT JOIN LATERAL (
  SELECT pr.user_id, pr.apelido, pr.display_name, pr.email
  FROM public.profiles pr
  WHERE COALESCE(NULLIF(btrim(os.liberado_para), ''), '@@none@@') IN (
    btrim(COALESCE(pr.apelido, '')),
    btrim(COALESCE(pr.display_name, '')),
    btrim(COALESCE(pr.email, '')),
    split_part(btrim(COALESCE(pr.email, '')), '@', 1)
  )
  ORDER BY pr.updated_at DESC
  LIMIT 1
) enc ON true
LEFT JOIN public.profiles a ON a.user_id = reg.autor_user_id
LEFT JOIN public.profiles pp ON pp.user_id = reg.pv_final_por;

ALTER VIEW public.relatorio_producao_diaria SET (security_invoker = false);
GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated, service_role;

COMMENT ON VIEW public.relatorio_producao_diaria IS
  'Relatório diário canônico por O.S. e data. O responsável pela produção é o encarregado operacional da N.S. (liberado_para); o usuário que digitou o lançamento permanece apenas como autor de auditoria (autor_user_id/autor_nome).';