REVOKE EXECUTE ON FUNCTION public.grant_admin_to_senior_roles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_admin_role_lockout() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_last_admin_role_removal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_hse_audit_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_employee_avatar_path() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_contractor_onboard_authority() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_close_authority() FROM PUBLIC, anon, authenticated;