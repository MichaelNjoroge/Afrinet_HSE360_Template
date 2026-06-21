CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 255),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 30),
  department TEXT CHECK (department IS NULL OR char_length(department) <= 100),
  job_title TEXT CHECK (job_title IS NULL OR char_length(job_title) <= 100),
  employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'inactive', 'contractor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in staff can view employees"
ON public.employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in staff can add employees"
ON public.employees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Signed-in staff can update employees"
ON public.employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.employees (id, full_name, email, phone, department, job_title, employment_status, created_at, updated_at)
SELECT id, full_name, email, phone, department, job_title, employment_status, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.training_records DROP CONSTRAINT IF EXISTS training_records_employee_id_fkey;
ALTER TABLE public.training_records ADD CONSTRAINT training_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;

ALTER TABLE public.competency_records DROP CONSTRAINT IF EXISTS competency_records_employee_id_fkey;
ALTER TABLE public.competency_records ADD CONSTRAINT competency_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;

ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_owner_id_fkey;
ALTER TABLE public.actions ADD CONSTRAINT actions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.risk_assessments DROP CONSTRAINT IF EXISTS risk_assessments_owner_id_fkey;
ALTER TABLE public.risk_assessments ADD CONSTRAINT risk_assessments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_employees_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_employees_updated_at();