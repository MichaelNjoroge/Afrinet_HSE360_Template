DROP POLICY IF EXISTS "Authenticated users can read the employee directory" ON public.employees;

CREATE POLICY "People managers and self can read employee records"
ON public.employees
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'hr_manager'::public.app_role)
  OR has_role(auth.uid(), 'hse_manager'::public.app_role)
  OR has_role(auth.uid(), 'director'::public.app_role)
  OR user_id = auth.uid()
);

GRANT SELECT ON public.v_employee_names TO authenticated;