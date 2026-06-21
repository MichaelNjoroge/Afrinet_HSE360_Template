
-- 1. Employees: remove duplicate INSERT policies, keep one consolidated rule
DROP POLICY IF EXISTS "Authorized users can add employees" ON public.employees;
DROP POLICY IF EXISTS "Authorized users create employees" ON public.employees;

CREATE POLICY "Authorized users create employees"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_module_permission(auth.uid(), 'employees', 'create')
  OR public.has_module_permission(auth.uid(), 'employees', 'edit')
);

-- 2. hse_objective_monthly_progress
DROP POLICY IF EXISTS "Authenticated read monthly progress" ON public.hse_objective_monthly_progress;

CREATE POLICY "Objectives viewers read monthly progress"
ON public.hse_objective_monthly_progress
FOR SELECT
TO authenticated
USING (public.has_module_permission(auth.uid(), 'objectives', 'view'));

-- 3. workflow_events
DROP POLICY IF EXISTS "Signed-in staff can view workflow history" ON public.workflow_events;

CREATE POLICY "Module viewers read workflow history"
ON public.workflow_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_module_permission(auth.uid(), module, 'view')
  OR actor_id = auth.uid()
);

-- 4. hse-evidence storage bucket UPDATE policy
DROP POLICY IF EXISTS "Owners and managers update HSE evidence" ON storage.objects;

CREATE POLICY "Owners and managers update HSE evidence"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hse-evidence'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_coordinator'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'hse-evidence'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_coordinator'::public.app_role)
  )
);
