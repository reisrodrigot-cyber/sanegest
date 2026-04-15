
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('gerencia', 'sala_tecnica', 'almoxarifado', 'encarregado', 'topografo');

-- Create OS status enum
CREATE TYPE public.os_status AS ENUM ('VERMELHO', 'AMARELO', 'VERDE');

-- Create PV type enum
CREATE TYPE public.pv_tipo AS ENUM ('PV', 'TIL', 'TL');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Ordens de Servico table
CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trecho TEXT NOT NULL,
  bacia TEXT NOT NULL DEFAULT '',
  pv_montante TEXT DEFAULT '',
  pv_jusante TEXT DEFAULT '',
  executor TEXT,
  status os_status NOT NULL DEFAULT 'VERMELHO',
  
  -- Dados previstos
  comprimento_previsto NUMERIC,
  largura_vala NUMERIC,
  prof_media_executada NUMERIC,
  prof_media_prevista NUMERIC,
  dn NUMERIC,
  prof_montante NUMERIC,
  prof_jusante NUMERIC,
  pav_previsto TEXT,
  largura_pav_prevista NUMERIC,
  pav_m2_previsto NUMERIC,
  areia TEXT,
  brita TEXT,
  ligacoes_previstas INTEGER,
  bomba_rebaixo BOOLEAN DEFAULT false,
  prazo_previsto INTEGER,
  prazo_arredondado INTEGER,
  bms TEXT,
  
  -- Dados reais (preenchidos pelo encarregado)
  comprimento_real NUMERIC,
  prof_media_real NUMERIC,
  pav_real TEXT,
  largura_pav_real NUMERIC,
  pav_m2_real NUMERIC,
  ligacoes_real INTEGER,
  
  -- As-built (preenchido pelo topógrafo)
  as_built_lat NUMERIC,
  as_built_lng NUMERIC,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(trecho)
);
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view OS" ON public.ordens_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert OS" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update OS" ON public.ordens_servico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete OS" ON public.ordens_servico FOR DELETE TO authenticated USING (true);

-- Estacas table
CREATE TABLE public.estacas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  coord_n NUMERIC,
  coord_e NUMERIC,
  ct NUMERIC,
  cc NUMERIC,
  declividade NUMERIC,
  diametro NUMERIC,
  g NUMERIC,
  p NUMERIC,
  cr NUMERIC,
  r NUMERIC,
  h NUMERIC,
  pv_nome TEXT,
  pv_tipo pv_tipo,
  pv_prof NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.estacas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view estacas" ON public.estacas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert estacas" ON public.estacas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update estacas" ON public.estacas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete estacas" ON public.estacas FOR DELETE TO authenticated USING (true);

-- Materiais entrega table
CREATE TABLE public.materiais_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'un',
  data_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  divergencia BOOLEAN DEFAULT false,
  obs_divergencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.materiais_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view materiais" ON public.materiais_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert materiais" ON public.materiais_entrega FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update materiais" ON public.materiais_entrega FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete materiais" ON public.materiais_entrega FOR DELETE TO authenticated USING (true);

-- Topografia as-built table
CREATE TABLE public.topografia_asbuilt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  coord_n NUMERIC,
  coord_e NUMERIC,
  latitude NUMERIC,
  longitude NUMERIC,
  observacao TEXT,
  registrado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.topografia_asbuilt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view topografia" ON public.topografia_asbuilt FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert topografia" ON public.topografia_asbuilt FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update topografia" ON public.topografia_asbuilt FOR UPDATE TO authenticated USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ordens_servico_updated_at BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estacas_updated_at BEFORE UPDATE ON public.estacas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_materiais_entrega_updated_at BEFORE UPDATE ON public.materiais_entrega FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX idx_ordens_servico_bacia ON public.ordens_servico(bacia);
CREATE INDEX idx_ordens_servico_trecho ON public.ordens_servico(trecho);
CREATE INDEX idx_estacas_os_id ON public.estacas(os_id);
CREATE INDEX idx_materiais_os_id ON public.materiais_entrega(os_id);
CREATE INDEX idx_topografia_os_id ON public.topografia_asbuilt(os_id);
