CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{2,20}$'),
  county text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view sites" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "HSE leaders can create sites" ON public.sites FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can update sites" ON public.sites FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "Admins can delete sites" ON public.sites FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sites_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9_-]{2,20}$'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(site_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "HSE leaders can create departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can update departments" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.legal_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  legal_obligation text NOT NULL CHECK (char_length(legal_obligation) BETWEEN 2 AND 2000),
  authority text NOT NULL CHECK (char_length(authority) BETWEEN 2 AND 200),
  category text NOT NULL CHECK (category IN ('osha_kenya','nema','fire_safety','county_government','other')),
  compliance_status text NOT NULL DEFAULT 'under_review' CHECK (compliance_status IN ('compliant','partially_compliant','non_compliant','under_review')),
  evidence text,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  review_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_requirements TO authenticated;
GRANT ALL ON public.legal_requirements TO service_role;
ALTER TABLE public.legal_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view legal requirements" ON public.legal_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create legal requirements" ON public.legal_requirements FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update legal requirements" ON public.legal_requirements FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete legal requirements" ON public.legal_requirements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER legal_requirements_updated_at BEFORE UPDATE ON public.legal_requirements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  company_name text NOT NULL CHECK (char_length(company_name) BETWEEN 2 AND 240),
  contact_person text NOT NULL CHECK (char_length(contact_person) BETWEEN 2 AND 160),
  contact_email text,
  contact_phone text,
  scope_of_work text NOT NULL CHECK (char_length(scope_of_work) BETWEEN 2 AND 2000),
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','under_review','approved','suspended','expired','rejected')),
  insurance_provider text,
  insurance_expiry date,
  permit_reference text,
  permit_expiry date,
  hse_score numeric(5,2) CHECK (hse_score BETWEEN 0 AND 100),
  performance_notes text,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contractors TO authenticated;
GRANT ALL ON public.contractors TO service_role;
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view contractors" ON public.contractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create contractors" ON public.contractors FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update contractors" ON public.contractors FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete contractors" ON public.contractors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER contractors_updated_at BEFORE UPDATE ON public.contractors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.environmental_aspects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  activity text NOT NULL CHECK (char_length(activity) BETWEEN 2 AND 500),
  aspect text NOT NULL CHECK (char_length(aspect) BETWEEN 2 AND 1000),
  impact text NOT NULL CHECK (char_length(impact) BETWEEN 2 AND 1000),
  condition text NOT NULL DEFAULT 'normal' CHECK (condition IN ('normal','abnormal','emergency')),
  likelihood integer NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  severity integer NOT NULL CHECK (severity BETWEEN 1 AND 5),
  significance_score integer GENERATED ALWAYS AS (likelihood * severity) STORED,
  significance_rating text GENERATED ALWAYS AS (public.hse_risk_rating(likelihood * severity)) STORED,
  existing_controls text,
  additional_controls text,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  review_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','under_review','closed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.environmental_aspects TO authenticated;
GRANT ALL ON public.environmental_aspects TO service_role;
ALTER TABLE public.environmental_aspects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view environmental aspects" ON public.environmental_aspects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create environmental aspects" ON public.environmental_aspects FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update environmental aspects" ON public.environmental_aspects FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete environmental aspects" ON public.environmental_aspects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER environmental_aspects_updated_at BEFORE UPDATE ON public.environmental_aspects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.environmental_waste_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  waste_category text NOT NULL CHECK (char_length(waste_category) BETWEEN 2 AND 160),
  waste_type text NOT NULL CHECK (waste_type IN ('hazardous','non_hazardous','recyclable','organic')),
  quantity numeric(14,3) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 30),
  recorded_on date NOT NULL,
  disposal_method text NOT NULL CHECK (char_length(disposal_method) BETWEEN 2 AND 300),
  transporter text,
  disposal_reference text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.environmental_waste_records TO authenticated;
GRANT ALL ON public.environmental_waste_records TO service_role;
ALTER TABLE public.environmental_waste_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view waste records" ON public.environmental_waste_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create waste records" ON public.environmental_waste_records FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update waste records" ON public.environmental_waste_records FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete waste records" ON public.environmental_waste_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER environmental_waste_updated_at BEFORE UPDATE ON public.environmental_waste_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.environmental_resource_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  resource_type text NOT NULL CHECK (resource_type IN ('electricity','water','fuel','paper','other')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  quantity numeric(16,3) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 30),
  cost numeric(16,2) CHECK (cost >= 0),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.environmental_resource_records TO authenticated;
GRANT ALL ON public.environmental_resource_records TO service_role;
ALTER TABLE public.environmental_resource_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view resource records" ON public.environmental_resource_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create resource records" ON public.environmental_resource_records FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update resource records" ON public.environmental_resource_records FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete resource records" ON public.environmental_resource_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER environmental_resources_updated_at BEFORE UPDATE ON public.environmental_resource_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.environmental_emission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  emission_source text NOT NULL CHECK (char_length(emission_source) BETWEEN 2 AND 240),
  scope text NOT NULL CHECK (scope IN ('scope_1','scope_2','scope_3','other')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  quantity numeric(16,3) NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 30),
  calculation_method text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.environmental_emission_records TO authenticated;
GRANT ALL ON public.environmental_emission_records TO service_role;
ALTER TABLE public.environmental_emission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view emission records" ON public.environmental_emission_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create emission records" ON public.environmental_emission_records FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update emission records" ON public.environmental_emission_records FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete emission records" ON public.environmental_emission_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER environmental_emissions_updated_at BEFORE UPDATE ON public.environmental_emission_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ppe_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
  ppe_item text NOT NULL CHECK (char_length(ppe_item) BETWEEN 2 AND 200),
  serial_number text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 1000),
  issued_on date NOT NULL,
  expected_replacement_on date,
  replaced_on date,
  condition text NOT NULL DEFAULT 'serviceable' CHECK (condition IN ('new','serviceable','due_replacement','damaged','lost','replaced')),
  issued_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppe_issuances TO authenticated;
GRANT ALL ON public.ppe_issuances TO service_role;
ALTER TABLE public.ppe_issuances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view PPE issuances" ON public.ppe_issuances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create PPE issuances" ON public.ppe_issuances FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update PPE issuances" ON public.ppe_issuances FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete PPE issuances" ON public.ppe_issuances FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER ppe_issuances_updated_at BEFORE UPDATE ON public.ppe_issuances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ppe_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_id uuid NOT NULL REFERENCES public.ppe_issuances(id) ON DELETE CASCADE,
  inspected_on date NOT NULL,
  result text NOT NULL CHECK (result IN ('pass','monitor','fail')),
  inspector_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  findings text,
  corrective_action text,
  next_inspection_on date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppe_inspections TO authenticated;
GRANT ALL ON public.ppe_inspections TO service_role;
ALTER TABLE public.ppe_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view PPE inspections" ON public.ppe_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create PPE inspections" ON public.ppe_inspections FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update PPE inspections" ON public.ppe_inspections FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete PPE inspections" ON public.ppe_inspections FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER ppe_inspections_updated_at BEFORE UPDATE ON public.ppe_inspections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.hse_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 300),
  document_type text NOT NULL CHECK (document_type IN ('policy','sop','procedure','form','work_instruction','other')),
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  current_version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','published','superseded','archived')),
  review_date date NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_documents TO authenticated;
GRANT ALL ON public.hse_documents TO service_role;
ALTER TABLE public.hse_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view documents" ON public.hse_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create documents" ON public.hse_documents FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update documents" ON public.hse_documents FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete documents" ON public.hse_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER hse_documents_updated_at BEFORE UPDATE ON public.hse_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.hse_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.hse_documents(id) ON DELETE CASCADE,
  version_number text NOT NULL CHECK (char_length(version_number) BETWEEN 1 AND 30),
  storage_path text NOT NULL CHECK (char_length(storage_path) BETWEEN 3 AND 1000),
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  mime_type text,
  file_size bigint CHECK (file_size >= 0),
  change_summary text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','rejected','superseded')),
  effective_date date,
  uploaded_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_document_versions TO authenticated;
GRANT ALL ON public.hse_document_versions TO service_role;
ALTER TABLE public.hse_document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view document versions" ON public.hse_document_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create document versions" ON public.hse_document_versions FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Uploaders and HSE leaders can update document versions" ON public.hse_document_versions FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete document versions" ON public.hse_document_versions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE TABLE public.management_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  meeting_date date NOT NULL,
  attendees text,
  executive_summary text,
  decisions text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','in_review','issued','closed')),
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  chairperson_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.management_reviews TO authenticated;
GRANT ALL ON public.management_reviews TO service_role;
ALTER TABLE public.management_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated staff can view management reviews" ON public.management_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated staff can create management reviews" ON public.management_reviews FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners and HSE leaders can update management reviews" ON public.management_reviews FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE leaders can delete management reviews" ON public.management_reviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER management_reviews_updated_at BEFORE UPDATE ON public.management_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('overdue_action','audit_deadline','training_expiry','document_review','risk_review','contractor_expiry','legal_review','other')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 240),
  message text NOT NULL CHECK (char_length(message) BETWEEN 2 AND 1000),
  source_module text,
  source_record_id uuid,
  due_date date,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Users can create their notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (recipient_id = auth.uid());
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE POLICY "Users can delete their notifications" ON public.notifications FOR DELETE TO authenticated USING (recipient_id = auth.uid());

CREATE TABLE public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 2 AND 100),
  module text NOT NULL CHECK (char_length(module) BETWEEN 2 AND 100),
  record_id uuid,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.user_activity_logs TO authenticated;
GRANT ALL ON public.user_activity_logs TO service_role;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and HSE leaders can view activity" ON public.user_activity_logs FOR SELECT TO authenticated USING (actor_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "Users can append their activity" ON public.user_activity_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.hazards ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.safety_observations ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.near_misses ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.risk_assessments ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX legal_requirements_review_idx ON public.legal_requirements(review_date, compliance_status);
CREATE INDEX contractors_expiry_idx ON public.contractors(insurance_expiry, permit_expiry, approval_status);
CREATE INDEX environmental_aspects_site_idx ON public.environmental_aspects(site_id, status, review_date);
CREATE INDEX waste_records_site_date_idx ON public.environmental_waste_records(site_id, recorded_on);
CREATE INDEX resource_records_site_period_idx ON public.environmental_resource_records(site_id, period_start);
CREATE INDEX emission_records_site_period_idx ON public.environmental_emission_records(site_id, period_start);
CREATE INDEX ppe_issuances_employee_idx ON public.ppe_issuances(employee_id, expected_replacement_on);
CREATE INDEX documents_review_idx ON public.hse_documents(review_date, status);
CREATE INDEX document_versions_document_idx ON public.hse_document_versions(document_id, created_at DESC);
CREATE INDEX management_reviews_period_idx ON public.management_reviews(period_end, status);
CREATE INDEX notifications_recipient_idx ON public.notifications(recipient_id, read_at, due_date);
CREATE INDEX user_activity_actor_idx ON public.user_activity_logs(actor_id, created_at DESC);