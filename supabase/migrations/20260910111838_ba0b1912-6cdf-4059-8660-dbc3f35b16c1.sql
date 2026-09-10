-- 1. Coluna de responsável
ALTER TABLE public.registros_pavimentacao
  ADD COLUMN IF NOT EXISTS responsavel_user_id uuid;

-- 2. Backfill obrigatório
UPDATE public.registros_pavimentacao
   SET responsavel_user_id = user_id
 WHERE responsavel_user_id IS NULL;

-- FK para o usuário
ALTER TABLE public.registros_pavimentacao
  DROP CONSTRAINT IF EXISTS registros_pavimentacao_responsavel_fk;
ALTER TABLE public.registros_pavimentacao
  ADD CONSTRAINT registros_pavimentacao_responsavel_fk
  FOREIGN KEY (responsavel_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Preenchimento automático quando não informado
CREATE OR REPLACE FUNCTION public.tg_pav_default_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.responsavel_user_id IS NULL THEN
    NEW.responsavel_user_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pav_default_responsavel ON public.registros_pavimentacao;
CREATE TRIGGER trg_pav_default_responsavel
  BEFORE INSERT OR UPDATE ON public.registros_pavimentacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_pav_default_responsavel();

ALTER TABLE public.registros_pavimentacao
  ALTER COLUMN responsavel_user_id SET NOT NULL;

-- 3. Índice
CREATE INDEX IF NOT EXISTS idx_regpav_responsavel_data
  ON public.registros_pavimentacao (responsavel_user_id, data_registro DESC);

-- 4. RLS
DROP POLICY IF EXISTS regpav_insert ON public.registros_pavimentacao;
CREATE POLICY regpav_insert ON public.registros_pavimentacao
FOR INSERT TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND responsavel_user_id = auth.uid()
    AND has_role(auth.uid(), 'encarregado_pavimentacao'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.os_liberacao_pavimentacao l
       WHERE l.os_id = registros_pavimentacao.os_id
         AND l.liberado = true
         AND l.liberado_para_user_id = auth.uid()
    )
  )
  OR (
    pode_gerir_pavimentacao(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.os_liberacao_pavimentacao l
       WHERE l.os_id = registros_pavimentacao.os_id
         AND l.liberado = true
         AND l.liberado_para_user_id = registros_pavimentacao.responsavel_user_id
    )
  )
);

DROP POLICY IF EXISTS regpav_select ON public.registros_pavimentacao;
CREATE POLICY regpav_select ON public.registros_pavimentacao
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR responsavel_user_id = auth.uid()
  OR pode_gerir_pavimentacao(auth.uid())
  OR has_role(auth.uid(), 'gerencia'::app_role)
);

DROP POLICY IF EXISTS regpav_update ON public.registros_pavimentacao;
CREATE POLICY regpav_update ON public.registros_pavimentacao
FOR UPDATE TO authenticated
USING (
  (((user_id = auth.uid()) OR (responsavel_user_id = auth.uid()))
    AND excluido = false AND status = 'ativo')
  OR pode_gerir_pavimentacao(auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR responsavel_user_id = auth.uid()
  OR pode_gerir_pavimentacao(auth.uid())
);

-- 5. Relatório diário por responsável
DROP VIEW IF EXISTS public.relatorio_pavimentacao_diaria;
CREATE VIEW public.relatorio_pavimentacao_diaria
WITH (security_invoker = true) AS
SELECT r.id,
    r.data_registro,
    r.os_id,
    os.trecho,
    os.bacia AS sub_bacia,
    r.user_id AS autor_user_id,
    resp.uid AS responsavel_user_id,
    COALESCE(NULLIF(p.apelido, ''), NULLIF(p.display_name, ''), p.email, 'Encarregado não definido') AS responsavel_nome,
    r.comprimento_m,
    r.largura_m,
    r.area_m2,
    r.observacao,
    pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto) AS area_prevista_m2,
    acc.area_realizada_m2,
    CASE
        WHEN pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto) IS NULL THEN NULL::numeric
        ELSE GREATEST(pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto) - acc.area_realizada_m2, 0::numeric)
    END AS saldo_m2,
    CASE
        WHEN COALESCE(pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto), 0::numeric) > 0::numeric
          THEN round(acc.area_realizada_m2 * 100::numeric / pav_area_prevista(os.comprimento_previsto, os.largura_vala, os.pav_previsto), 2)
        ELSE NULL::numeric
    END AS percentual_executado,
    COALESCE(c.concluido, false) AS pavimentacao_finalizada
   FROM registros_pavimentacao r
     JOIN ordens_servico os ON os.id = r.os_id
     LEFT JOIN os_liberacao_pavimentacao l ON l.os_id = r.os_id AND l.liberado = true
     LEFT JOIN LATERAL (SELECT COALESCE(r.responsavel_user_id, l.liberado_para_user_id) AS uid) resp ON true
     LEFT JOIN profiles p ON p.user_id = resp.uid
     LEFT JOIN os_pavimentacao_conclusao c ON c.os_id = r.os_id
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(r2.area_m2), 0::numeric) AS area_realizada_m2
           FROM registros_pavimentacao r2
          WHERE r2.os_id = r.os_id AND r2.excluido = false AND r2.status = 'ativo') acc ON true
  WHERE r.excluido = false AND r.status = 'ativo';

GRANT SELECT ON public.relatorio_pavimentacao_diaria TO authenticated;