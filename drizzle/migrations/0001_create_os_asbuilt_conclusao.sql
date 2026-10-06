CREATE TABLE public.os_asbuilt_conclusao (
  os_id uuid PRIMARY KEY REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  concluido boolean NOT NULL DEFAULT true,
  concluido_por uuid,
  concluido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.os_asbuilt_conclusao TO authenticated;
GRANT ALL ON public.os_asbuilt_conclusao TO service_role;
ALTER TABLE public.os_asbuilt_conclusao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asbuilt conclusao select" ON public.os_asbuilt_conclusao FOR SELECT TO authenticated USING (true);
CREATE POLICY "asbuilt conclusao insert" ON public.os_asbuilt_conclusao FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sala_tecnica') OR public.has_role(auth.uid(),'topografo'));
CREATE POLICY "asbuilt conclusao update" ON public.os_asbuilt_conclusao FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sala_tecnica') OR public.has_role(auth.uid(),'topografo'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'sala_tecnica') OR public.has_role(auth.uid(),'topografo'));
CREATE TRIGGER trg_os_asbuilt_conclusao_updated BEFORE UPDATE ON public.os_asbuilt_conclusao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();