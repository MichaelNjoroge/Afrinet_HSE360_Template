-- Restrict employee directory SELECT so only Level 4+ users see all employees;
-- everyone else can read only their own record.
DROP POLICY IF EXISTS "Employee directory viewers read permitted employees" ON public.employees;
DROP POLICY IF EXISTS "Employee directory viewers read employees" ON public.employees;
DROP POLICY IF EXISTS "Employees and people managers can view employees" ON public.employees;

CREATE POLICY "Level 4+ see all employees; others only see own record"
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.user_auth_level(auth.uid()) >= 4
  OR user_id = auth.uid()
);