DROP POLICY IF EXISTS owner_update_registros ON public.registros_producao;

CREATE POLICY owner_update_registros
ON public.registros_producao
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND COALESCE(excluido, false) = false
  AND status = 'ativo'
  AND comprimento_ajustado IS NULL
  AND ligacoes_ajustadas IS NULL
  AND ajustado_por IS NULL
  AND cancelado_por IS NULL
)
WITH CHECK (user_id = auth.uid());