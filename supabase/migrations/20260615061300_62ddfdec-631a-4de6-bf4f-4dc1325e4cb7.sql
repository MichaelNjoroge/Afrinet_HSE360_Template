DROP POLICY IF EXISTS "Employee directory viewers read employees" ON public.employees;
CREATE POLICY "Employee directory viewers read permitted employees"
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.has_module_permission(auth.uid(), 'employees', 'view')
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_coordinator'::public.app_role)
    OR public.has_role(auth.uid(), 'director'::public.app_role)
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.has_role(auth.uid(), 'auditor'::public.app_role)
  )
);