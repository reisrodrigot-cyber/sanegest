
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Sala tecnica can insert OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Sala tecnica or encarregado can update OS" ON public.ordens_servico;
DROP POLICY IF EXISTS "Sala tecnica can delete OS" ON public.ordens_servico;

-- Temporarily allow all access (will be restricted when real auth is implemented)
CREATE POLICY "Allow all select OS" ON public.ordens_servico FOR SELECT USING (true);
CREATE POLICY "Allow all insert OS" ON public.ordens_servico FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update OS" ON public.ordens_servico FOR UPDATE USING (true);
CREATE POLICY "Allow all delete OS" ON public.ordens_servico FOR DELETE USING (true);

-- Also relax estacas for reading
DROP POLICY IF EXISTS "Authenticated users can view estacas" ON public.estacas;
CREATE POLICY "Allow all select estacas" ON public.estacas FOR SELECT USING (true);
