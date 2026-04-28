
CREATE TABLE public.kmz_layer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kmz_layer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Grupos: todos autenticados leem"
  ON public.kmz_layer_groups FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Grupos: sala_tecnica insere"
  ON public.kmz_layer_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sala_tecnica'::public.app_role)
  );

CREATE POLICY "Grupos: sala_tecnica edita"
  ON public.kmz_layer_groups FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sala_tecnica'::public.app_role)
  );

CREATE POLICY "Grupos: sala_tecnica exclui"
  ON public.kmz_layer_groups FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'sala_tecnica'::public.app_role)
  );

CREATE TRIGGER update_kmz_layer_groups_updated_at
  BEFORE UPDATE ON public.kmz_layer_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.mapa_camadas
  ADD COLUMN group_id UUID REFERENCES public.kmz_layer_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_mapa_camadas_group_id ON public.mapa_camadas(group_id);
