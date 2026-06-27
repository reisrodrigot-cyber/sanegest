
ALTER TABLE public.registros_producao
  ADD COLUMN IF NOT EXISTS excluido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS excluido_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_exclusao text;

CREATE INDEX IF NOT EXISTS idx_registros_producao_excluido ON public.registros_producao(excluido);

CREATE TABLE IF NOT EXISTS public.registros_producao_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_producao_id uuid NOT NULL,
  usuario_id uuid,
  acao text NOT NULL CHECK (acao IN ('edicao','exclusao')),
  valor_anterior jsonb,
  valor_novo jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.registros_producao_auditoria TO authenticated;
GRANT ALL ON public.registros_producao_auditoria TO service_role;

ALTER TABLE public.registros_producao_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_insert_audit_registros" ON public.registros_producao_auditoria;
CREATE POLICY "auth_insert_audit_registros"
  ON public.registros_producao_auditoria FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "auth_select_audit_registros" ON public.registros_producao_auditoria;
CREATE POLICY "auth_select_audit_registros"
  ON public.registros_producao_auditoria FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_registro ON public.registros_producao_auditoria(registro_producao_id);

DROP POLICY IF EXISTS owner_update_registros ON public.registros_producao;
CREATE POLICY owner_update_registros ON public.registros_producao
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'sala_tecnica'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (
      auth.uid() = user_id
      AND created_at > now() - interval '2 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.ordens_servico o
        WHERE o.id = os_id AND COALESCE(o.real_validado, false) = true
      )
    )
  );

DROP POLICY IF EXISTS owner_delete_registros ON public.registros_producao;
CREATE POLICY owner_delete_registros ON public.registros_producao
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP VIEW IF EXISTS public.relatorio_producao_diaria;
CREATE VIEW public.relatorio_producao_diaria AS
SELECT os.id AS os_id,
   os.bacia AS obra_id,
   os.bacia AS obra_nome,
   os.trecho,
   COALESCE(NULLIF(os.liberado_para, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.executor, ''::text)) AS encarregado,
   os.liberado_para,
   COALESCE(NULLIF(p.apelido, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.liberado_para, ''::text), NULLIF(os.executor, ''::text)) AS responsavel_nome,
   COALESCE(os.real_validado, false) AS real_validado,
   CASE WHEN COALESCE(os.real_validado, false) THEN os.updated_at::date
        ELSE COALESCE(reg.ultima_data, os.updated_at::date) END AS data_producao,
   CASE WHEN COALESCE(os.real_validado, false) THEN os.comprimento_real
        ELSE reg.soma_comprimento END AS comprimento_trecho_executado,
   CASE WHEN COALESCE(os.real_validado, false) THEN os.ligacoes_real::bigint
        ELSE reg.soma_ligacoes END AS quantidade_ligacoes_realizadas,
   lig.ligacoes_detalhadas,
   lig.comprimento_total_ligacoes,
   os.updated_at
FROM public.ordens_servico os
LEFT JOIN LATERAL (
  SELECT sum(COALESCE(rp.comprimento_dia, 0::numeric)) AS soma_comprimento,
         sum(COALESCE(rp.ligacoes_dia, 0)) AS soma_ligacoes,
         max(rp.data_registro) AS ultima_data
  FROM public.registros_producao rp
  WHERE rp.os_id = os.id AND COALESCE(rp.excluido, false) = false
) reg ON true
LEFT JOIN LATERAL (
  SELECT count(*)::bigint AS ligacoes_detalhadas,
         sum(COALESCE(l.comprimento, 0::numeric)) AS comprimento_total_ligacoes
  FROM public.ligacoes l
  WHERE l.os_id = os.id
) lig ON true
LEFT JOIN public.profiles p ON p.user_id = (
  SELECT u.id FROM auth.users u
  WHERE lower(u.email) = lower(COALESCE(NULLIF(os.liberado_para, ''::text), NULLIF(os.executor_real, ''::text), NULLIF(os.executor, ''::text)))
  LIMIT 1
);
