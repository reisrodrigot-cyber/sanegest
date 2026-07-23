REVOKE EXECUTE ON FUNCTION public.get_mapa_publico(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_mapa_publico(text) TO authenticated;