
-- Alinhar policies de mapa_trecho_os às demais tabelas do módulo de mapa
-- (mapa_bases, mapa_trechos, mapa_pontos), que usam pode_gerenciar_mapa_base
-- (admin + sala_tecnica). Isso corrige a falha "row-level security policy" na
-- importação da SS-08 v2 sem abrir o acesso a outros perfis.

DROP POLICY IF EXISTS "mapa_trecho_os_select_sala_tecnica" ON public.mapa_trecho_os;
DROP POLICY IF EXISTS "trecho_os_op_write_sala_tecnica" ON public.mapa_trecho_os;

CREATE POLICY "mapa_trecho_os select"
  ON public.mapa_trecho_os
  FOR SELECT
  TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()));

CREATE POLICY "mapa_trecho_os write"
  ON public.mapa_trecho_os
  FOR ALL
  TO authenticated
  USING (public.pode_gerenciar_mapa_base(auth.uid()))
  WITH CHECK (public.pode_gerenciar_mapa_base(auth.uid()));
