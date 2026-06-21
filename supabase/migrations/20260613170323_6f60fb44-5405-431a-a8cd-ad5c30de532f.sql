DROP POLICY IF EXISTS "Signed-in staff can add employees" ON public.employees;
DROP POLICY IF EXISTS "Signed-in staff can update employees" ON public.employees;

CREATE POLICY "Administrators can add employees"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Administrators can update employees"
ON public.employees FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));