
-- Authorization level helper: 1=employee, 2=supervisor/auditor, 3=hr_manager/hse_coordinator, 4=director/hse_manager, 5=admin
CREATE OR REPLACE FUNCTION public.user_auth_level(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(MAX(CASE role::text
    WHEN 'admin' THEN 5
    WHEN 'director' THEN 4
    WHEN 'hse_manager' THEN 4
    WHEN 'hr_manager' THEN 3
    WHEN 'hse_coordinator' THEN 3
    WHEN 'supervisor' THEN 2
    WHEN 'auditor' THEN 2
    ELSE 1
  END), 1)
  FROM public.user_roles
  WHERE user_id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.user_auth_level(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_auth_level(uuid) TO authenticated, service_role;

-- Trigger function: block closing an open record unless caller is Level 4+
CREATE OR REPLACE FUNCTION public.enforce_close_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_status text := lower(COALESCE(NEW.status, ''));
  _old_status text := lower(COALESCE(OLD.status, ''));
BEGIN
  IF _uid IS NULL THEN
    RETURN NEW; -- service role / system contexts bypass
  END IF;
  IF _new_status = 'closed' AND _old_status <> 'closed' THEN
    IF public.user_auth_level(_uid) < 4 THEN
      RAISE EXCEPTION 'Closing this record requires Level 4 or Level 5 authorization.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_close_authority() FROM PUBLIC, anon;

-- Attach the close-authority trigger to all incident-style modules
DROP TRIGGER IF EXISTS enforce_close_authority_incidents ON public.incidents;
CREATE TRIGGER enforce_close_authority_incidents
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_close_authority();

DROP TRIGGER IF EXISTS enforce_close_authority_near_misses ON public.near_misses;
CREATE TRIGGER enforce_close_authority_near_misses
  BEFORE UPDATE ON public.near_misses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_close_authority();

DROP TRIGGER IF EXISTS enforce_close_authority_hazards ON public.hazards;
CREATE TRIGGER enforce_close_authority_hazards
  BEFORE UPDATE ON public.hazards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_close_authority();

DROP TRIGGER IF EXISTS enforce_close_authority_observations ON public.safety_observations;
CREATE TRIGGER enforce_close_authority_observations
  BEFORE UPDATE ON public.safety_observations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_close_authority();

DROP TRIGGER IF EXISTS enforce_close_authority_audits ON public.audits;
CREATE TRIGGER enforce_close_authority_audits
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.enforce_close_authority();

DROP TRIGGER IF EXISTS enforce_close_authority_actions ON public.actions;
CREATE TRIGGER enforce_close_authority_actions
  BEFORE UPDATE ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_close_authority();

-- Trigger function: block creating a contractor unless caller is Level 4+
CREATE OR REPLACE FUNCTION public.enforce_contractor_onboard_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.user_auth_level(_uid) < 4 THEN
    RAISE EXCEPTION 'Onboarding a new contractor requires Level 4 or Level 5 authorization.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_contractor_onboard_authority() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS enforce_contractor_onboard_authority ON public.contractors;
CREATE TRIGGER enforce_contractor_onboard_authority
  BEFORE INSERT ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_contractor_onboard_authority();
