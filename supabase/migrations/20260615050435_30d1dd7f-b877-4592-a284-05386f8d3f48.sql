DROP POLICY IF EXISTS "Employees can add actions" ON public.actions;
DROP POLICY IF EXISTS "Record owners and HSE managers can update actions" ON public.actions;
CREATE POLICY "Authorized users create CAPA" ON public.actions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'capa', 'create'));
CREATE POLICY "Authorized users edit CAPA" ON public.actions FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'capa', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'capa', 'edit'));

DROP POLICY IF EXISTS "Employees can add audits" ON public.audits;
DROP POLICY IF EXISTS "Record owners and HSE managers can update audits" ON public.audits;
CREATE POLICY "Authorized users create audits" ON public.audits FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'audits', 'create'));
CREATE POLICY "Authorized users edit audits" ON public.audits FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'audits', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'audits', 'edit'));

DROP POLICY IF EXISTS "Employees can add competencies" ON public.competency_records;
DROP POLICY IF EXISTS "Record owners and HSE managers can update competencies" ON public.competency_records;
CREATE POLICY "Authorized users create competencies" ON public.competency_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'competencies', 'create'));
CREATE POLICY "Authorized users edit competencies" ON public.competency_records FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'competencies', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'competencies', 'edit'));

DROP POLICY IF EXISTS "HSE leaders can create contractors" ON public.contractors;
DROP POLICY IF EXISTS "Owners and HSE leaders can update contractors" ON public.contractors;
CREATE POLICY "Authorized users create contractors" ON public.contractors FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'contractors', 'create'));
CREATE POLICY "Authorized users edit contractors" ON public.contractors FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'contractors', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'contractors', 'edit'));

DROP POLICY IF EXISTS "Authenticated staff can create environmental aspects" ON public.environmental_aspects;
DROP POLICY IF EXISTS "Owners and HSE leaders can update environmental aspects" ON public.environmental_aspects;
CREATE POLICY "Authorized users create environmental aspects" ON public.environmental_aspects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'environment', 'create'));
CREATE POLICY "Authorized users edit environmental aspects" ON public.environmental_aspects FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'environment', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'environment', 'edit'));

DROP POLICY IF EXISTS "Signed-in staff can report hazards" ON public.hazards;
DROP POLICY IF EXISTS "Owners and HSE team can update hazards" ON public.hazards;
CREATE POLICY "Authorized users create hazards" ON public.hazards FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by AND public.has_module_permission(auth.uid(), 'hazards', 'create'));
CREATE POLICY "Authorized users edit hazards" ON public.hazards FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'hazards', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'hazards', 'edit'));

DROP POLICY IF EXISTS "Authenticated staff can create documents" ON public.hse_documents;
DROP POLICY IF EXISTS "Owners and HSE leaders can update documents" ON public.hse_documents;
CREATE POLICY "Authorized users create documents" ON public.hse_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'documents', 'create'));
CREATE POLICY "Authorized users edit documents" ON public.hse_documents FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'documents', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'documents', 'edit'));

DROP POLICY IF EXISTS "Signed-in staff can create HSE objectives" ON public.hse_objectives;
DROP POLICY IF EXISTS "Creators and HSE managers can update HSE objectives" ON public.hse_objectives;
CREATE POLICY "Authorized users create objectives" ON public.hse_objectives FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'objectives', 'create'));
CREATE POLICY "Authorized users edit objectives" ON public.hse_objectives FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'objectives', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'objectives', 'edit'));

DROP POLICY IF EXISTS "Employees can report incidents" ON public.incidents;
DROP POLICY IF EXISTS "Record owners and HSE managers can update incidents" ON public.incidents;
CREATE POLICY "Authorized users create incidents" ON public.incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by AND public.has_module_permission(auth.uid(), 'incidents', 'create'));
CREATE POLICY "Authorized users edit incidents" ON public.incidents FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'incidents', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'incidents', 'edit'));

DROP POLICY IF EXISTS "Signed-in staff can create inspections" ON public.inspections;
DROP POLICY IF EXISTS "Creators and HSE managers can update inspections" ON public.inspections;
CREATE POLICY "Authorized users create inspections" ON public.inspections FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'inspections', 'create'));
CREATE POLICY "Authorized users edit inspections" ON public.inspections FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'inspections', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'inspections', 'edit'));

DROP POLICY IF EXISTS "Authenticated staff can create legal requirements" ON public.legal_requirements;
DROP POLICY IF EXISTS "Owners and HSE leaders can update legal requirements" ON public.legal_requirements;
CREATE POLICY "Authorized users create legal requirements" ON public.legal_requirements FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'legal', 'create'));
CREATE POLICY "Authorized users edit legal requirements" ON public.legal_requirements FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'legal', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'legal', 'edit'));

DROP POLICY IF EXISTS "Authenticated staff can create management reviews" ON public.management_reviews;
DROP POLICY IF EXISTS "Owners and HSE leaders can update management reviews" ON public.management_reviews;
CREATE POLICY "Authorized users create management reviews" ON public.management_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'reviews', 'create'));
CREATE POLICY "Authorized users edit management reviews" ON public.management_reviews FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'reviews', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'reviews', 'edit'));

DROP POLICY IF EXISTS "Signed-in staff can report near misses" ON public.near_misses;
DROP POLICY IF EXISTS "Creators and HSE team can update near misses" ON public.near_misses;
CREATE POLICY "Authorized users create near misses" ON public.near_misses FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by AND public.has_module_permission(auth.uid(), 'near_misses', 'create'));
CREATE POLICY "Authorized users edit near misses" ON public.near_misses FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'near_misses', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'near_misses', 'edit'));

DROP POLICY IF EXISTS "Authenticated staff can create PPE issuances" ON public.ppe_issuances;
DROP POLICY IF EXISTS "Owners and HSE leaders can update PPE issuances" ON public.ppe_issuances;
CREATE POLICY "Authorized users create PPE issuances" ON public.ppe_issuances FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'ppe', 'create'));
CREATE POLICY "Authorized users edit PPE issuances" ON public.ppe_issuances FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'ppe', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'ppe', 'edit'));

DROP POLICY IF EXISTS "Employees can add risks" ON public.risk_assessments;
DROP POLICY IF EXISTS "Record owners and HSE managers can update risks" ON public.risk_assessments;
CREATE POLICY "Authorized users create risks" ON public.risk_assessments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'risks', 'create'));
CREATE POLICY "Authorized users edit risks" ON public.risk_assessments FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'risks', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'risks', 'edit'));

DROP POLICY IF EXISTS "Signed-in staff can add observations" ON public.safety_observations;
DROP POLICY IF EXISTS "Creators and HSE team can update observations" ON public.safety_observations;
CREATE POLICY "Authorized users create observations" ON public.safety_observations FOR INSERT TO authenticated WITH CHECK (auth.uid() = observed_by AND public.has_module_permission(auth.uid(), 'observations', 'create'));
CREATE POLICY "Authorized users edit observations" ON public.safety_observations FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'observations', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'observations', 'edit'));

DROP POLICY IF EXISTS "Employees can add training" ON public.training_records;
DROP POLICY IF EXISTS "Record owners and HSE managers can update training" ON public.training_records;
CREATE POLICY "Authorized users create training" ON public.training_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND public.has_module_permission(auth.uid(), 'training', 'create'));
CREATE POLICY "Authorized users edit training" ON public.training_records FOR UPDATE TO authenticated USING (public.has_module_permission(auth.uid(), 'training', 'edit')) WITH CHECK (public.has_module_permission(auth.uid(), 'training', 'edit'));