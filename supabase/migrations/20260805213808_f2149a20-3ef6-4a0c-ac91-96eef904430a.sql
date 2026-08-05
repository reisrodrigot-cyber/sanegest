CREATE TABLE public.quantitativos_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bacia_chave text NOT NULL UNIQUE,
  bacia_exibicao text NOT NULL,
  rede_prevista_metros numeric NOT NULL DEFAULT 0 CHECK (rede_prevista_metros >= 0),
  ramais_previstos_unidades integer NOT NULL DEFAULT 0 CHECK (ramais_previstos_unidades >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quantitativos_referencia TO authenticated;
GRANT ALL ON public.quantitativos_referencia TO service_role;

ALTER TABLE public.quantitativos_referencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler quantitativos"
  ON public.quantitativos_referencia FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin e sala tecnica inserem quantitativos"
  ON public.quantitativos_referencia FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'sala_tecnica'::app_role));

CREATE POLICY "Admin e sala tecnica editam quantitativos"
  ON public.quantitativos_referencia FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'sala_tecnica'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'sala_tecnica'::app_role));

CREATE POLICY "Admin e sala tecnica excluem quantitativos"
  ON public.quantitativos_referencia FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'sala_tecnica'::app_role));

CREATE INDEX idx_quantitativos_referencia_bacia_chave ON public.quantitativos_referencia (bacia_chave);

CREATE TRIGGER trg_quantitativos_referencia_updated
  BEFORE UPDATE ON public.quantitativos_referencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();