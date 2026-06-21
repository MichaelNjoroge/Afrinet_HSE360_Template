CREATE OR REPLACE FUNCTION public.user_auth_level(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
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

GRANT EXECUTE ON FUNCTION public.user_auth_level(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_approval_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_module_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  _override public.user_module_permissions%ROWTYPE;
  _is_admin boolean;
  _is_hr boolean;
  _is_hse boolean;
  _is_coordinator boolean;
  _is_supervisor boolean;
  _is_director boolean;
BEGIN
  IF _user_id IS NULL OR _module !~ '^[a-z][a-z0-9_]{1,63}$' OR _action NOT IN ('view','create','edit','delete','approve','export') THEN
    RETURN false;
  END IF;

  _is_admin := private.has_role(_user_id, 'admin'::public.app_role);
  IF _is_admin THEN
    RETURN true;
  END IF;

  SELECT * INTO _override
  FROM public.user_module_permissions
  WHERE user_id = _user_id AND module = _module;

  IF FOUND THEN
    RETURN CASE _action
      WHEN 'view' THEN _override.can_view
      WHEN 'create' THEN _override.can_create
      WHEN 'edit' THEN _override.can_edit
      WHEN 'delete' THEN _override.can_delete
      WHEN 'approve' THEN _override.can_approve
      WHEN 'export' THEN _override.can_export
      ELSE false
    END;
  END IF;

  _is_hr := private.has_role(_user_id, 'hr_manager'::public.app_role);
  _is_hse := private.has_role(_user_id, 'hse_manager'::public.app_role);
  _is_coordinator := private.has_role(_user_id, 'hse_coordinator'::public.app_role);
  _is_supervisor := private.has_role(_user_id, 'supervisor'::public.app_role);
  _is_director := private.has_role(_user_id, 'director'::public.app_role);

  IF _is_hr THEN RETURN true; END IF;
  IF _is_director THEN RETURN _action IN ('view','export'); END IF;
  IF _module = 'objectives' THEN RETURN _action IN ('view','export') OR ((_is_hse OR _is_coordinator) AND _action = 'approve'); END IF;
  IF _action IN ('view','export','create','edit') THEN RETURN true; END IF;
  IF _action = 'approve' THEN RETURN _is_hse OR _is_coordinator OR _is_supervisor; END IF;
  IF _action = 'delete' THEN RETURN _is_hse OR _is_coordinator; END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_last_admin_role_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF OLD.role = 'admin'::public.app_role THEN
    IF TG_OP = 'DELETE' OR NEW.role <> 'admin'::public.app_role OR NEW.user_id <> OLD.user_id THEN
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
CREATE TRIGGER prevent_last_admin_role_removal
BEFORE DELETE OR UPDATE OF user_id, role ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_role_removal();

GRANT EXECUTE ON FUNCTION public.prevent_last_admin_role_removal() TO service_role;