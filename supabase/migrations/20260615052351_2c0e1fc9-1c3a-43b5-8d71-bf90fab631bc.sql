CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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