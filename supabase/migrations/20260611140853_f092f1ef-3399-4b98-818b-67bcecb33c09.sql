CREATE TABLE public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  user_id uuid,
  source text NOT NULL DEFAULT 'manual',
  registros_count integer,
  status text NOT NULL,
  error text,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.export_logs TO authenticated;
GRANT ALL ON public.export_logs TO service_role;

ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Sala técnica/Gerência podem ver logs de exportação"
  ON public.export_logs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'sala_tecnica')
    OR public.has_role(auth.uid(), 'gerencia')
  );

CREATE INDEX idx_export_logs_exported_at ON public.export_logs (exported_at DESC);