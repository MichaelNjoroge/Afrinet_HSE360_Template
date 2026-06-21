DROP POLICY IF EXISTS "Employees can update own profile" ON public.profiles;
CREATE POLICY "Administrators update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));