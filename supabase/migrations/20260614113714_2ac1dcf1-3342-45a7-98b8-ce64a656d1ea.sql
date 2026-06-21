CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_approval_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'hr_manager'::public.app_role, 'hse_manager'::public.app_role, 'supervisor'::public.app_role)
  )
$$;

REVOKE ALL ON FUNCTION public.is_approval_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approval_role(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Signed-in staff can view employees" ON public.employees;
CREATE POLICY "Employees and people managers can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
);

DROP POLICY IF EXISTS "Employees can view company profiles" ON public.profiles;
CREATE POLICY "Employees and people managers can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
);

DROP POLICY IF EXISTS "Employees can request approval" ON public.approval_requests;
CREATE POLICY "Employees can request approval from authorized approvers"
ON public.approval_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'
  AND public.is_approval_role(approver_id)
);

DROP POLICY IF EXISTS "Authenticated staff can view secure HSE files" ON storage.objects;
CREATE POLICY "Owners and authorized managers can view secure HSE files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hse-secure-files'
  AND (
    owner_id = auth.uid()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
);