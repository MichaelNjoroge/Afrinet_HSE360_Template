CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.can_delete_hse_record(_table_name text, _record_id uuid, _owner_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_column text; latest_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager') THEN RETURN true; END IF;
  IF _owner_id IS DISTINCT FROM auth.uid() THEN RETURN false; END IF;
  owner_column := CASE _table_name
    WHEN 'incidents' THEN 'reported_by' WHEN 'hazards' THEN 'reported_by'
    WHEN 'safety_observations' THEN 'observed_by' WHEN 'near_misses' THEN 'reported_by'
    WHEN 'risk_assessments' THEN 'created_by' WHEN 'audits' THEN 'created_by'
    WHEN 'actions' THEN 'created_by' WHEN 'inspections' THEN 'created_by'
    WHEN 'training_records' THEN 'created_by' WHEN 'competency_records' THEN 'created_by'
    WHEN 'hse_objectives' THEN 'created_by' WHEN 'legal_requirements' THEN 'created_by'
    WHEN 'contractors' THEN 'created_by' WHEN 'environmental_aspects' THEN 'created_by'
    WHEN 'ppe_issuances' THEN 'created_by' WHEN 'hse_documents' THEN 'created_by'
    WHEN 'management_reviews' THEN 'created_by' ELSE NULL END;
  IF owner_column IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT id FROM public.%I WHERE %I = $1 ORDER BY created_at DESC, id DESC LIMIT 1', _table_name, owner_column) INTO latest_id USING auth.uid();
  RETURN latest_id = _record_id;
END; $$;
REVOKE ALL ON FUNCTION public.can_delete_hse_record(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_hse_record(text, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "HSE managers can delete incidents" ON public.incidents; CREATE POLICY "Authorized users can delete incidents" ON public.incidents FOR DELETE TO authenticated USING (public.can_delete_hse_record('incidents', id, reported_by));
DROP POLICY IF EXISTS "HSE team can delete hazards" ON public.hazards; CREATE POLICY "Authorized users can delete hazards" ON public.hazards FOR DELETE TO authenticated USING (public.can_delete_hse_record('hazards', id, reported_by));
DROP POLICY IF EXISTS "HSE team can delete observations" ON public.safety_observations; CREATE POLICY "Authorized users can delete observations" ON public.safety_observations FOR DELETE TO authenticated USING (public.can_delete_hse_record('safety_observations', id, observed_by));
DROP POLICY IF EXISTS "HSE team can delete near misses" ON public.near_misses; CREATE POLICY "Authorized users can delete near misses" ON public.near_misses FOR DELETE TO authenticated USING (public.can_delete_hse_record('near_misses', id, reported_by));
DROP POLICY IF EXISTS "HSE managers can delete risks" ON public.risk_assessments; CREATE POLICY "Authorized users can delete risks" ON public.risk_assessments FOR DELETE TO authenticated USING (public.can_delete_hse_record('risk_assessments', id, created_by));
DROP POLICY IF EXISTS "HSE managers can delete audits" ON public.audits; CREATE POLICY "Authorized users can delete audits" ON public.audits FOR DELETE TO authenticated USING (public.can_delete_hse_record('audits', id, created_by));
DROP POLICY IF EXISTS "HSE managers can delete actions" ON public.actions; CREATE POLICY "Authorized users can delete actions" ON public.actions FOR DELETE TO authenticated USING (public.can_delete_hse_record('actions', id, created_by));
DROP POLICY IF EXISTS "HSE managers can delete inspections" ON public.inspections; CREATE POLICY "Authorized users can delete inspections" ON public.inspections FOR DELETE TO authenticated USING (public.can_delete_hse_record('inspections', id, created_by));
DROP POLICY IF EXISTS "HSE managers can delete training" ON public.training_records; CREATE POLICY "Authorized users can delete training" ON public.training_records FOR DELETE TO authenticated USING (public.can_delete_hse_record('training_records', id, created_by));
DROP POLICY IF EXISTS "HSE managers can delete competencies" ON public.competency_records; CREATE POLICY "Authorized users can delete competencies" ON public.competency_records FOR DELETE TO authenticated USING (public.can_delete_hse_record('competency_records', id, created_by));
DROP POLICY IF EXISTS "HSE managers can delete HSE objectives" ON public.hse_objectives; CREATE POLICY "Authorized users can delete objectives" ON public.hse_objectives FOR DELETE TO authenticated USING (public.can_delete_hse_record('hse_objectives', id, created_by));
DROP POLICY IF EXISTS "HSE leaders can delete legal requirements" ON public.legal_requirements; CREATE POLICY "Authorized users can delete legal requirements" ON public.legal_requirements FOR DELETE TO authenticated USING (public.can_delete_hse_record('legal_requirements', id, created_by));
DROP POLICY IF EXISTS "HSE leaders can delete contractors" ON public.contractors; CREATE POLICY "Authorized users can delete contractors" ON public.contractors FOR DELETE TO authenticated USING (public.can_delete_hse_record('contractors', id, created_by));
DROP POLICY IF EXISTS "HSE leaders can delete environmental aspects" ON public.environmental_aspects; CREATE POLICY "Authorized users can delete environmental aspects" ON public.environmental_aspects FOR DELETE TO authenticated USING (public.can_delete_hse_record('environmental_aspects', id, created_by));
DROP POLICY IF EXISTS "HSE leaders can delete PPE issuances" ON public.ppe_issuances; CREATE POLICY "Authorized users can delete PPE issuances" ON public.ppe_issuances FOR DELETE TO authenticated USING (public.can_delete_hse_record('ppe_issuances', id, created_by));
DROP POLICY IF EXISTS "HSE leaders can delete documents" ON public.hse_documents; CREATE POLICY "Authorized users can delete documents" ON public.hse_documents FOR DELETE TO authenticated USING (public.can_delete_hse_record('hse_documents', id, created_by));
DROP POLICY IF EXISTS "HSE leaders can delete management reviews" ON public.management_reviews; CREATE POLICY "Authorized users can delete management reviews" ON public.management_reviews FOR DELETE TO authenticated USING (public.can_delete_hse_record('management_reviews', id, created_by));
DROP POLICY IF EXISTS "Administrators can delete employees" ON public.employees; CREATE POLICY "People managers can delete employees" ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr_manager'));