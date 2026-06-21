CREATE TYPE public.app_role AS ENUM ('admin', 'hse_manager', 'supervisor', 'employee', 'auditor');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(email) <= 255),
  department text CHECK (char_length(department) <= 100),
  job_title text CHECK (char_length(job_title) <= 100),
  phone text CHECK (char_length(phone) <= 30),
  employment_status text NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'contractor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view company profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Employees can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE CHECK (char_length(reference) BETWEEN 3 AND 30),
  incident_type text NOT NULL CHECK (incident_type IN ('injury', 'near_miss', 'property_damage', 'environmental', 'security', 'occupational_illness')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  location text NOT NULL CHECK (char_length(location) BETWEEN 2 AND 160),
  occurred_at timestamptz NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  immediate_action text CHECK (char_length(immediate_action) <= 2000),
  persons_involved text CHECK (char_length(persons_involved) <= 1000),
  status text NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'action_required', 'closed')),
  reported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view incidents" ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can report incidents" ON public.incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Employees can update incidents" ON public.incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HSE managers can delete incidents" ON public.incidents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE TABLE public.training_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_name text NOT NULL CHECK (char_length(course_name) BETWEEN 2 AND 160),
  provider text CHECK (char_length(provider) <= 160),
  completed_on date,
  expires_on date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'valid', 'expiring', 'expired', 'not_required')),
  certificate_reference text CHECK (char_length(certificate_reference) <= 100),
  notes text CHECK (char_length(notes) <= 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR completed_on IS NULL OR expires_on >= completed_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_records TO authenticated;
GRANT ALL ON public.training_records TO service_role;
ALTER TABLE public.training_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view training" ON public.training_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can add training" ON public.training_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Employees can update training" ON public.training_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HSE managers can delete training" ON public.training_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE TABLE public.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  audit_type text NOT NULL CHECK (audit_type IN ('internal', 'external', 'regulatory', 'inspection', 'supplier')),
  area text NOT NULL CHECK (char_length(area) BETWEEN 2 AND 160),
  lead_auditor text NOT NULL CHECK (char_length(lead_auditor) BETWEEN 2 AND 120),
  scheduled_on date NOT NULL,
  completed_on date,
  score numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'overdue', 'cancelled')),
  findings_summary text CHECK (char_length(findings_summary) <= 3000),
  notes text CHECK (char_length(notes) <= 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view audits" ON public.audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can add audits" ON public.audits FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Employees can update audits" ON public.audits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HSE managers can delete audits" ON public.audits FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE TABLE public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  source_type text NOT NULL CHECK (source_type IN ('incident', 'audit', 'risk', 'inspection', 'meeting', 'other')),
  source_reference text CHECK (char_length(source_reference) <= 100),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'overdue')),
  completed_on date,
  evidence text CHECK (char_length(evidence) <= 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actions TO authenticated;
GRANT ALL ON public.actions TO service_role;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view actions" ON public.actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can add actions" ON public.actions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Employees can update actions" ON public.actions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HSE managers can delete actions" ON public.actions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE TABLE public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE CHECK (char_length(reference) BETWEEN 3 AND 30),
  activity text NOT NULL CHECK (char_length(activity) BETWEEN 3 AND 200),
  hazard text NOT NULL CHECK (char_length(hazard) BETWEEN 3 AND 500),
  people_exposed text NOT NULL CHECK (char_length(people_exposed) BETWEEN 2 AND 500),
  existing_controls text NOT NULL CHECK (char_length(existing_controls) BETWEEN 3 AND 2000),
  likelihood integer NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  severity integer NOT NULL CHECK (severity BETWEEN 1 AND 5),
  residual_likelihood integer NOT NULL CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_severity integer NOT NULL CHECK (residual_severity BETWEEN 1 AND 5),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'review_due', 'archived')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessments TO authenticated;
GRANT ALL ON public.risk_assessments TO service_role;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view risks" ON public.risk_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can add risks" ON public.risk_assessments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Employees can update risks" ON public.risk_assessments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HSE managers can delete risks" ON public.risk_assessments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE TABLE public.competency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competency_name text NOT NULL CHECK (char_length(competency_name) BETWEEN 2 AND 160),
  required_level integer NOT NULL CHECK (required_level BETWEEN 1 AND 5),
  current_level integer NOT NULL CHECK (current_level BETWEEN 0 AND 5),
  assessor text CHECK (char_length(assessor) <= 120),
  assessed_on date,
  expires_on date,
  evidence text CHECK (char_length(evidence) <= 1000),
  status text NOT NULL DEFAULT 'gap' CHECK (status IN ('competent', 'gap', 'assessment_due', 'expired')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR assessed_on IS NULL OR expires_on >= assessed_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competency_records TO authenticated;
GRANT ALL ON public.competency_records TO service_role;
ALTER TABLE public.competency_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can view competencies" ON public.competency_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can add competencies" ON public.competency_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Employees can update competencies" ON public.competency_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "HSE managers can delete competencies" ON public.competency_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER training_records_updated_at BEFORE UPDATE ON public.training_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER audits_updated_at BEFORE UPDATE ON public.audits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER actions_updated_at BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER risk_assessments_updated_at BEFORE UPDATE ON public.risk_assessments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER competency_records_updated_at BEFORE UPDATE ON public.competency_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX incidents_status_idx ON public.incidents(status);
CREATE INDEX incidents_occurred_at_idx ON public.incidents(occurred_at DESC);
CREATE INDEX training_employee_idx ON public.training_records(employee_id);
CREATE INDEX training_expiry_idx ON public.training_records(expires_on);
CREATE INDEX audits_schedule_idx ON public.audits(scheduled_on);
CREATE INDEX actions_due_status_idx ON public.actions(due_date, status);
CREATE INDEX risks_review_idx ON public.risk_assessments(review_date);
CREATE INDEX competency_employee_idx ON public.competency_records(employee_id);