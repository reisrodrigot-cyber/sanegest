DROP VIEW IF EXISTS public.relatorio_producao_diaria;
CREATE VIEW public.relatorio_producao_diaria AS
SELECT os.id AS os_id,
   os.bacia AS obra_id,
   os.bacia AS obra_nome,
   os.trecho,
   COALESCE(NULLIF(os.liberado_para, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.executor, ''::text)) AS encarregado,
   os.liberado_para,
   COALESCE(NULLIF(p.apelido, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.liberado_para, ''::text), NULLIF(os.executor, ''::text)) AS responsavel_nome,
   COALESCE(os.real_validado, false) AS real_validado,
   reg.ultima_data AS data_producao,
   reg.soma_comprimento AS comprimento_trecho_executado,
   reg.soma_ligacoes AS quantidade_ligacoes_realizadas,
   lig.ligacoes_detalhadas,
   lig.comprimento_total_ligacoes,
   os.updated_at
FROM public.ordens_servico os
LEFT JOIN LATERAL (
  SELECT sum(COALESCE(rp.comprimento_ajustado, rp.comprimento_dia, 0::numeric)) AS soma_comprimento,
         sum(COALESCE(rp.ligacoes_ajustadas, rp.ligacoes_dia, 0)) AS soma_ligacoes,
         max(rp.data_registro) AS ultima_data
  FROM public.registros_producao rp
  WHERE rp.os_id = os.id
    AND COALESCE(rp.excluido, false) = false
    AND rp.status = 'ativo'
) reg ON true
LEFT JOIN LATERAL (
  SELECT count(*)::bigint AS ligacoes_detalhadas,
         sum(COALESCE(l.comprimento, 0::numeric)) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.os_id = os.id
) lig ON true
LEFT JOIN public.profiles p ON p.user_id = (
  SELECT u.id FROM auth.users u
  WHERE lower(u.email) = lower(COALESCE(NULLIF(os.liberado_para, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.executor, ''::text)))
  LIMIT 1
);

ALTER VIEW public.relatorio_producao_diaria SET (security_invoker = true);
GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated, service_role;

COMMENT ON VIEW public.relatorio_producao_diaria IS
'Fonte: registros_producao ativos (excluido=false, status=ativo). Usa COALESCE(comprimento_ajustado, comprimento_dia) e COALESCE(ligacoes_ajustadas, ligacoes_dia). Ignora cancelados/excluídos. Não usa mais real_validado.';