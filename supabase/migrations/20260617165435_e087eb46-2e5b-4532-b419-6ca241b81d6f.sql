
-- 1. Coluna de vigência em ordens_servico
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS status_vigencia text NOT NULL DEFAULT 'ATIVO'
  CHECK (status_vigencia IN ('ATIVO','SUPRIMIDO'));

-- 2. Tabela de revisões
CREATE TABLE IF NOT EXISTS public.os_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  rotulo text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_log_id uuid REFERENCES public.import_logs(id) ON DELETE SET NULL,
  user_id uuid,
  suprimido boolean NOT NULL DEFAULT false,

  -- snapshot dos campos projetados
  bacia text,
  comprimento_previsto numeric,
  largura_vala numeric,
  prof_media_prevista numeric,
  dn numeric,
  prof_montante numeric,
  prof_jusante numeric,
  pav_previsto text,
  largura_pav_prevista numeric,
  pav_m2_previsto numeric,
  areia text,
  brita text,
  ligacoes_previstas integer,
  bomba_rebaixo boolean,
  prazo_previsto integer,
  prazo_arredondado integer,
  bms text,

  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (os_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_os_revisoes_os_id ON public.os_revisoes(os_id);

GRANT SELECT, INSERT ON public.os_revisoes TO authenticated;
GRANT ALL ON public.os_revisoes TO service_role;

ALTER TABLE public.os_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler revisoes"
  ON public.os_revisoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sala tecnica, gerencia e admin podem inserir revisoes"
  ON public.os_revisoes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerencia')
    OR public.has_role(auth.uid(), 'sala_tecnica')
  );

-- 3. Backfill: cria "Projeto Base" para todas as OS existentes que ainda não têm
INSERT INTO public.os_revisoes (
  os_id, versao, rotulo, imported_at,
  bacia, comprimento_previsto, largura_vala, prof_media_prevista,
  dn, prof_montante, prof_jusante,
  pav_previsto, largura_pav_prevista, pav_m2_previsto,
  areia, brita, ligacoes_previstas, bomba_rebaixo,
  prazo_previsto, prazo_arredondado, bms
)
SELECT
  o.id, 0, 'Projeto Base', COALESCE(o.created_at, now()),
  o.bacia, o.comprimento_previsto, o.largura_vala, o.prof_media_prevista,
  o.dn, o.prof_montante, o.prof_jusante,
  o.pav_previsto, o.largura_pav_prevista, o.pav_m2_previsto,
  o.areia, o.brita, o.ligacoes_previstas, o.bomba_rebaixo,
  o.prazo_previsto, o.prazo_arredondado, o.bms
FROM public.ordens_servico o
LEFT JOIN public.os_revisoes r ON r.os_id = o.id AND r.versao = 0
WHERE r.id IS NULL;
