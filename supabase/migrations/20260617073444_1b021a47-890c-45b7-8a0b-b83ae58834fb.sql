-- Allow every signed-in user to see the corporate employee directory.
-- The previous policy restricted SELECT to Level 4+ users or own-record only,
-- which made "Reports to: <manager>" appear blank for employees and broke
-- name resolution wherever incidents/CAPAs/etc. join to employees.
-- Internal HSE app: directory is shared. RLS on writes is unchanged.

DROP POLICY IF EXISTS "Level 4+ see all employees; others only see own record" ON public.employees;

CREATE POLICY "Authenticated users can read the employee directory"
ON public.employees
FOR SELECT
TO authenticated
USING (true);