-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.pav_normalizar(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(lower(btrim(COALESCE(_t,''))),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')
$$;

-- Elegibilidade: precisa conter paralelepipedo ou asfalto
CREATE OR REPLACE FUNCTION public.pav_elegivel(_pav text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.pav_normalizar(_pav) LIKE '%paralelepipedo%'
      OR public.pav_normalizar(_pav) LIKE '%asfalto%'
$$;

-- Área prevista: comprimento x largura, dividido pela qtd de tipos em pav_previsto
CREATE OR REPLACE FUNCTION public.pav_area_prevista(_comprimento numeric, _largura numeric, _pav text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _comprimento IS NULL OR _largura IS NULL
      OR _comprimento <= 0 OR _largura <= 0
      OR NOT public.pav_elegivel(_pav) THEN NULL
    ELSE ROUND((_comprimento * _largura) /
      GREATEST(array_length(string_to_array(public.pav_normalizar(_pav), '/'), 1), 1), 2)
  END
$$;

CREATE OR REPLACE FUNCTION public.pode_gerir_pavimentacao(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'sala_tecnica'::app_role)
$$;

-- ============ Liberação ============
CREATE TABLE public.os_liberacao_pavimentacao (
  os_id uuid PRIMARY KEY REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  liberado boolean NOT NULL DEFAULT false,
  liberado_para_user_id uuid,
  liberado_em timestamptz,
  revogado_em timestamptz,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.os_liberacao_pavimentacao TO authenticated;
GRANT ALL ON public.os_liberacao_pavimentacao TO service_role;
ALTER TABLE public.os_liberacao_pavimentacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "libpav_select_auth" ON public.os_liberacao_pavimentacao
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_libpav_updated BEFORE UPDATE ON public.os_liberacao_pavimentacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Conclusão ============
CREATE TABLE public.os_pavimentacao_conclusao (
  os_id uuid PRIMARY KEY REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  concluido boolean NOT NULL DEFAULT false,
  concluido_por uuid,
  concluido_em timestamptz,
  motivo_reabertura text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.os_pavimentacao_conclusao TO authenticated;
GRANT ALL ON public.os_pavimentacao_conclusao TO service_role;
ALTER TABLE public.os_pavimentacao_conclusao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "concpav_select_auth" ON public.os_pavimentacao_conclusao
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_concpav_updated BEFORE UPDATE ON public.os_pavimentacao_conclusao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Registros ============
CREATE TABLE public.registros_pavimentacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  data_registro date NOT NULL,
  comprimento_m numeric NOT NULL DEFAULT 0,
  largura_m numeric NOT NULL DEFAULT 0,
  area_m2 numeric GENERATED ALWAYS AS (comprimento_m * largura_m) STORED,
  observacao text,
  status text NOT NULL DEFAULT 'ativo',
  excluido boolean NOT NULL DEFAULT false,
  excluido_em timestamptz,
  excluido_por uuid,
  data_retroativa_confirmada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_regpav_os_data ON public.registros_pavimentacao (os_id, data_registro);
CREATE INDEX idx_regpav_user_data ON public.registros_pavimentacao (user_id, data_registro);
GRANT SELECT, INSERT, UPDATE ON public.registros_pavimentacao TO authenticated;
GRANT ALL ON public.registros_pavimentacao TO service_role;
ALTER TABLE public.registros_pavimentacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regpav_select" ON public.registros_pavimentacao
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.pode_gerir_pavimentacao(auth.uid())
    OR public.has_role(auth.uid(), 'gerencia'::app_role)
  );

CREATE POLICY "regpav_insert" ON public.registros_pavimentacao
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND public.has_role(auth.uid(), 'encarregado_pavimentacao'::app_role))
    OR public.pode_gerir_pavimentacao(auth.uid())
  );

CREATE POLICY "regpav_update" ON public.registros_pavimentacao
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND excluido = false AND status = 'ativo')
    OR public.pode_gerir_pavimentacao(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid() OR public.pode_gerir_pavimentacao(auth.uid())
  );

CREATE TRIGGER trg_regpav_updated BEFORE UPDATE ON public.registros_pavimentacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validação de data (nunca futura; retroativo exige confirmação)
CREATE OR REPLACE FUNCTION public.tg_validate_data_pavimentacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_hoje date := (now() AT TIME ZONE 'America/Maceio')::date;
BEGIN
  IF NEW.data_registro IS NULL THEN NEW.data_registro := v_hoje; END IF;
  IF NEW.data_registro > v_hoje THEN
    RAISE EXCEPTION 'Data da produção não pode ser futura (hoje: %)', to_char(v_hoje,'DD/MM/YYYY');
  END IF;
  IF NEW.data_registro <> v_hoje AND COALESCE(NEW.data_retroativa_confirmada,false) = false THEN
    RAISE EXCEPTION 'Lançamento retroativo exige confirmação explícita da data de produção';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_data_pavimentacao BEFORE INSERT OR UPDATE ON public.registros_pavimentacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_data_pavimentacao();

-- Auditoria de retroativo
CREATE OR REPLACE FUNCTION public.tg_audit_pav_retroativa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hoje date := (now() AT TIME ZONE 'America/Maceio')::date;
BEGIN
  IF NEW.data_registro <> v_hoje THEN
    INSERT INTO public.registros_producao_auditoria
      (registro_producao_id, usuario_id, acao, valor_anterior, valor_novo)
    VALUES (NEW.id, NEW.user_id, 'pavimentacao_lancamento_retroativo',
      jsonb_build_object('data_digitacao', v_hoje),
      jsonb_build_object('data_producao', NEW.data_registro, 'os_id', NEW.os_id, 'user_id', NEW.user_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_audit_pav_retroativa AFTER INSERT ON public.registros_pavimentacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pav_retroativa();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.liberar_pavimentacao(_os_id uuid, _encarregado_user_id uuid, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pav text;
BEGIN
  IF NOT public.pode_gerir_pavimentacao(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para liberar pavimentação';
  END IF;
  SELECT pav_previsto INTO v_pav FROM public.ordens_servico WHERE id = _os_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'N.S. inexistente'; END IF;
  IF NOT public.pav_elegivel(v_pav) THEN
    RAISE EXCEPTION 'N.S. não elegível para pavimentação (pavimento previsto: %)', COALESCE(v_pav,'—');
  END IF;

  INSERT INTO public.os_liberacao_pavimentacao (os_id, liberado, liberado_para_user_id, liberado_em, revogado_em, motivo)
  VALUES (_os_id, true, _encarregado_user_id, now(), NULL, _motivo)
  ON CONFLICT (os_id) DO UPDATE
    SET liberado = true, liberado_para_user_id = EXCLUDED.liberado_para_user_id,
        liberado_em = now(), revogado_em = NULL, motivo = EXCLUDED.motivo;

  RETURN jsonb_build_object('os_id', _os_id, 'liberado', true);
END $$;

CREATE OR REPLACE FUNCTION public.revogar_liberacao_pavimentacao(_os_id uuid, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.pode_gerir_pavimentacao(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para retirar liberação de pavimentação';
  END IF;
  UPDATE public.os_liberacao_pavimentacao
     SET liberado = false, revogado_em = now(), motivo = COALESCE(_motivo, motivo)
   WHERE os_id = _os_id;
  RETURN jsonb_build_object('os_id', _os_id, 'liberado', false);
END $$;

CREATE OR REPLACE FUNCTION public.finalizar_pavimentacao(_os_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.pode_gerir_pavimentacao(auth.uid())
      OR EXISTS (SELECT 1 FROM public.os_liberacao_pavimentacao l
                  WHERE l.os_id = _os_id AND l.liberado = true
                    AND l.liberado_para_user_id = auth.uid())
  INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Sem permissão para finalizar a pavimentação deste trecho'; END IF;

  INSERT INTO public.os_pavimentacao_conclusao (os_id, concluido, concluido_por, concluido_em)
  VALUES (_os_id, true, auth.uid(), now())
  ON CONFLICT (os_id) DO UPDATE
    SET concluido = true, concluido_por = auth.uid(), concluido_em = now(), motivo_reabertura = NULL;
  RETURN jsonb_build_object('os_id', _os_id, 'concluido', true);
END $$;

CREATE OR REPLACE FUNCTION public.reabrir_pavimentacao(_os_id uuid, _motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT public.pode_gerir_pavimentacao(auth.uid())
      OR EXISTS (SELECT 1 FROM public.os_liberacao_pavimentacao l
                  WHERE l.os_id = _os_id AND l.liberado = true
                    AND l.liberado_para_user_id = auth.uid())
  INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Sem permissão para reabrir a pavimentação deste trecho'; END IF;

  UPDATE public.os_pavimentacao_conclusao
     SET concluido = false, motivo_reabertura = _motivo, concluido_em = NULL, concluido_por = NULL
   WHERE os_id = _os_id;
  RETURN jsonb_build_object('os_id', _os_id, 'concluido', false);
END $$;

-- Lista restrita de N.S. para a tela mobile (sem campos técnicos de rede)
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
      l.liberado_para_user_id = COALESCE(_user_id, auth.uid())
      OR public.pode_gerir_pavimentacao(auth.uid())
    )
  ORDER BY os.bacia, os.trecho
$$;

-- ============ View do dashboard ============
CREATE VIEW public.relatorio_pavimentacao_diaria
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.data_registro,
  r.os_id,
  os.trecho,
  os.bacia AS sub_bacia,
  r.user_id AS responsavel_user_id,
  COALESCE(NULLIF(p.apelido,''), NULLIF(p.display_name,''), p.email, '(sem responsável)') AS responsavel_nome,
  r.comprimento_m,
  r.largura_m,
  r.area_m2,
  r.observacao,
  public.pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto) AS area_prevista_m2,
  acc.area_realizada_m2,
  CASE WHEN public.pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto) IS NULL THEN NULL
       ELSE GREATEST(public.pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto) - acc.area_realizada_m2, 0) END AS saldo_m2,
  CASE WHEN COALESCE(public.pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto),0) > 0
       THEN ROUND(acc.area_realizada_m2 * 100 / public.pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto), 2)
       ELSE NULL END AS percentual_executado,
  COALESCE(c.concluido,false) AS pavimentacao_finalizada
FROM public.registros_pavimentacao r
JOIN public.ordens_servico os ON os.id = r.os_id
LEFT JOIN public.profiles p ON p.user_id = r.user_id
LEFT JOIN public.os_pavimentacao_conclusao c ON c.os_id = r.os_id
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(r2.area_m2),0) AS area_realizada_m2
  FROM public.registros_pavimentacao r2
  WHERE r2.os_id = r.os_id AND r2.excluido = false AND r2.status = 'ativo'
) acc ON true
WHERE r.excluido = false AND r.status = 'ativo';

GRANT SELECT ON public.relatorio_pavimentacao_diaria TO authenticated;

-- Restringe execução das novas funções a usuários autenticados
REVOKE EXECUTE ON FUNCTION public.liberar_pavimentacao(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revogar_liberacao_pavimentacao(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalizar_pavimentacao(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reabrir_pavimentacao(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pavimentacao_minhas_ns(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_gerir_pavimentacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_pavimentacao(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_liberacao_pavimentacao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_pavimentacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_pavimentacao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pavimentacao_minhas_ns(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_gerir_pavimentacao(uuid) TO authenticated;