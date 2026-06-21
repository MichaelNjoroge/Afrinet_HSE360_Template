
REVOKE EXECUTE ON FUNCTION public.user_auth_level(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_close_authority() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_contractor_onboard_authority() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.user_auth_level(uuid) TO service_role;
