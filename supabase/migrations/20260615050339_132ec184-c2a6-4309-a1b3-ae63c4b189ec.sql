DROP POLICY IF EXISTS "Administrators can add employees" ON public.employees;
DROP POLICY IF EXISTS "Administrators can update employees" ON public.employees;

CREATE POLICY "Authorized users can add employees"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (public.has_module_permission(auth.uid(), 'employees', 'create'));

CREATE POLICY "Authorized users can update employees"
ON public.employees
FOR UPDATE
TO authenticated
USING (public.has_module_permission(auth.uid(), 'employees', 'edit'))
WITH CHECK (public.has_module_permission(auth.uid(), 'employees', 'edit'));