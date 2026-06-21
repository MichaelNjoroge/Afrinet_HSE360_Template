DROP POLICY IF EXISTS "Signed-in staff can add workflow history" ON public.workflow_events;
CREATE POLICY "Record owners and HSE team can add workflow history"
ON public.workflow_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = actor_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hse_manager')
    OR (module = 'incident' AND EXISTS (SELECT 1 FROM public.incidents r WHERE r.id = record_id AND r.reported_by = auth.uid()))
    OR (module = 'hazard' AND EXISTS (SELECT 1 FROM public.hazards r WHERE r.id = record_id AND r.reported_by = auth.uid()))
    OR (module = 'observation' AND EXISTS (SELECT 1 FROM public.safety_observations r WHERE r.id = record_id AND r.observed_by = auth.uid()))
    OR (module = 'near_miss' AND EXISTS (SELECT 1 FROM public.near_misses r WHERE r.id = record_id AND r.reported_by = auth.uid()))
    OR (module = 'risk' AND EXISTS (SELECT 1 FROM public.risk_assessments r WHERE r.id = record_id AND r.created_by = auth.uid()))
    OR (module = 'audit' AND EXISTS (SELECT 1 FROM public.audits r WHERE r.id = record_id AND r.created_by = auth.uid()))
    OR (module = 'capa' AND EXISTS (SELECT 1 FROM public.actions r WHERE r.id = record_id AND r.created_by = auth.uid()))
  )
);