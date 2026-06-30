DROP VIEW IF EXISTS public.relatorio_producao_diaria;
CREATE VIEW public.relatorio_producao_diaria AS
SELECT os.id AS os_id,
    os.bacia AS obra_id,
    os.bacia AS obra_nome,
    os.trecho,
    COALESCE(NULLIF(os.liberado_para, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.executor, ''::text)) AS encarregado,
    os.liberado_para,
    COALESCE(NULLIF(p.apelido, ''::text), NULLIF(p.display_name, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.liberado_para, ''::text), NULLIF(os.executor, ''::text)) AS responsavel_nome,
    COALESCE(os.real_validado, false) AS real_validado,
    reg.ultima_data AS data_producao,
    reg.soma_comprimento AS comprimento_trecho_executado,
    reg.soma_ligacoes AS quantidade_ligacoes_realizadas,
    lig.ligacoes_detalhadas,
    lig.comprimento_total_ligacoes,
    os.updated_at,
    COALESCE(pv.pv_final_assentado, false) AS pv_final_assentado,
    pv.pv_final_assentado_em,
    COALESCE(NULLIF(pp.apelido, ''::text), NULLIF(pp.display_name, ''::text), pp.email) AS pv_final_assentado_por_nome,
    CASE WHEN COALESCE(pv.pv_final_assentado, false)
         THEN 'PV final assentado — trecho concluído pelo encarregado.'
         ELSE NULL END AS observacao_conclusao
   FROM ordens_servico os
     LEFT JOIN LATERAL ( SELECT sum(COALESCE(rp.comprimento_ajustado, rp.comprimento_dia, 0::numeric)) AS soma_comprimento,
            sum(COALESCE(rp.ligacoes_ajustadas, rp.ligacoes_dia, 0)) AS soma_ligacoes,
            max(rp.data_registro) AS ultima_data
           FROM registros_producao rp
          WHERE rp.os_id = os.id AND COALESCE(rp.excluido, false) = false AND rp.status = 'ativo'::text) reg ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS ligacoes_detalhadas,
            sum(COALESCE(l.comprimento, 0::numeric)) AS comprimento_total_ligacoes
           FROM ligacoes l
          WHERE l.os_id = os.id) lig ON true
     LEFT JOIN LATERAL ( SELECT bool_or(COALESCE(rp.pv_final_assentado, false)) AS pv_final_assentado,
            max(rp.pv_final_assentado_em) AS pv_final_assentado_em,
            (array_agg(rp.pv_final_assentado_por ORDER BY rp.pv_final_assentado_em DESC NULLS LAST))[1] AS pv_final_assentado_por
           FROM registros_producao rp
          WHERE rp.os_id = os.id
            AND COALESCE(rp.excluido, false) = false
            AND rp.status = 'ativo'::text
            AND rp.data_registro = reg.ultima_data
            AND COALESCE(rp.pv_final_assentado, false) = true) pv ON true
     LEFT JOIN profiles p ON lower(p.email) = lower(COALESCE(NULLIF(os.liberado_para, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.executor, ''::text)))
     LEFT JOIN profiles pp ON pp.user_id = pv.pv_final_assentado_por;

ALTER VIEW public.relatorio_producao_diaria SET (security_invoker = false);
GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated, service_role;