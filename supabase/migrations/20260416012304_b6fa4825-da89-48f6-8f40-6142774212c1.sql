
-- materiais_entrega: drop restrictive policies, add permissive ones
DROP POLICY IF EXISTS "Authenticated users can view materiais" ON public.materiais_entrega;
DROP POLICY IF EXISTS "Almoxarifado or sala tecnica can insert materiais" ON public.materiais_entrega;
DROP POLICY IF EXISTS "Almoxarifado or sala tecnica can update materiais" ON public.materiais_entrega;
DROP POLICY IF EXISTS "Sala tecnica can delete materiais" ON public.materiais_entrega;

CREATE POLICY "Allow all select materiais" ON public.materiais_entrega FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert materiais" ON public.materiais_entrega FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update materiais" ON public.materiais_entrega FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete materiais" ON public.materiais_entrega FOR DELETE TO public USING (true);

-- estacas: drop restrictive policies, add permissive ones
DROP POLICY IF EXISTS "Sala tecnica can insert estacas" ON public.estacas;
DROP POLICY IF EXISTS "Sala tecnica can update estacas" ON public.estacas;
DROP POLICY IF EXISTS "Sala tecnica can delete estacas" ON public.estacas;
DROP POLICY IF EXISTS "Allow all select estacas" ON public.estacas;

CREATE POLICY "Allow all select estacas" ON public.estacas FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert estacas" ON public.estacas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update estacas" ON public.estacas FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete estacas" ON public.estacas FOR DELETE TO public USING (true);

-- topografia_asbuilt: drop restrictive policies, add permissive ones
DROP POLICY IF EXISTS "Authenticated users can view topografia" ON public.topografia_asbuilt;
DROP POLICY IF EXISTS "Topografo or sala tecnica can insert topografia" ON public.topografia_asbuilt;
DROP POLICY IF EXISTS "Topografo or sala tecnica can update topografia" ON public.topografia_asbuilt;

CREATE POLICY "Allow all select topografia" ON public.topografia_asbuilt FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert topografia" ON public.topografia_asbuilt FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update topografia" ON public.topografia_asbuilt FOR UPDATE TO public USING (true);
CREATE POLICY "Allow all delete topografia" ON public.topografia_asbuilt FOR DELETE TO public USING (true);
