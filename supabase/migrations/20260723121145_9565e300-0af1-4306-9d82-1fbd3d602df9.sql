
-- Fase 1 do módulo de mapa geográfico (Preview SS-08)

-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.mapa_base_status AS ENUM ('processando','preview','falha','ativa','arquivada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mapa_camada_tipo AS ENUM ('LINESTRING','POINT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mapa_ponto_tipo AS ENUM ('PV','TL','TQ','OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mapa_vinculo_origem AS ENUM ('AUTO','MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mapa_divergencia_tipo AS ENUM ('COLISAO','SEM_NS','SEM_LINHA','AMBIGUO','SEM_GEOMETRIA','OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mapa_divergencia_status AS ENUM ('aberta','resolvida','ignorada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: pode gerenciar base geográfica?
CREATE OR REPLACE FUNCTION public.pode_gerenciar_mapa_base(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'sala_tecnica'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_mapa_base_preview(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'sala_tecnica'::app_role)
      OR public.has_role(_user_id, 'gerencia'::app_role)
$$;

-- mapa_bases
CREATE TABLE public.mapa_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ss text NOT NULL,
  versao integer NOT NULL,
  status public.mapa_base_status NOT NULL DEFAULT 'processando',
  arquivo_path text,
  arquivo_hash text,
  arquivo_bytes bigint,
  feicoes_rede integer DEFAULT 0,
  feicoes_pv integer DEFAULT 0,
  bbox jsonb,
  relatorio_validacao jsonb,
  motivo_falha text,
  importado_por uuid REFERENCES auth.users(id),
  promovido_em timestamptz,
  promovido_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ss, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_bases TO authenticated;
GRANT ALL ON public.mapa_bases TO service_role;
ALTER TABLE public.mapa_bases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mapa_bases select" ON public.mapa_bases FOR SELECT TO authenticated
  USING (
    (status = 'ativa') OR public.pode_ver_mapa_base_preview(auth.uid())
  );
CREATE POLICY "mapa_bases insert" ON public.mapa_bases FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE POLICY "mapa_bases update" ON public.mapa_bases FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()))
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE POLICY "mapa_bases delete" ON public.mapa_bases FOR DELETE TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE TRIGGER trg_mapa_bases_updated BEFORE UPDATE ON public.mapa_bases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- mapa_camadas_geo
CREATE TABLE public.mapa_camadas_geo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.mapa_bases(id) ON DELETE CASCADE,
  tipo public.mapa_camada_tipo NOT NULL,
  nome_camada text NOT NULL,
  campos_originais jsonb,
  feicoes integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_camadas_geo TO authenticated;
GRANT ALL ON public.mapa_camadas_geo TO service_role;
ALTER TABLE public.mapa_camadas_geo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mapa_camadas_geo select" ON public.mapa_camadas_geo FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.mapa_bases b WHERE b.id = base_id
    AND (b.status = 'ativa' OR public.pode_ver_mapa_base_preview(auth.uid()))));
CREATE POLICY "mapa_camadas_geo write" ON public.mapa_camadas_geo FOR ALL TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()))
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE INDEX idx_mapa_camadas_geo_base ON public.mapa_camadas_geo(base_id);

-- mapa_trechos
CREATE TABLE public.mapa_trechos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.mapa_bases(id) ON DELETE CASCADE,
  rotulo_original text NOT NULL,
  rotulo_chave text NOT NULL,
  no_inicial text,
  no_final text,
  no_iniid text,
  no_finid text,
  dn numeric,
  material text,
  l_escala numeric,
  inv_inic numeric,
  inv_fim numeric,
  declividade numeric,
  geometry jsonb NOT NULL,
  min_lon double precision,
  min_lat double precision,
  max_lon double precision,
  max_lat double precision,
  atributos_extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_trechos TO authenticated;
GRANT ALL ON public.mapa_trechos TO service_role;
ALTER TABLE public.mapa_trechos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mapa_trechos select" ON public.mapa_trechos FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.mapa_bases b WHERE b.id = base_id
    AND (b.status = 'ativa' OR public.pode_ver_mapa_base_preview(auth.uid()))));
CREATE POLICY "mapa_trechos write" ON public.mapa_trechos FOR ALL TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()))
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE INDEX idx_mapa_trechos_base ON public.mapa_trechos(base_id);
CREATE INDEX idx_mapa_trechos_chave ON public.mapa_trechos(rotulo_chave);
CREATE INDEX idx_mapa_trechos_bbox ON public.mapa_trechos(min_lon, min_lat, max_lon, max_lat);

-- mapa_pontos
CREATE TABLE public.mapa_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.mapa_bases(id) ON DELETE CASCADE,
  rotulo_original text NOT NULL,
  rotulo_chave text NOT NULL,
  tipo_no public.mapa_ponto_tipo NOT NULL DEFAULT 'OUTRO',
  cota_marg numeric,
  cota_inv numeric,
  prof numeric,
  geometry jsonb NOT NULL,
  lon double precision,
  lat double precision,
  atributos_extra jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_pontos TO authenticated;
GRANT ALL ON public.mapa_pontos TO service_role;
ALTER TABLE public.mapa_pontos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mapa_pontos select" ON public.mapa_pontos FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.mapa_bases b WHERE b.id = base_id
    AND (b.status = 'ativa' OR public.pode_ver_mapa_base_preview(auth.uid()))));
CREATE POLICY "mapa_pontos write" ON public.mapa_pontos FOR ALL TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()))
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE INDEX idx_mapa_pontos_base ON public.mapa_pontos(base_id);
CREATE INDEX idx_mapa_pontos_chave ON public.mapa_pontos(rotulo_chave);
CREATE INDEX idx_mapa_pontos_bbox ON public.mapa_pontos(lon, lat);

-- mapa_trecho_os (N:N)
CREATE TABLE public.mapa_trecho_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trecho_id uuid NOT NULL REFERENCES public.mapa_trechos(id) ON DELETE CASCADE,
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  origem public.mapa_vinculo_origem NOT NULL DEFAULT 'AUTO',
  fracao numeric NOT NULL DEFAULT 1.0,
  ativo boolean NOT NULL DEFAULT true,
  motivo text,
  criado_por uuid REFERENCES auth.users(id),
  desativado_por uuid REFERENCES auth.users(id),
  desativado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_trecho_os TO authenticated;
GRANT ALL ON public.mapa_trecho_os TO service_role;
ALTER TABLE public.mapa_trecho_os ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mapa_trecho_os select" ON public.mapa_trecho_os FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.mapa_trechos t JOIN public.mapa_bases b ON b.id = t.base_id
    WHERE t.id = trecho_id AND (b.status = 'ativa' OR public.pode_ver_mapa_base_preview(auth.uid()))));
CREATE POLICY "mapa_trecho_os write" ON public.mapa_trecho_os FOR ALL TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()))
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE INDEX idx_mtos_trecho ON public.mapa_trecho_os(trecho_id, ativo);
CREATE INDEX idx_mtos_os ON public.mapa_trecho_os(os_id, ativo);
CREATE TRIGGER trg_mtos_updated BEFORE UPDATE ON public.mapa_trecho_os
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- mapa_vinculos_auditoria
CREATE TABLE public.mapa_vinculos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_id uuid,
  trecho_id uuid,
  os_id uuid,
  acao text NOT NULL,
  antes jsonb,
  depois jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.mapa_vinculos_auditoria TO authenticated;
GRANT ALL ON public.mapa_vinculos_auditoria TO service_role;
ALTER TABLE public.mapa_vinculos_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mva select" ON public.mapa_vinculos_auditoria FOR SELECT TO authenticated
  USING (public.pode_ver_mapa_base_preview(auth.uid()));
CREATE POLICY "mva insert" ON public.mapa_vinculos_auditoria FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_mapa_trecho_os_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.mapa_vinculos_auditoria(vinculo_id, trecho_id, os_id, acao, depois, user_id)
    VALUES (NEW.id, NEW.trecho_id, NEW.os_id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.mapa_vinculos_auditoria(vinculo_id, trecho_id, os_id, acao, antes, depois, user_id)
    VALUES (NEW.id, NEW.trecho_id, NEW.os_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.mapa_vinculos_auditoria(vinculo_id, trecho_id, os_id, acao, antes, user_id)
    VALUES (OLD.id, OLD.trecho_id, OLD.os_id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_mapa_trecho_os_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.mapa_trecho_os
  FOR EACH ROW EXECUTE FUNCTION public.tg_mapa_trecho_os_audit();

-- mapa_divergencias
CREATE TABLE public.mapa_divergencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id uuid NOT NULL REFERENCES public.mapa_bases(id) ON DELETE CASCADE,
  tipo public.mapa_divergencia_tipo NOT NULL,
  rotulo text,
  detalhes jsonb,
  status public.mapa_divergencia_status NOT NULL DEFAULT 'aberta',
  resolvido_por uuid REFERENCES auth.users(id),
  resolvido_em timestamptz,
  resolucao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapa_divergencias TO authenticated;
GRANT ALL ON public.mapa_divergencias TO service_role;
ALTER TABLE public.mapa_divergencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mdv select" ON public.mapa_divergencias FOR SELECT TO authenticated
  USING (public.pode_ver_mapa_base_preview(auth.uid()));
CREATE POLICY "mdv write" ON public.mapa_divergencias FOR ALL TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()))
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
CREATE INDEX idx_mdv_base ON public.mapa_divergencias(base_id, status);
CREATE TRIGGER trg_mdv_updated BEFORE UPDATE ON public.mapa_divergencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
