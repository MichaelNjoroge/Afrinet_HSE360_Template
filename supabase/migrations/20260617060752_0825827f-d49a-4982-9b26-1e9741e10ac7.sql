REVOKE ALL ON FUNCTION public.claim_employee_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_employee_account() TO authenticated, service_role;