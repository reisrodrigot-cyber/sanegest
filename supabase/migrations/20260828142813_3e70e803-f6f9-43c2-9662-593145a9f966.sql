CREATE OR REPLACE FUNCTION public.pavimentacao_minhas_ns(_user_id uuid DEFAULT NULL)
RETURNS TABLE(os_id uuid, trecho text, sub_bacia text, pv_montante text, pv_jusante text,
              comprimento_previsto numeric, pav_previsto text, liberado boolean,
              area_prevista_m2 numeric, area_realizada_m2 numeric, concluido boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT os.id, os.trecho, os.bacia, os.pv_montante, os.pv_jusante,
         os.comprimento_previsto, os.pav_previsto, l.liberado,
         public.pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto),
         COALESCE((SELECT SUM(r.area_m2) FROM public.registros_pavimentacao r
                    WHERE r.os_id = os.id AND r.excluido = false AND r.status = 'ativo'), 0),
         COALESCE(c.concluido, false)
  FROM public.os_liberacao_pavimentacao l
  JOIN public.ordens_servico os ON os.id = l.os_id
  LEFT JOIN public.os_pavimentacao_conclusao c ON c.os_id = os.id
  WHERE l.liberado = true
    AND (
      -- perspectiva ativa: mostra apenas as N.S. do usuário informado
      (_user_id IS NOT NULL AND l.liberado_para_user_id = _user_id)
      -- sem perspectiva: próprio encarregado, ou visão completa da gestão
      OR (_user_id IS NULL AND (l.liberado_para_user_id = auth.uid()
                                OR public.pode_gerir_pavimentacao(auth.uid())))
    )
  ORDER BY os.bacia, os.trecho
$$;
REVOKE EXECUTE ON FUNCTION public.pavimentacao_minhas_ns(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pavimentacao_minhas_ns(uuid) TO authenticated;