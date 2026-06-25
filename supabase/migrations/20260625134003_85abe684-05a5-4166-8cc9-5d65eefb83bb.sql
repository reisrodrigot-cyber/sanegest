
CREATE OR REPLACE VIEW public.relatorio_producao_diaria
WITH (security_invoker = true) AS
SELECT
  rp.id                                   AS registro_id,
  rp.data_registro                        AS data_producao,
  os.bacia                                AS obra_id,
  os.bacia                                AS obra_nome,
  COALESCE(p.apelido, p.display_name, p.email, os.liberado_para) AS encarregado,
  os.liberado_para                        AS liberado_para,
  rp.user_id                              AS encarregado_user_id,
  os.id                                   AS os_id,
  os.trecho                               AS trecho,
  rp.comprimento_dia                      AS comprimento_trecho_executado,
  rp.ligacoes_dia                         AS quantidade_ligacoes_realizadas,
  (
    SELECT jsonb_agg(
             jsonb_build_object(
               'id', l.id,
               'referencia', l.referencia,
               'comprimento', l.comprimento,
               'latitude', l.latitude,
               'longitude', l.longitude
             )
             ORDER BY l.created_at
           )
    FROM public.ligacoes l
    WHERE l.registro_producao_id = rp.id
  )                                        AS ligacoes_detalhadas,
  (
    SELECT SUM(l.comprimento)
    FROM public.ligacoes l
    WHERE l.registro_producao_id = rp.id
      AND l.comprimento IS NOT NULL
  )                                        AS comprimento_total_ligacoes,
  rp.observacao                            AS observacao,
  rp.tipo_pavimento                        AS tipo_pavimento,
  rp.updated_at                            AS updated_at
FROM public.registros_producao rp
JOIN public.ordens_servico os ON os.id = rp.os_id
LEFT JOIN public.profiles p   ON p.user_id = rp.user_id;

COMMENT ON VIEW public.relatorio_producao_diaria IS
  'Read-only: uma linha por registro de produção, com trecho, obra (bacia), encarregado e ligações vinculadas. '
  'Atenção: o comprimento individual das ligações é lido de public.ligacoes.comprimento. '
  'Quando o encarregado não registrar esse valor por ligação (campo nulo), comprimento_total_ligacoes virá nulo. '
  'Futuramente, salvar o comprimento por ligação em public.ligacoes.comprimento na tela de produção/topografia.';

GRANT SELECT ON public.relatorio_producao_diaria TO authenticated;
GRANT SELECT ON public.relatorio_producao_diaria TO service_role;
