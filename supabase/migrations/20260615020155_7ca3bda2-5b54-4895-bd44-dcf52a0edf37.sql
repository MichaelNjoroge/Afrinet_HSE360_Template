DROP POLICY IF EXISTS "Record owners and HSE managers can update competencies" ON public.competency_records;

CREATE POLICY "Record owners and HSE managers can update competencies"
ON public.competency_records
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = competency_records.employee_id
      AND e.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = competency_records.employee_id
      AND e.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
);