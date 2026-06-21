DROP POLICY IF EXISTS "Managers and creators read contractors" ON public.contractors;
CREATE POLICY "Managers and creators read contractors" ON public.contractors
FOR SELECT TO authenticated
USING (
  has_module_permission(auth.uid(), 'contractors'::text, 'view'::text)
  AND (
    auth.uid() = created_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'hse_coordinator'::app_role)
    OR has_role(auth.uid(), 'hr_manager'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);