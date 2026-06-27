DROP POLICY IF EXISTS owner_update_registros ON public.registros_producao;

CREATE POLICY owner_update_registros
ON public.registros_producao
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND COALESCE(excluido, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.ordens_servico o
    WHERE o.id = registros_producao.os_id
      AND COALESCE(o.real_validado, false) = true
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.ordens_servico o
    WHERE o.id = registros_producao.os_id
      AND COALESCE(o.real_validado, false) = true
  )
);