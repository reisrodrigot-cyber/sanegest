-- Storage bucket para KMZ
INSERT INTO storage.buckets (id, name, public)
VALUES ('mapa-kmz', 'mapa-kmz', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: leitura pública, escrita só Sala Técnica/Admin
CREATE POLICY "KMZ public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'mapa-kmz');

CREATE POLICY "KMZ sala_tecnica insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mapa-kmz'
  AND (public.has_role(auth.uid(), 'sala_tecnica'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "KMZ sala_tecnica update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'mapa-kmz'
  AND (public.has_role(auth.uid(), 'sala_tecnica'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "KMZ sala_tecnica delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mapa-kmz'
  AND (public.has_role(auth.uid(), 'sala_tecnica'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- Tabela de camadas do mapa (metadados das KMZ)
CREATE TABLE public.mapa_camadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  opacidade NUMERIC NOT NULL DEFAULT 0.7 CHECK (opacidade >= 0.3 AND opacidade <= 1),
  storage_path TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  visivel_default BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mapa_camadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Camadas: todos autenticados leem"
ON public.mapa_camadas FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Camadas: sala_tecnica insere"
ON public.mapa_camadas FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Camadas: sala_tecnica edita"
ON public.mapa_camadas FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Camadas: sala_tecnica exclui"
ON public.mapa_camadas FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER update_mapa_camadas_updated_at
BEFORE UPDATE ON public.mapa_camadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mapa_camadas;