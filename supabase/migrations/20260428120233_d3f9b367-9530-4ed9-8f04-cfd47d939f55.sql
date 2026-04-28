
CREATE TABLE public.mapa_asbuilt_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layer_key TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL,
  opacidade NUMERIC NOT NULL DEFAULT 0.9,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.mapa_asbuilt_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asbuilt_config_select_authenticated"
ON public.mapa_asbuilt_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "asbuilt_config_insert_admin_st"
ON public.mapa_asbuilt_config FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sala_tecnica'));

CREATE POLICY "asbuilt_config_update_admin_st"
ON public.mapa_asbuilt_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sala_tecnica'));

INSERT INTO public.mapa_asbuilt_config (layer_key, cor, opacidade) VALUES
  ('rede', '#16a34a', 0.9),
  ('ligacoes', '#2563eb', 0.9);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mapa_asbuilt_config;
