
DROP POLICY IF EXISTS "Signed-in staff can create inspection items" ON public.inspection_checklist_items;
CREATE POLICY "Authorized inspectors create inspection items"
ON public.inspection_checklist_items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    public.has_module_permission(auth.uid(), 'inspections', 'create')
    OR public.has_module_permission(auth.uid(), 'inspections', 'edit')
  )
);

DROP POLICY IF EXISTS "Module viewers read contractors" ON public.contractors;
CREATE POLICY "Managers and creators read contractors"
ON public.contractors
FOR SELECT
TO authenticated
USING (
  has_module_permission(auth.uid(), 'contractors', 'view')
  AND (
    auth.uid() = created_by
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hse_manager'::app_role)
    OR has_role(auth.uid(), 'hse_coordinator'::app_role)
    OR has_role(auth.uid(), 'hr_manager'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
);
