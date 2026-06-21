REVOKE ALL ON FUNCTION public.prevent_last_admin_role_removal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_last_admin_role_removal() TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;