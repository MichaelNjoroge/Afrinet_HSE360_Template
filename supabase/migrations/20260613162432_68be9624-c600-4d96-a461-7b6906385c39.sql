CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY "Employees can update incidents" ON public.incidents;
CREATE POLICY "Record owners and HSE managers can update incidents" ON public.incidents FOR UPDATE TO authenticated
USING (reported_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
WITH CHECK (reported_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

DROP POLICY "Employees can update training" ON public.training_records;
CREATE POLICY "Record owners and HSE managers can update training" ON public.training_records FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

DROP POLICY "Employees can update audits" ON public.audits;
CREATE POLICY "Record owners and HSE managers can update audits" ON public.audits FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

DROP POLICY "Employees can update actions" ON public.actions;
CREATE POLICY "Record owners and HSE managers can update actions" ON public.actions FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
WITH CHECK (created_by = auth.uid() OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

DROP POLICY "Employees can update risks" ON public.risk_assessments;
CREATE POLICY "Record owners and HSE managers can update risks" ON public.risk_assessments FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
WITH CHECK (created_by = auth.uid() OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

DROP POLICY "Employees can update competencies" ON public.competency_records;
CREATE POLICY "Record owners and HSE managers can update competencies" ON public.competency_records FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'))
WITH CHECK (created_by = auth.uid() OR employee_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));