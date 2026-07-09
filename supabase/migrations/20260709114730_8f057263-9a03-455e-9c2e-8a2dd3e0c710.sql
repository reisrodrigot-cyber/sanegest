-- Permitir que sala técnica/gerência/admin insiram ligações (para ajustes em registros)
DROP POLICY IF EXISTS enc_insert_ligacoes ON public.ligacoes;
CREATE POLICY insert_ligacoes ON public.ligacoes
  FOR INSERT
  WITH CHECK (
    auth.uid() = encarregado_id
    OR has_role(auth.uid(), 'sala_tecnica'::app_role)
    OR has_role(auth.uid(), 'gerencia'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Permitir também que gerência exclua ligações (para redução de quantidade em ajustes)
DROP POLICY IF EXISTS delete_ligacoes ON public.ligacoes;
CREATE POLICY delete_ligacoes ON public.ligacoes
  FOR DELETE
  USING (
    auth.uid() = encarregado_id
    OR has_role(auth.uid(), 'sala_tecnica'::app_role)
    OR has_role(auth.uid(), 'gerencia'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );