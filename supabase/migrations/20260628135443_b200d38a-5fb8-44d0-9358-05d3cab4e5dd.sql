
-- 1. Novos campos
ALTER TABLE public.registros_producao
  ADD COLUMN IF NOT EXISTS comprimento_ajustado numeric,
  ADD COLUMN IF NOT EXISTS ligacoes_ajustadas integer,
  ADD COLUMN IF NOT EXISTS ajustado_por uuid,
  ADD COLUMN IF NOT EXISTS ajustado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_ajuste text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS cancelado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registros_producao_status_chk') THEN
    ALTER TABLE public.registros_producao
      ADD CONSTRAINT registros_producao_status_chk CHECK (status IN ('ativo','cancelado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registros_producao_os_ativos
  ON public.registros_producao(os_id)
  WHERE excluido IS NOT TRUE AND status = 'ativo';

-- 2. Nova função de recompute (fonte única de verdade)
CREATE OR REPLACE FUNCTION public.recompute_os_real_from_registros(_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_comp numeric;
  v_lig int;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(comprimento_ajustado, comprimento_dia)), 0),
    COALESCE(SUM(COALESCE(ligacoes_ajustadas,   ligacoes_dia)),   0)
  INTO v_comp, v_lig
  FROM public.registros_producao
  WHERE os_id = _os_id
    AND excluido IS NOT TRUE
    AND status = 'ativo';

  UPDATE public.ordens_servico
     SET comprimento_real = CASE WHEN v_comp > 0 THEN v_comp ELSE NULL END,
         ligacoes_real    = CASE WHEN v_lig  > 0 THEN v_lig  ELSE NULL END
   WHERE id = _os_id;
END;
$function$;

-- 3. RLS — substituir policy de UPDATE do owner (sem bloquear por real_validado)
--    e adicionar policy de UPDATE para sala técnica e gerência (ajuste/cancelar/restaurar de qualquer registro).
DROP POLICY IF EXISTS owner_update_registros ON public.registros_producao;

CREATE POLICY owner_update_registros
ON public.registros_producao
FOR UPDATE
USING (
  user_id = auth.uid()
  AND COALESCE(excluido, false) = false
  AND status = 'ativo'
)
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY tecnica_update_registros
ON public.registros_producao
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'gerencia'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'sala_tecnica'::app_role)
  OR public.has_role(auth.uid(), 'gerencia'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Backfill com a nova regra
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.ordens_servico LOOP
    PERFORM public.recompute_os_real_from_registros(r.id);
  END LOOP;
END $$;
