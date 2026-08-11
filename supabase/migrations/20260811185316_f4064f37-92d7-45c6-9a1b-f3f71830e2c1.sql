DROP POLICY IF EXISTS auth_insert_registros ON public.registros_producao;
CREATE POLICY auth_insert_registros ON public.registros_producao
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS auth_insert_audit_registros ON public.registros_producao_auditoria;
CREATE POLICY auth_insert_audit_registros ON public.registros_producao_auditoria
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'));