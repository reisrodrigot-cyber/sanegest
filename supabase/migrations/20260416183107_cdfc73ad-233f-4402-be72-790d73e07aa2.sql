-- ===========================================
-- 1. Tabela de produção diária (registros incrementais)
-- ===========================================
CREATE TABLE public.registros_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  comprimento_dia NUMERIC NOT NULL DEFAULT 0,
  ligacoes_dia INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_registros_producao_os ON public.registros_producao(os_id);
CREATE INDEX idx_registros_producao_user ON public.registros_producao(user_id);
CREATE INDEX idx_registros_producao_data ON public.registros_producao(data_registro);
ALTER TABLE public.registros_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_registros" ON public.registros_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_registros" ON public.registros_producao FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_registros" ON public.registros_producao FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'sala_tecnica') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner_delete_registros" ON public.registros_producao FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'sala_tecnica') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_registros_producao_updated BEFORE UPDATE ON public.registros_producao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 2. Tabela de ligações (uma linha por ligação registrada pelo encarregado, coordenadas pelo topógrafo)
-- ===========================================
CREATE TABLE public.ligacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  registro_producao_id UUID REFERENCES public.registros_producao(id) ON DELETE SET NULL,
  encarregado_id UUID NOT NULL,
  comprimento NUMERIC,
  referencia TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  topografo_id UUID,
  data_topografia TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ligacoes_os ON public.ligacoes(os_id);
CREATE INDEX idx_ligacoes_pendentes ON public.ligacoes(os_id) WHERE latitude IS NULL;
ALTER TABLE public.ligacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_ligacoes" ON public.ligacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "enc_insert_ligacoes" ON public.ligacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = encarregado_id);
CREATE POLICY "edit_ligacoes" ON public.ligacoes FOR UPDATE TO authenticated USING (auth.uid() = encarregado_id OR public.has_role(auth.uid(), 'topografo') OR public.has_role(auth.uid(), 'sala_tecnica') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "delete_ligacoes" ON public.ligacoes FOR DELETE TO authenticated USING (auth.uid() = encarregado_id OR public.has_role(auth.uid(), 'sala_tecnica') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_ligacoes_updated BEFORE UPDATE ON public.ligacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 3. Histórico de alterações de status
-- ===========================================
CREATE TABLE public.os_status_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id UUID,
  status_anterior os_status,
  status_novo os_status NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_hist_os ON public.os_status_historico(os_id);
ALTER TABLE public.os_status_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_status_hist" ON public.os_status_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_status_hist" ON public.os_status_historico FOR INSERT TO authenticated WITH CHECK (true);

-- ===========================================
-- 4. Adicionar user_id em materiais_entrega para rastrear quem cadastrou
-- ===========================================
ALTER TABLE public.materiais_entrega ADD COLUMN IF NOT EXISTS registrado_por UUID;

-- ===========================================
-- 5. Zerar campos REAL existentes (decisão do usuário: começar do zero)
-- ===========================================
UPDATE public.ordens_servico SET
  comprimento_real = NULL,
  prof_media_real = NULL,
  dn_real = NULL,
  largura_vala_real = NULL,
  prof_montante_real = NULL,
  prof_jusante_real = NULL,
  pav_real = NULL,
  largura_pav_real = NULL,
  pav_m2_real = NULL,
  ligacoes_real = NULL,
  areia_real = NULL,
  brita_real = NULL,
  prazo_real = NULL,
  bms_real = NULL,
  executor_real = NULL;