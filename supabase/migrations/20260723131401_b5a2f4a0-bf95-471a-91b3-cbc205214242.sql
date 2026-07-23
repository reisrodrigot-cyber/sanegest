
-- ============ PV OPERACIONAL ============
CREATE TABLE public.mapa_pv_operacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.mapa_bases(id) ON DELETE CASCADE,
  ponto_origem_id uuid REFERENCES public.mapa_pontos(id) ON DELETE SET NULL,
  rotulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('original','movido','manual','suprimido')),
  geom jsonb NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  cota numeric,
  profundidade numeric,
  observacao text,
  motivo text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mapa_pv_op_base_origem_uk
  ON public.mapa_pv_operacional(base_id, ponto_origem_id)
  WHERE ponto_origem_id IS NOT NULL;
CREATE INDEX mapa_pv_op_base_idx ON public.mapa_pv_operacional(base_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_pv_operacional TO authenticated;
GRANT ALL ON public.mapa_pv_operacional TO service_role;
ALTER TABLE public.mapa_pv_operacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_op_select_st_admin_ger" ON public.mapa_pv_operacional
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'sala_tecnica'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'gerencia'::app_role)
  );
CREATE POLICY "pv_op_write_sala_tecnica" ON public.mapa_pv_operacional
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'sala_tecnica'::app_role));
CREATE POLICY "pv_op_update_sala_tecnica" ON public.mapa_pv_operacional
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'sala_tecnica'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'sala_tecnica'::app_role));
CREATE POLICY "pv_op_delete_sala_tecnica" ON public.mapa_pv_operacional
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'sala_tecnica'::app_role));

-- ============ TRECHO OPERACIONAL ============
CREATE TABLE public.mapa_trecho_operacional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.mapa_bases(id) ON DELETE CASCADE,
  trecho_origem_id uuid REFERENCES public.mapa_trechos(id) ON DELETE SET NULL,
  rotulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('original','derivado','manual','suprimido')),
  pv_inicial_id uuid NOT NULL REFERENCES public.mapa_pv_operacional(id) ON DELETE RESTRICT,
  pv_final_id uuid NOT NULL REFERENCES public.mapa_pv_operacional(id) ON DELETE RESTRICT,
  geom jsonb NOT NULL,
  extensao_m numeric,
  dn integer,
  material text,
  motivo text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trecho_op_pvs_distinct CHECK (pv_inicial_id <> pv_final_id)
);
CREATE UNIQUE INDEX mapa_trecho_op_base_origem_uk
  ON public.mapa_trecho_operacional(base_id, trecho_origem_id)
  WHERE trecho_origem_id IS NOT NULL AND tipo IN ('original','suprimido');
CREATE INDEX mapa_trecho_op_base_idx ON public.mapa_trecho_operacional(base_id);
CREATE INDEX mapa_trecho_op_pvi_idx ON public.mapa_trecho_operacional(pv_inicial_id);
CREATE INDEX mapa_trecho_op_pvf_idx ON public.mapa_trecho_operacional(pv_final_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_trecho_operacional TO authenticated;
GRANT ALL ON public.mapa_trecho_operacional TO service_role;
ALTER TABLE public.mapa_trecho_operacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trecho_op_select_st_admin_ger" ON public.mapa_trecho_operacional
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'sala_tecnica'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'gerencia'::app_role)
  );
CREATE POLICY "trecho_op_insert_sala_tecnica" ON public.mapa_trecho_operacional
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'sala_tecnica'::app_role));
CREATE POLICY "trecho_op_update_sala_tecnica" ON public.mapa_trecho_operacional
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'sala_tecnica'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'sala_tecnica'::app_role));
CREATE POLICY "trecho_op_delete_sala_tecnica" ON public.mapa_trecho_operacional
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'sala_tecnica'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_pv_op_updated
  BEFORE UPDATE ON public.mapa_pv_operacional
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_trecho_op_updated
  BEFORE UPDATE ON public.mapa_trecho_operacional
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXTENSÃO mapa_trecho_os ============
ALTER TABLE public.mapa_trecho_os
  ADD COLUMN IF NOT EXISTS trecho_operacional_id uuid
  REFERENCES public.mapa_trecho_operacional(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS mapa_trecho_os_trecho_op_idx
  ON public.mapa_trecho_os(trecho_operacional_id);

-- Permitir Sala Técnica inserir/atualizar/excluir vínculos de trechos operacionais
DROP POLICY IF EXISTS "trecho_os_op_write_sala_tecnica" ON public.mapa_trecho_os;
CREATE POLICY "trecho_os_op_write_sala_tecnica" ON public.mapa_trecho_os
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'sala_tecnica'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'sala_tecnica'::app_role));
