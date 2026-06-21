CREATE OR REPLACE FUNCTION private.has_module_permission(
  _user_id uuid,
  _module text,
  _action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
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
  IF _user_id IS NULL OR _module !~ '^[a-z][a-z0-9_]{1,63}$' OR _action NOT IN ('view','create','edit','delete','approve','export') THEN RETURN false; END IF;
  SELECT * INTO _override FROM public.user_module_permissions WHERE user_id = _user_id AND module = _module;
  IF FOUND THEN
    RETURN CASE _action WHEN 'view' THEN _override.can_view WHEN 'create' THEN _override.can_create WHEN 'edit' THEN _override.can_edit WHEN 'delete' THEN _override.can_delete WHEN 'approve' THEN _override.can_approve WHEN 'export' THEN _override.can_export ELSE false END;
  END IF;
  _is_admin := private.has_role(_user_id, 'admin'::public.app_role);
  _is_hr := private.has_role(_user_id, 'hr_manager'::public.app_role);
  _is_hse := private.has_role(_user_id, 'hse_manager'::public.app_role);
  _is_coordinator := private.has_role(_user_id, 'hse_coordinator'::public.app_role);
  _is_supervisor := private.has_role(_user_id, 'supervisor'::public.app_role);
  _is_director := private.has_role(_user_id, 'director'::public.app_role);
  IF _is_admin OR _is_hr THEN RETURN true; END IF;
  IF _is_director THEN RETURN _action IN ('view','export'); END IF;
  IF _module = 'objectives' THEN RETURN _action IN ('view','export') OR ((_is_hse OR _is_coordinator) AND _action = 'approve'); END IF;
  IF _action IN ('view','export','create','edit') THEN RETURN true; END IF;
  IF _action = 'approve' THEN RETURN _is_hse OR _is_coordinator OR _is_supervisor; END IF;
  IF _action = 'delete' THEN RETURN _is_hse OR _is_coordinator; END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION private.has_module_permission(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_module_permission(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, private
AS $$
  SELECT CASE
    WHEN auth.uid() = _user_id OR private.has_role(auth.uid(), 'admin'::public.app_role)
      THEN private.has_module_permission(_user_id, _module, _action)
    ELSE false
  END
$$;
REVOKE ALL ON FUNCTION public.has_module_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) TO authenticated, service_role;