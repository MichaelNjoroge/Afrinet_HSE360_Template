CREATE OR REPLACE FUNCTION public.hse_risk_rating(_score integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _score BETWEEN 1 AND 4 THEN 'low'
    WHEN _score BETWEEN 5 AND 9 THEN 'medium'
    WHEN _score BETWEEN 10 AND 16 THEN 'high'
    WHEN _score BETWEEN 17 AND 25 THEN 'extreme'
    ELSE 'unrated'
  END
$$;

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'Thika',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS reporter_name text,
  ADD COLUMN IF NOT EXISTS investigation_findings text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS lessons_learned text,
  ADD COLUMN IF NOT EXISTS responsible_person_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_due_date date,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_evidence text;

ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_status_check CHECK (status IN ('reported','investigated','approved','actioned','verified','closed'));
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_severity_check;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_severity_check CHECK (severity IN ('low','moderate','high','critical'));

ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'corrective',
  ADD COLUMN IF NOT EXISTS source_record_id uuid,
  ADD COLUMN IF NOT EXISTS preventive_action text,
  ADD COLUMN IF NOT EXISTS effectiveness_review text,
  ADD COLUMN IF NOT EXISTS effectiveness_status text,
  ADD COLUMN IF NOT EXISTS approver_id uuid,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_evidence text;
ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_action_type_check;
ALTER TABLE public.actions ADD CONSTRAINT actions_action_type_check CHECK (action_type IN ('corrective','preventive'));
ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_status_check;
ALTER TABLE public.actions ADD CONSTRAINT actions_status_check CHECK (status IN ('open','in_progress','awaiting_verification','completed','overdue','closed'));

ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'Thika',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS consequence text,
  ADD COLUMN IF NOT EXISTS additional_controls text,
  ADD COLUMN IF NOT EXISTS initial_score integer GENERATED ALWAYS AS (likelihood * severity) STORED,
  ADD COLUMN IF NOT EXISTS initial_rating text GENERATED ALWAYS AS (public.hse_risk_rating(likelihood * severity)) STORED,
  ADD COLUMN IF NOT EXISTS residual_score integer GENERATED ALWAYS AS (residual_likelihood * residual_severity) STORED,
  ADD COLUMN IF NOT EXISTS residual_rating text GENERATED ALWAYS AS (public.hse_risk_rating(residual_likelihood * residual_severity)) STORED;
ALTER TABLE public.risk_assessments DROP CONSTRAINT IF EXISTS risk_assessments_likelihood_check;
ALTER TABLE public.risk_assessments ADD CONSTRAINT risk_assessments_likelihood_check CHECK (likelihood BETWEEN 1 AND 5 AND severity BETWEEN 1 AND 5 AND residual_likelihood BETWEEN 1 AND 5 AND residual_severity BETWEEN 1 AND 5);

ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS audit_number text,
  ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'Thika',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS audit_team text,
  ADD COLUMN IF NOT EXISTS non_conformities text,
  ADD COLUMN IF NOT EXISTS opportunities_for_improvement text,
  ADD COLUMN IF NOT EXISTS issued_on date,
  ADD COLUMN IF NOT EXISTS verification_evidence text,
  ADD COLUMN IF NOT EXISTS closure_details text;
UPDATE public.audits SET audit_number = 'AUD-' || upper(substr(replace(id::text, '-', ''), 1, 8)) WHERE audit_number IS NULL;
ALTER TABLE public.audits ALTER COLUMN audit_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audits_audit_number_key ON public.audits(audit_number);
ALTER TABLE public.audits DROP CONSTRAINT IF EXISTS audits_status_check;
ALTER TABLE public.audits ADD CONSTRAINT audits_status_check CHECK (status IN ('planned','conducted','issued','actioned','verified','closed'));

CREATE TABLE public.hazards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  site text NOT NULL DEFAULT 'Thika',
  department text NOT NULL,
  location text NOT NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  likelihood integer NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  severity integer NOT NULL CHECK (severity BETWEEN 1 AND 5),
  risk_score integer GENERATED ALWAYS AS (likelihood * severity) STORED,
  risk_rating text GENERATED ALWAYS AS (public.hse_risk_rating(likelihood * severity)) STORED,
  existing_controls text,
  additional_controls text,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  closure_evidence text,
  reported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hazards TO authenticated;
GRANT ALL ON public.hazards TO service_role;
ALTER TABLE public.hazards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view hazards" ON public.hazards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can report hazards" ON public.hazards FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Owners and HSE team can update hazards" ON public.hazards FOR UPDATE TO authenticated USING (reported_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager')) WITH CHECK (reported_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager'));
CREATE POLICY "HSE team can delete hazards" ON public.hazards FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager'));

CREATE TABLE public.safety_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  observation_type text NOT NULL CHECK (observation_type IN ('positive_behaviour','unsafe_act','unsafe_condition')),
  site text NOT NULL DEFAULT 'Thika',
  department text NOT NULL,
  location text NOT NULL,
  supervisor_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  immediate_response text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  observed_at timestamptz NOT NULL,
  observed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_observations TO authenticated;
GRANT ALL ON public.safety_observations TO service_role;
ALTER TABLE public.safety_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view observations" ON public.safety_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can add observations" ON public.safety_observations FOR INSERT TO authenticated WITH CHECK (auth.uid() = observed_by);
CREATE POLICY "Creators and HSE team can update observations" ON public.safety_observations FOR UPDATE TO authenticated USING (observed_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager')) WITH CHECK (observed_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager'));
CREATE POLICY "HSE team can delete observations" ON public.safety_observations FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager'));

CREATE TABLE public.near_misses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  site text NOT NULL DEFAULT 'Thika',
  department text NOT NULL,
  location text NOT NULL,
  occurred_at timestamptz NOT NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  potential_severity text NOT NULL CHECK (potential_severity IN ('low','moderate','high','critical')),
  immediate_controls text,
  investigation_findings text,
  root_cause text,
  responsible_person_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  action_due_date date,
  status text NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','investigated','actioned','verified','closed')),
  closure_evidence text,
  reported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.near_misses TO authenticated;
GRANT ALL ON public.near_misses TO service_role;
ALTER TABLE public.near_misses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view near misses" ON public.near_misses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can report near misses" ON public.near_misses FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Creators and HSE team can update near misses" ON public.near_misses FOR UPDATE TO authenticated USING (reported_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager')) WITH CHECK (reported_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager'));
CREATE POLICY "HSE team can delete near misses" ON public.near_misses FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hse_manager'));

CREATE TABLE public.workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL CHECK (module IN ('incident','hazard','observation','near_miss','risk','audit','capa')),
  record_id uuid NOT NULL,
  from_status text,
  to_status text,
  event_type text NOT NULL CHECK (event_type IN ('created','status_change','investigation','approval','action','verification','closure','comment','evidence')),
  note text CHECK (note IS NULL OR char_length(note) <= 4000),
  evidence text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workflow_events TO authenticated;
GRANT ALL ON public.workflow_events TO service_role;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view workflow history" ON public.workflow_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can add workflow history" ON public.workflow_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

CREATE INDEX IF NOT EXISTS hazards_status_rating_idx ON public.hazards(status, risk_rating);
CREATE INDEX IF NOT EXISTS hazards_department_idx ON public.hazards(department);
CREATE INDEX IF NOT EXISTS observations_type_department_idx ON public.safety_observations(observation_type, department);
CREATE INDEX IF NOT EXISTS near_misses_status_severity_idx ON public.near_misses(status, potential_severity);
CREATE INDEX IF NOT EXISTS workflow_events_record_idx ON public.workflow_events(module, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS actions_source_record_idx ON public.actions(source_type, source_record_id);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON public.incidents(status);
CREATE INDEX IF NOT EXISTS risks_residual_rating_idx ON public.risk_assessments(residual_rating);
CREATE INDEX IF NOT EXISTS audits_status_idx ON public.audits(status);

DROP TRIGGER IF EXISTS set_hazards_updated_at ON public.hazards;
CREATE TRIGGER set_hazards_updated_at BEFORE UPDATE ON public.hazards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_observations_updated_at ON public.safety_observations;
CREATE TRIGGER set_observations_updated_at BEFORE UPDATE ON public.safety_observations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_near_misses_updated_at ON public.near_misses;
CREATE TRIGGER set_near_misses_updated_at BEFORE UPDATE ON public.near_misses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_incidents_updated_at ON public.incidents;
CREATE TRIGGER set_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_actions_updated_at ON public.actions;
CREATE TRIGGER set_actions_updated_at BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_risks_updated_at ON public.risk_assessments;
CREATE TRIGGER set_risks_updated_at BEFORE UPDATE ON public.risk_assessments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_audits_updated_at ON public.audits;
CREATE TRIGGER set_audits_updated_at BEFORE UPDATE ON public.audits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();