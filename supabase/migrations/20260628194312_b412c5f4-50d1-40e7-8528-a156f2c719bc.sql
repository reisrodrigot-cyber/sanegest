
CREATE OR REPLACE VIEW public.relatorio_producao_diaria
WITH (security_invoker = true) AS
SELECT
  os.id AS os_id,
  os.bacia AS obra_id,
  os.bacia AS obra_nome,
  os.trecho,
  COALESCE(NULLIF(os.liberado_para, ''), NULLIF(os.executor_real, ''), NULLIF(os.executor, '')) AS encarregado,
  os.liberado_para,
  COALESCE(NULLIF(p.apelido, ''), NULLIF(p.display_name, ''), NULLIF(os.executor_real, ''), NULLIF(os.liberado_para, ''), NULLIF(os.executor, '')) AS responsavel_nome,
  COALESCE(os.real_validado, false) AS real_validado,
  reg.ultima_data AS data_producao,
  reg.soma_comprimento AS comprimento_trecho_executado,
  reg.soma_ligacoes AS quantidade_ligacoes_realizadas,
  lig.ligacoes_detalhadas,
  lig.comprimento_total_ligacoes,
  os.updated_at
FROM public.ordens_servico os
LEFT JOIN LATERAL (
  SELECT
    SUM(COALESCE(rp.comprimento_ajustado, rp.comprimento_dia, 0::numeric)) AS soma_comprimento,
    SUM(COALESCE(rp.ligacoes_ajustadas, rp.ligacoes_dia, 0)) AS soma_ligacoes,
    MAX(rp.data_registro) AS ultima_data
  FROM public.registros_producao rp
  WHERE rp.os_id = os.id
    AND COALESCE(rp.excluido, false) = false
    AND rp.status = 'ativo'
) reg ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS ligacoes_detalhadas,
    SUM(COALESCE(l.comprimento, 0::numeric)) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.os_id = os.id
) lig ON true
LEFT JOIN public.profiles p
  ON lower(p.email) = lower(COALESCE(NULLIF(os.liberado_para, ''), NULLIF(os.executor_real, ''), NULLIF(os.executor, '')));

GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated, service_role;
