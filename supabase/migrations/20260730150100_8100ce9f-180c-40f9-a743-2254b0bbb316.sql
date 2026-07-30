REVOKE ALL ON FUNCTION public.recompute_os_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_os_status(uuid) TO service_role;