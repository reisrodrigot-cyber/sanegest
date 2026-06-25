ALTER VIEW public.relatorio_producao_diaria SET (security_invoker = false);
GRANT SELECT ON public.relatorio_producao_diaria TO anon, authenticated;