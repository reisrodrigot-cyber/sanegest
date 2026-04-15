
-- Fix ordens_servico policies
DROP POLICY "Authenticated users can insert OS" ON public.ordens_servico;
DROP POLICY "Authenticated users can update OS" ON public.ordens_servico;
DROP POLICY "Authenticated users can delete OS" ON public.ordens_servico;

CREATE POLICY "Sala tecnica can insert OS" ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'sala_tecnica'));

CREATE POLICY "Sala tecnica or encarregado can update OS" ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'sala_tecnica') OR public.has_role(auth.uid(), 'encarregado') OR public.has_role(auth.uid(), 'topografo'));

CREATE POLICY "Sala tecnica can delete OS" ON public.ordens_servico FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'sala_tecnica'));

-- Fix estacas policies
DROP POLICY "Authenticated users can insert estacas" ON public.estacas;
DROP POLICY "Authenticated users can update estacas" ON public.estacas;
DROP POLICY "Authenticated users can delete estacas" ON public.estacas;

CREATE POLICY "Sala tecnica can insert estacas" ON public.estacas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'sala_tecnica'));

CREATE POLICY "Sala tecnica can update estacas" ON public.estacas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'sala_tecnica'));

CREATE POLICY "Sala tecnica can delete estacas" ON public.estacas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'sala_tecnica'));

-- Fix materiais_entrega policies
DROP POLICY "Authenticated users can insert materiais" ON public.materiais_entrega;
DROP POLICY "Authenticated users can update materiais" ON public.materiais_entrega;
DROP POLICY "Authenticated users can delete materiais" ON public.materiais_entrega;

CREATE POLICY "Almoxarifado or sala tecnica can insert materiais" ON public.materiais_entrega FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'almoxarifado') OR public.has_role(auth.uid(), 'sala_tecnica'));

CREATE POLICY "Almoxarifado or sala tecnica can update materiais" ON public.materiais_entrega FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'almoxarifado') OR public.has_role(auth.uid(), 'sala_tecnica'));

CREATE POLICY "Sala tecnica can delete materiais" ON public.materiais_entrega FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'sala_tecnica'));

-- Fix topografia_asbuilt policies
DROP POLICY "Authenticated users can insert topografia" ON public.topografia_asbuilt;
DROP POLICY "Authenticated users can update topografia" ON public.topografia_asbuilt;

CREATE POLICY "Topografo or sala tecnica can insert topografia" ON public.topografia_asbuilt FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'topografo') OR public.has_role(auth.uid(), 'sala_tecnica'));

CREATE POLICY "Topografo or sala tecnica can update topografia" ON public.topografia_asbuilt FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'topografo') OR public.has_role(auth.uid(), 'sala_tecnica'));
