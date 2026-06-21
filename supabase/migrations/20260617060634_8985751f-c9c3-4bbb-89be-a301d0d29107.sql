CREATE OR REPLACE FUNCTION public.prevent_admin_role_lockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF OLD.role = 'admin'::public.app_role THEN
    IF TG_OP = 'DELETE' OR NEW.role <> 'admin'::public.app_role OR NEW.user_id <> OLD.user_id THEN
      IF _actor = OLD.user_id THEN
        RAISE EXCEPTION 'Administrators cannot remove their own administrator role.';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE role = 'admin'::public.app_role
          AND user_id <> OLD.user_id
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'At least one administrator account must remain active.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_role_removal ON public.user_roles;
DROP TRIGGER IF EXISTS prevent_admin_role_lockout ON public.user_roles;
CREATE TRIGGER prevent_admin_role_lockout
BEFORE DELETE OR UPDATE OF user_id, role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_admin_role_lockout();

REVOKE ALL ON FUNCTION public.prevent_admin_role_lockout() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_admin_role_lockout() TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_last_admin_role_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  RETURN public.prevent_admin_role_lockout();
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_last_admin_role_removal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_last_admin_role_removal() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_employee_account()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  claimed_id uuid;
  login_email text;
  _already_admin boolean;
BEGIN
  login_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  IF auth.uid() IS NULL OR login_email = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  ) INTO _already_admin;

  UPDATE public.employees
  SET user_id = auth.uid(), account_status = 'active', updated_at = now()
  WHERE lower(email) = login_email
    AND employment_status = 'active'
    AND (user_id IS NULL OR user_id = auth.uid())
  RETURNING id INTO claimed_id;

  IF claimed_id IS NULL THEN
    SELECT id INTO claimed_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  IF claimed_id IS NOT NULL AND NOT _already_admin THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (auth.uid(), 'employee'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_employee_account() TO authenticated, service_role;