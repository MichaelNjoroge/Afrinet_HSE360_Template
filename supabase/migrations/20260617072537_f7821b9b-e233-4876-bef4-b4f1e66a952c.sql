-- Phase 5: Senior roles automatically receive admin
CREATE OR REPLACE FUNCTION public.grant_admin_to_senior_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.role IN ('director'::public.app_role, 'hse_manager'::public.app_role, 'hr_manager'::public.app_role) THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_grant_admin_to_senior ON public.user_roles;
CREATE TRIGGER user_roles_grant_admin_to_senior
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_to_senior_roles();

-- Backfill existing senior users
INSERT INTO public.user_roles(user_id, role)
SELECT DISTINCT user_id, 'admin'::public.app_role
FROM public.user_roles
WHERE role IN ('director'::public.app_role, 'hse_manager'::public.app_role, 'hr_manager'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- Helpful view to resolve employee/user IDs -> display name
CREATE OR REPLACE VIEW public.v_employee_names
WITH (security_invoker = on) AS
SELECT e.id AS id, e.full_name AS name, e.email AS email, e.user_id AS user_id
FROM public.employees e
WHERE e.full_name IS NOT NULL;

GRANT SELECT ON public.v_employee_names TO authenticated;