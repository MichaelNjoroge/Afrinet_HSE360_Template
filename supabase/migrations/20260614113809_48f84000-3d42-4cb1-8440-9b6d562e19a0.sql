CREATE OR REPLACE FUNCTION public.protect_hse_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  IF _user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _is_manager := public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'hr_manager'::public.app_role)
    OR public.has_role(_user_id, 'hse_manager'::public.app_role);

  IF _is_manager THEN
    RETURN NEW;
  END IF;

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

REVOKE ALL ON FUNCTION public.protect_hse_audit_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_hse_audit_fields() TO service_role;

DO $$
DECLARE
  _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY[
    'incidents', 'hazards', 'safety_observations', 'near_misses',
    'risk_assessments', 'audits', 'actions', 'inspections',
    'training_records', 'competency_records', 'hse_objectives',
    'legal_requirements', 'contractors', 'environmental_aspects',
    'ppe_issuances', 'hse_documents', 'management_reviews'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS protect_audit_fields ON public.%I', _table);
    EXECUTE format(
      'CREATE TRIGGER protect_audit_fields BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_hse_audit_fields()',
      _table
    );
  END LOOP;
END
$$;