-- Keep legacy release assignees for historical reference, not authorization.
COMMENT ON COLUMN public.os_liberacao_pavimentacao.liberado_para_user_id IS 'DEPRECATED: historical assignee only; active releases are shared by all paving foremen.';
CREATE OR REPLACE FUNCTION public.liberar_pavimentacao(_os_id uuid, _encarregado_user_id uuid DEFAULT NULL, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_os public.ordens_servico%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'sala_tecnica') THEN RAISE EXCEPTION 'Somente a Sala Técnica pode liberar pavimentação' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = _os_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'N.S. inexistente'; END IF;
  IF NOT public.pav_elegivel_os(v_os.pav_previsto, v_os.pav_real) THEN RAISE EXCEPTION 'Sem Asfalto ou Paralelepípedo no pavimento previsto ou executado — não pode ser liberado.'; END IF;
  INSERT INTO public.os_liberacao_pavimentacao (os_id, liberado, liberado_em, revogado_em, motivo)
  VALUES (_os_id, true, now(), NULL, _motivo)
  ON CONFLICT (os_id) DO UPDATE SET liberado = true, liberado_em = now(), revogado_em = NULL, motivo = EXCLUDED.motivo;
  RETURN jsonb_build_object('os_id', _os_id, 'liberado', true);
END $$;
CREATE OR REPLACE FUNCTION public.revogar_liberacao_pavimentacao(_os_id uuid, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'sala_tecnica') THEN RAISE EXCEPTION 'Somente a Sala Técnica pode retirar liberação de pavimentação' USING ERRCODE = '42501'; END IF;
  UPDATE public.os_liberacao_pavimentacao SET liberado = false, revogado_em = now(), motivo = COALESCE(_motivo, motivo) WHERE os_id = _os_id;
  RETURN jsonb_build_object('os_id', _os_id, 'liberado', false);
END $$;
CREATE OR REPLACE FUNCTION public.pavimentacao_minhas_ns(_user_id uuid DEFAULT NULL)
RETURNS TABLE(os_id uuid, trecho text, sub_bacia text, pv_montante text, pv_jusante text, comprimento_previsto numeric, pav_previsto text, liberado boolean, area_prevista_m2 numeric, area_realizada_m2 numeric, concluido boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT os.id, os.trecho, os.bacia, os.pv_montante, os.pv_jusante, os.comprimento_previsto, os.pav_previsto, l.liberado,
 public.pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto),
 COALESCE((SELECT SUM(r.area_m2) FROM public.registros_pavimentacao r WHERE r.os_id = os.id AND r.excluido = false AND r.status = 'ativo'), 0), COALESCE(c.concluido, false)
 FROM public.os_liberacao_pavimentacao l JOIN public.ordens_servico os ON os.id = l.os_id
 LEFT JOIN public.os_pavimentacao_conclusao c ON c.os_id = os.id
 WHERE l.liberado = true AND (public.has_role(auth.uid(), 'encarregado_pavimentacao') OR public.pode_gerir_pavimentacao(auth.uid()))
 ORDER BY os.bacia, os.trecho
$$;
DROP POLICY IF EXISTS regpav_insert ON public.registros_pavimentacao;
CREATE POLICY regpav_insert ON public.registros_pavimentacao FOR INSERT TO authenticated WITH CHECK (
 EXISTS (SELECT 1 FROM public.os_liberacao_pavimentacao l WHERE l.os_id = registros_pavimentacao.os_id AND l.liberado)
 AND ((public.has_role(auth.uid(), 'encarregado_pavimentacao') AND user_id = auth.uid() AND responsavel_user_id = auth.uid())
 OR (public.pode_gerir_pavimentacao(auth.uid()) AND public.has_role(responsavel_user_id, 'encarregado_pavimentacao')))
);
DROP POLICY IF EXISTS regpav_select ON public.registros_pavimentacao;
CREATE POLICY regpav_select ON public.registros_pavimentacao FOR SELECT TO authenticated USING (
 user_id = auth.uid() OR public.pode_gerir_pavimentacao(auth.uid()) OR public.has_role(auth.uid(), 'gerencia')
);
DROP POLICY IF EXISTS regpav_update ON public.registros_pavimentacao;
CREATE POLICY regpav_update ON public.registros_pavimentacao FOR UPDATE TO authenticated USING (
 (user_id = auth.uid() AND NOT excluido AND status = 'ativo') OR public.pode_gerir_pavimentacao(auth.uid())
) WITH CHECK (user_id = auth.uid() OR public.pode_gerir_pavimentacao(auth.uid()));
-- Serialize inserts against revocation and protect the immutable identity of own records.
CREATE OR REPLACE FUNCTION public.tg_pav_shared_release_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_liberado boolean;
BEGIN
 IF TG_OP = 'INSERT' THEN
   SELECT liberado INTO v_liberado FROM public.os_liberacao_pavimentacao WHERE os_id = NEW.os_id FOR SHARE;
   IF v_liberado IS DISTINCT FROM true THEN RAISE EXCEPTION 'N.S. sem liberação de pavimentação ativa' USING ERRCODE = '42501'; END IF;
 ELSIF NOT public.pode_gerir_pavimentacao(auth.uid()) AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.responsavel_user_id IS DISTINCT FROM OLD.responsavel_user_id OR NEW.os_id IS DISTINCT FROM OLD.os_id) THEN
   RAISE EXCEPTION 'Não é permitido alterar autor, responsável ou N.S. do próprio registro' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_pav_shared_release_guard BEFORE INSERT OR UPDATE ON public.registros_pavimentacao FOR EACH ROW EXECUTE FUNCTION public.tg_pav_shared_release_guard();
CREATE OR REPLACE FUNCTION public.finalizar_pavimentacao(_os_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT (public.pode_gerir_pavimentacao(auth.uid()) OR (public.has_role(auth.uid(), 'encarregado_pavimentacao') AND EXISTS (SELECT 1 FROM public.os_liberacao_pavimentacao WHERE os_id = _os_id AND liberado))) THEN RAISE EXCEPTION 'Sem permissão para finalizar a pavimentação deste trecho' USING ERRCODE = '42501'; END IF;
 INSERT INTO public.os_pavimentacao_conclusao (os_id, concluido, concluido_por, concluido_em) VALUES (_os_id, true, auth.uid(), now())
 ON CONFLICT (os_id) DO UPDATE SET concluido = true, concluido_por = auth.uid(), concluido_em = now(), motivo_reabertura = NULL;
 RETURN jsonb_build_object('os_id', _os_id, 'concluido', true);
END $$;
CREATE OR REPLACE FUNCTION public.reabrir_pavimentacao(_os_id uuid, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT (public.pode_gerir_pavimentacao(auth.uid()) OR (public.has_role(auth.uid(), 'encarregado_pavimentacao') AND EXISTS (SELECT 1 FROM public.os_liberacao_pavimentacao WHERE os_id = _os_id AND liberado))) THEN RAISE EXCEPTION 'Sem permissão para reabrir a pavimentação deste trecho' USING ERRCODE = '42501'; END IF;
 UPDATE public.os_pavimentacao_conclusao SET concluido = false, motivo_reabertura = _motivo, concluido_em = NULL, concluido_por = NULL WHERE os_id = _os_id;
 RETURN jsonb_build_object('os_id', _os_id, 'concluido', false);
END $$;
REVOKE ALL ON FUNCTION public.liberar_pavimentacao(uuid,uuid,text), public.revogar_liberacao_pavimentacao(uuid,text), public.pavimentacao_minhas_ns(uuid), public.finalizar_pavimentacao(uuid), public.reabrir_pavimentacao(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_pavimentacao(uuid,uuid,text), public.revogar_liberacao_pavimentacao(uuid,text), public.pavimentacao_minhas_ns(uuid), public.finalizar_pavimentacao(uuid), public.reabrir_pavimentacao(uuid,text) TO authenticated;
