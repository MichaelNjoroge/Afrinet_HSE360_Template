REVOKE ALL ON FUNCTION public.claim_employee_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_employee_account() TO service_role;