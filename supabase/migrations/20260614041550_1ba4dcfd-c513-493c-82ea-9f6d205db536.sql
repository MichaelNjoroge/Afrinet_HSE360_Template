ALTER TABLE public.employees
  ADD COLUMN user_id uuid UNIQUE,
  ADD COLUMN manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN approval_level integer NOT NULL DEFAULT 0 CHECK (approval_level BETWEEN 0 AND 10),
  ADD COLUMN account_status text NOT NULL DEFAULT 'not_invited' CHECK (account_status IN ('not_invited','invited','active','suspended'));

CREATE INDEX employees_user_id_idx ON public.employees(user_id);
CREATE INDEX employees_manager_employee_id_idx ON public.employees(manager_employee_id);

DROP POLICY IF EXISTS "Administrators can update employees" ON public.employees;
CREATE POLICY "Administrators can update employees" ON public.employees FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Administrators can delete employees" ON public.employees;
CREATE POLICY "Administrators can delete employees" ON public.employees FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL CHECK (char_length(module) BETWEEN 2 AND 80),
  record_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  approver_id uuid NOT NULL,
  approval_level integer NOT NULL DEFAULT 1 CHECK (approval_level BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  request_note text,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view approval requests" ON public.approval_requests FOR SELECT TO authenticated
USING (requested_by = auth.uid() OR approver_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "Employees can request approval" ON public.approval_requests FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid() AND status = 'pending');
CREATE POLICY "Approvers can decide requests" ON public.approval_requests FOR UPDATE TO authenticated
USING (approver_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
WITH CHECK (approver_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

CREATE INDEX approval_requests_approver_status_idx ON public.approval_requests(approver_id, status);
CREATE INDEX approval_requests_record_idx ON public.approval_requests(module, record_id);
CREATE TRIGGER set_approval_requests_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();