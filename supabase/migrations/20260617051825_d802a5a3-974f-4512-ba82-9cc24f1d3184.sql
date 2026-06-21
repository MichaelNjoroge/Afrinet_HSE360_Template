
-- Make the public role-check wrappers SECURITY DEFINER so they can reach the
-- private schema regardless of caller privileges. Without this, every RLS
-- policy that calls has_role / is_approval_role / has_module_permission errors
-- with "permission denied for schema private" and the user is treated as if
-- they have no roles -- locking admins out.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
  SELECT private.has_role(_user_id, _role)
$$;

CREATE OR REPLACE FUNCTION public.is_approval_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
  SELECT private.is_approval_role(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
  SELECT CASE
    WHEN auth.uid() = _user_id OR private.has_role(auth.uid(), 'admin'::public.app_role)
      THEN private.has_module_permission(_user_id, _module, _action)
    ELSE false
  END
$$;

-- Make sure execute privileges are intact for app roles.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_approval_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) TO authenticated, service_role;
