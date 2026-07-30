-- ============ 1. RLS HARDENING ============
-- ordens_servico
DROP POLICY IF EXISTS "Allow all update OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Allow all delete OS" ON public.ordens_servico;

CREATE POLICY "OS update por papel operacional"
ON public.ordens_servico FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'almoxarifado'::app_role)
  OR public.has_role(auth.uid(), 'topografo'::app_role)
  OR public.has_role(auth.uid(), 'encarregado'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'almoxarifado'::app_role)
  OR public.has_role(auth.uid(), 'topografo'::app_role)
  OR public.has_role(auth.uid(), 'encarregado'::app_role)
);

CREATE POLICY "OS delete apenas sala tecnica"
ON public.ordens_servico FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
);

-- estacas
DROP POLICY IF EXISTS "Allow all update estacas" ON public.estacas;
DROP POLICY IF EXISTS "Allow all delete estacas" ON public.estacas;

CREATE POLICY "Estacas update tecnico/topografo"
ON public.estacas FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'topografo'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'topografo'::app_role)
);

CREATE POLICY "Estacas delete apenas sala tecnica"
ON public.estacas FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
);

-- materiais_entrega
DROP POLICY IF EXISTS "Allow all update materiais" ON public.materiais_entrega;
DROP POLICY IF EXISTS "Allow all delete materiais" ON public.materiais_entrega;

CREATE POLICY "Materiais update almoxarifado/tecnico"
ON public.materiais_entrega FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR (public.has_role(auth.uid(), 'almoxarifado'::app_role)
      AND (registrado_por IS NULL OR registrado_por = auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'almoxarifado'::app_role)
);

CREATE POLICY "Materiais delete restrito"
ON public.materiais_entrega FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR (public.has_role(auth.uid(), 'almoxarifado'::app_role)
      AND (registrado_por IS NULL OR registrado_por = auth.uid()))
);

-- topografia_asbuilt
DROP POLICY IF EXISTS "Allow all update topografia" ON public.topografia_asbuilt;
DROP POLICY IF EXISTS "Allow all delete topografia" ON public.topografia_asbuilt;

CREATE POLICY "Topografia update tecnico/topografo"
ON public.topografia_asbuilt FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'topografo'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'topografo'::app_role)
);

CREATE POLICY "Topografia delete restrito"
ON public.topografia_asbuilt FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR (public.has_role(auth.uid(), 'topografo'::app_role)
      AND (registrado_por IS NULL OR registrado_por = auth.uid()))
);

-- ============ 2. LOG DE ACESSO EXTERNO ============
CREATE TABLE public.assistant_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  operacao text NOT NULL,
  sucesso boolean NOT NULL,
  registros_retornados integer,
  params_hash text,
  erro text
);

GRANT ALL ON public.assistant_access_log TO service_role;
ALTER TABLE public.assistant_access_log ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: frontend (anon/authenticated) não enxerga nada.

-- ============ 3. RPCs DE LEITURA (somente service_role) ============
CREATE OR REPLACE FUNCTION public.assistant_buscar_ns(_termo text, _limit integer DEFAULT 20)
RETURNS TABLE (os_id uuid, trecho text, bacia text, pv_montante text, pv_jusante text, status text, responsavel text, liberado boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT os.id, os.trecho, os.bacia, os.pv_montante, os.pv_jusante,
         os.status::text,
         COALESCE(NULLIF(os.liberado_para,''), NULLIF(os.executor_real,''), NULLIF(os.executor,'')),
         os.liberado
  FROM public.ordens_servico os
  WHERE COALESCE(NULLIF(btrim(_termo),''),'') <> ''
    AND (os.trecho ILIKE '%'||btrim(_termo)||'%'
      OR os.bacia ILIKE '%'||btrim(_termo)||'%'
      OR COALESCE(os.pv_montante,'') ILIKE '%'||btrim(_termo)||'%'
      OR COALESCE(os.pv_jusante,'')  ILIKE '%'||btrim(_termo)||'%')
  ORDER BY os.bacia, os.trecho
  LIMIT LEAST(GREATEST(COALESCE(_limit,20),1),100)
$$;

CREATE OR REPLACE FUNCTION public.assistant_ns_detalhe(_os_id uuid DEFAULT NULL, _bacia text DEFAULT NULL, _trecho text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_res jsonb;
BEGIN
  IF _os_id IS NOT NULL THEN
    v_id := _os_id;
  ELSIF _bacia IS NOT NULL AND _trecho IS NOT NULL THEN
    SELECT id INTO v_id FROM public.ordens_servico
     WHERE lower(btrim(bacia)) = lower(btrim(_bacia))
       AND lower(btrim(trecho)) = lower(btrim(_trecho))
     ORDER BY updated_at DESC LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Informe os_id ou bacia+trecho';
  END IF;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'os_id', os.id,
    'trecho', os.trecho,
    'bacia', os.bacia,
    'pv_montante', os.pv_montante,
    'pv_jusante', os.pv_jusante,
    'status', os.status::text,
    'liberado', os.liberado,
    'responsavel', COALESCE(NULLIF(os.liberado_para,''), NULLIF(os.executor_real,''), NULLIF(os.executor,'')),
    'real_validado', os.real_validado,
    'material_entregue_em', os.material_entregue_em,
    'previsto', jsonb_build_object(
      'comprimento_m', os.comprimento_previsto,
      'ligacoes', os.ligacoes_previstas,
      'dn', os.dn,
      'prof_media', os.prof_media_prevista,
      'pavimento', os.pav_previsto,
      'prazo_dias', COALESCE(os.prazo_arredondado, os.prazo_previsto)
    ),
    'real', jsonb_build_object(
      'comprimento_m', os.comprimento_real,
      'ligacoes', os.ligacoes_real,
      'dn', os.dn_real,
      'prof_media', COALESCE(os.prof_media_real, os.prof_media_executada),
      'pavimento', os.pav_real,
      'prazo_dias', os.prazo_real
    ),
    -- produção consolidada vem da view canônica (nunca somada com comprimento_real)
    'producao', COALESCE((
      SELECT jsonb_build_object(
        'rede_executada_m', COALESCE(SUM(v.comprimento_trecho_executado),0),
        'ligacoes_qtd', COALESCE(SUM(v.quantidade_ligacoes_realizadas),0),
        'ligacoes_comprimento_m', COALESCE(MAX(v.comprimento_total_ligacoes),0),
        'dias_com_producao', COUNT(*) FILTER (WHERE COALESCE(v.comprimento_trecho_executado,0) > 0),
        'primeira_data', MIN(v.data_producao),
        'ultima_data', MAX(v.data_producao),
        'pv_final_assentado', BOOL_OR(COALESCE(v.pv_final_assentado,false))
      ) FROM public.relatorio_producao_diaria v WHERE v.os_id = os.id
    ), '{}'::jsonb),
    'materiais', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'descricao', m.descricao, 'quantidade', m.quantidade, 'unidade', m.unidade,
        'data_entrega', m.data_entrega, 'divergencia', m.divergencia))
      FROM public.materiais_entrega m WHERE m.os_id = os.id
    ), '[]'::jsonb),
    'asbuilt_pontos', (SELECT COUNT(*) FROM public.topografia_asbuilt t WHERE t.os_id = os.id),
    'vinculos_mapa', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'trecho_id', mt.trecho_id, 'trecho_operacional_id', mt.trecho_operacional_id,
        'fracao', mt.fracao, 'origem', mt.origem::text))
      FROM public.mapa_trecho_os mt WHERE mt.os_id = os.id AND mt.ativo = true
    ), '[]'::jsonb),
    'observacao_vinculo', 'Encarregado/responsável é vínculo por texto (liberado_para/executor), não por chave estrangeira.'
  ) INTO v_res
  FROM public.ordens_servico os WHERE os.id = v_id;

  RETURN v_res;
END $$;

CREATE OR REPLACE FUNCTION public.assistant_producao_periodo(
  _data_inicial date, _data_final date, _bacia text DEFAULT NULL, _encarregado text DEFAULT NULL, _limit integer DEFAULT 500)
RETURNS TABLE (data_producao date, os_id uuid, trecho text, bacia text, responsavel text,
               rede_m numeric, ligacoes_qtd integer, ligacoes_comprimento_m numeric, pv_final_assentado boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.data_producao, v.os_id, v.trecho, v.obra_id, v.responsavel_nome,
         COALESCE(v.comprimento_trecho_executado,0),
         COALESCE(v.quantidade_ligacoes_realizadas,0),
         COALESCE(v.comprimento_total_ligacoes,0),
         COALESCE(v.pv_final_assentado,false)
  FROM public.relatorio_producao_diaria v
  WHERE _data_inicial IS NOT NULL AND _data_final IS NOT NULL
    AND _data_final >= _data_inicial
    AND v.data_producao BETWEEN _data_inicial AND _data_final
    AND (_bacia IS NULL OR lower(btrim(v.obra_id)) = lower(btrim(_bacia)))
    AND (_encarregado IS NULL OR v.responsavel_nome ILIKE '%'||btrim(_encarregado)||'%')
  ORDER BY v.data_producao DESC, v.trecho
  LIMIT LEAST(GREATEST(COALESCE(_limit,500),1),2000)
$$;

CREATE OR REPLACE FUNCTION public.assistant_produtividade_encarregado(
  _data_inicial date, _data_final date, _encarregado text DEFAULT NULL)
RETURNS TABLE (responsavel text, rede_m numeric, dias_com_rede integer, produtividade_rede_m_dia numeric,
               ligacoes_qtd integer, ligacoes_comprimento_m numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT v.* FROM public.relatorio_producao_diaria v
    WHERE _data_inicial IS NOT NULL AND _data_final IS NOT NULL AND _data_final >= _data_inicial
      AND v.data_producao BETWEEN _data_inicial AND _data_final
      AND (_encarregado IS NULL OR v.responsavel_nome ILIKE '%'||btrim(_encarregado)||'%')
  ),
  -- ligações deduplicadas: maior comprimento_total_ligacoes por os_id
  lig AS (
    SELECT responsavel_nome, os_id,
           MAX(COALESCE(comprimento_total_ligacoes,0)) AS comp_lig,
           SUM(COALESCE(quantidade_ligacoes_realizadas,0))::int AS qtd_lig
    FROM base GROUP BY responsavel_nome, os_id
  ),
  rede AS (
    SELECT responsavel_nome,
           SUM(COALESCE(comprimento_trecho_executado,0)) AS rede_m,
           COUNT(DISTINCT data_producao) FILTER (WHERE COALESCE(comprimento_trecho_executado,0) > 0)::int AS dias
    FROM base GROUP BY responsavel_nome
  )
  SELECT COALESCE(r.responsavel_nome,'(sem responsável)'),
         ROUND(r.rede_m,2), r.dias,
         CASE WHEN r.dias > 0 THEN ROUND(r.rede_m / r.dias, 2) ELSE 0 END,
         COALESCE((SELECT SUM(qtd_lig) FROM lig l WHERE l.responsavel_nome IS NOT DISTINCT FROM r.responsavel_nome),0)::int,
         COALESCE((SELECT ROUND(SUM(comp_lig),2) FROM lig l WHERE l.responsavel_nome IS NOT DISTINCT FROM r.responsavel_nome),0)
  FROM rede r
  ORDER BY 2 DESC
$$;

CREATE OR REPLACE FUNCTION public.assistant_avanco_por_bacia(_bacia text DEFAULT NULL)
RETURNS TABLE (bacia text, previsto_m numeric, executado_m numeric, pendente_m numeric,
               ns_total integer, ns_concluidas integer, ligacoes_comprimento_m numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH por_os AS (
    SELECT os.id, os.bacia, COALESCE(os.comprimento_previsto,0) AS previsto,
           COALESCE((SELECT SUM(v.comprimento_trecho_executado) FROM public.relatorio_producao_diaria v WHERE v.os_id = os.id),0) AS executado,
           COALESCE((SELECT MAX(v.comprimento_total_ligacoes) FROM public.relatorio_producao_diaria v WHERE v.os_id = os.id),0) AS lig_m,
           COALESCE((SELECT BOOL_OR(v.pv_final_assentado) FROM public.relatorio_producao_diaria v WHERE v.os_id = os.id),false) AS concluida
    FROM public.ordens_servico os
    WHERE _bacia IS NULL OR lower(btrim(os.bacia)) = lower(btrim(_bacia))
  )
  SELECT bacia,
         ROUND(SUM(previsto),2),
         ROUND(SUM(executado),2),
         -- N.S. com PV final assentado não gera pendência
         ROUND(SUM(CASE WHEN concluida THEN 0 ELSE GREATEST(previsto - executado, 0) END),2),
         COUNT(*)::int,
         COUNT(*) FILTER (WHERE concluida)::int,
         ROUND(SUM(lig_m),2)
  FROM por_os GROUP BY bacia ORDER BY bacia
$$;

-- Acesso exclusivo ao serviço interno (Edge Function). Frontend não pode chamar.
REVOKE ALL ON FUNCTION public.assistant_buscar_ns(text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_ns_detalhe(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_producao_periodo(date,date,text,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_produtividade_encarregado(date,date,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_avanco_por_bacia(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assistant_buscar_ns(text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_ns_detalhe(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_producao_periodo(date,date,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_produtividade_encarregado(date,date,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_avanco_por_bacia(text) TO service_role;