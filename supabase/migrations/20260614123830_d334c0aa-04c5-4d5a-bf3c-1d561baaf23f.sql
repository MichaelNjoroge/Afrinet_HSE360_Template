CREATE OR REPLACE FUNCTION private.can_delete_hse_record(_table_name text, _record_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  owner_column text;
  latest_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager') THEN RETURN true; END IF;
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
  EXECUTE format('SELECT id FROM public.%I WHERE %I = $1 ORDER BY created_at DESC, id DESC LIMIT 1', _table_name, owner_column)
    INTO latest_id USING auth.uid();
  RETURN latest_id = _record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_hse_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _is_manager boolean;
  _old jsonb := to_jsonb(OLD);
  _new jsonb := to_jsonb(NEW);
  _field text;
  _locked_status text;
  _restricted_fields text[] := ARRAY[
    'approved_by', 'approved_at', 'verified_by', 'verified_at',
    'investigation_findings', 'root_cause', 'lessons_learned',
    'closure_evidence', 'closure_details', 'verification_evidence',
    'risk_score', 'risk_rating', 'residual_score', 'residual_rating',
    'significance_score', 'significance_rating', 'achievement_percent',
    'rag_status', 'created_by', 'reported_by', 'observed_by',
    'created_at', 'reference', 'audit_number'
  ];
BEGIN
  IF _user_id IS NULL THEN RETURN NEW; END IF;
  _is_manager := public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'hse_manager'::public.app_role);
  IF _is_manager THEN RETURN NEW; END IF;
  _locked_status := lower(COALESCE(_old->>'status', _old->>'approval_status', ''));
  IF _locked_status IN ('approved', 'verified', 'closed') THEN
    RAISE EXCEPTION 'Approved, verified, or closed records can only be changed by an authorized manager.';
  END IF;
  FOREACH _field IN ARRAY _restricted_fields LOOP
    IF _old ? _field AND (_old->_field) IS DISTINCT FROM (_new->_field) THEN
      RAISE EXCEPTION 'Field % can only be changed through an authorized workflow.', _field;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Authenticated staff can create contractors" ON public.contractors;
CREATE POLICY "HSE leaders can create contractors"
ON public.contractors FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
);

DROP POLICY IF EXISTS "Employees can view training" ON public.training_records;
CREATE POLICY "Authorized staff can view training"
ON public.training_records FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = training_records.employee_id AND e.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr_manager')
  OR public.has_role(auth.uid(), 'hse_manager')
);

DROP POLICY IF EXISTS "Employees can view competencies" ON public.competency_records;
CREATE POLICY "Authorized staff can view competencies"
ON public.competency_records FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = competency_records.employee_id AND e.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr_manager')
  OR public.has_role(auth.uid(), 'hse_manager')
);

DROP POLICY IF EXISTS "Authenticated staff can view PPE issuances" ON public.ppe_issuances;
CREATE POLICY "Authorized staff can view PPE issuances"
ON public.ppe_issuances FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = ppe_issuances.employee_id AND e.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr_manager')
  OR public.has_role(auth.uid(), 'hse_manager')
);