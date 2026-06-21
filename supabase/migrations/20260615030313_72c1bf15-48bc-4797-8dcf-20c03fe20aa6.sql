DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'incidents','hazards','safety_observations','near_misses','risk_assessments','audits','actions',
    'employees','inspections','inspection_checklist_items','inspection_reports','training_records',
    'competency_records','hse_objectives','legal_requirements','contractors','contractor_risk_assessments',
    'permits_to_work','environmental_aspects','environmental_waste_records','environmental_resource_records',
    'environmental_emission_records','ppe_issuances','ppe_inspections','hse_documents','hse_document_versions',
    'management_reviews','evidence_attachments','company_report_settings','generated_reports','report_subscriptions',
    'notifications'
  ] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "Module viewers read incidents" ON public.incidents FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'incidents', 'view'));
CREATE POLICY "Module viewers read hazards" ON public.hazards FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'hazards', 'view'));
CREATE POLICY "Module viewers read observations" ON public.safety_observations FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'observations', 'view'));
CREATE POLICY "Module viewers read near misses" ON public.near_misses FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'near_misses', 'view'));
CREATE POLICY "Module viewers read risks" ON public.risk_assessments FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'risks', 'view'));
CREATE POLICY "Module viewers read audits" ON public.audits FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'audits', 'view'));
CREATE POLICY "Module viewers read CAPA" ON public.actions FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'capa', 'view'));
CREATE POLICY "Employee directory viewers read employees" ON public.employees FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'employees', 'view'));
CREATE POLICY "Module viewers read inspections" ON public.inspections FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'inspections', 'view'));
CREATE POLICY "Module viewers read inspection items" ON public.inspection_checklist_items FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'inspections', 'view'));
CREATE POLICY "Module viewers read inspection reports" ON public.inspection_reports FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'inspections', 'view'));
CREATE POLICY "Module viewers read training" ON public.training_records FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'training', 'view'));
CREATE POLICY "Module viewers read competencies" ON public.competency_records FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'competencies', 'view'));
CREATE POLICY "Module viewers read objectives" ON public.hse_objectives FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'objectives', 'view'));
CREATE POLICY "Module viewers read legal requirements" ON public.legal_requirements FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'legal', 'view'));
CREATE POLICY "Module viewers read contractors" ON public.contractors FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'contractors', 'view'));
CREATE POLICY "Module viewers read contractor assessments" ON public.contractor_risk_assessments FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'contractors', 'view'));
CREATE POLICY "Module viewers read permits" ON public.permits_to_work FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'contractors', 'view'));
CREATE POLICY "Module viewers read environmental aspects" ON public.environmental_aspects FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'environment', 'view'));
CREATE POLICY "Module viewers read environmental waste" ON public.environmental_waste_records FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'environment', 'view'));
CREATE POLICY "Module viewers read environmental resources" ON public.environmental_resource_records FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'environment', 'view'));
CREATE POLICY "Module viewers read environmental emissions" ON public.environmental_emission_records FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'environment', 'view'));
CREATE POLICY "Module viewers read PPE issuances" ON public.ppe_issuances FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'ppe', 'view'));
CREATE POLICY "Module viewers read PPE inspections" ON public.ppe_inspections FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'ppe', 'view'));
CREATE POLICY "Module viewers read documents" ON public.hse_documents FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'documents', 'view'));
CREATE POLICY "Module viewers read document versions" ON public.hse_document_versions FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'documents', 'view'));
CREATE POLICY "Module viewers read management reviews" ON public.management_reviews FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'reviews', 'view'));
CREATE POLICY "Module viewers read evidence metadata" ON public.evidence_attachments FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), module, 'view'));
CREATE POLICY "Reporting viewers read report settings" ON public.company_report_settings FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'reporting', 'view'));
CREATE POLICY "Reporting viewers read generated reports" ON public.generated_reports FOR SELECT TO authenticated USING (public.has_module_permission(auth.uid(), 'reporting', 'view') AND public.has_module_permission(auth.uid(), module, 'view'));
CREATE POLICY "Admins read report subscriptions" ON public.report_subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own notifications with module access" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid() AND public.has_module_permission(auth.uid(), 'notifications', 'view'));

GRANT SELECT ON public.incidents, public.hazards, public.safety_observations, public.near_misses, public.risk_assessments, public.audits, public.actions, public.employees, public.inspections, public.inspection_checklist_items, public.inspection_reports, public.training_records, public.competency_records, public.hse_objectives, public.legal_requirements, public.contractors, public.contractor_risk_assessments, public.permits_to_work, public.environmental_aspects, public.environmental_waste_records, public.environmental_resource_records, public.environmental_emission_records, public.ppe_issuances, public.ppe_inspections, public.hse_documents, public.hse_document_versions, public.management_reviews, public.evidence_attachments, public.company_report_settings, public.generated_reports, public.report_subscriptions, public.notifications TO authenticated;
GRANT ALL ON public.incidents, public.hazards, public.safety_observations, public.near_misses, public.risk_assessments, public.audits, public.actions, public.employees, public.inspections, public.inspection_checklist_items, public.inspection_reports, public.training_records, public.competency_records, public.hse_objectives, public.legal_requirements, public.contractors, public.contractor_risk_assessments, public.permits_to_work, public.environmental_aspects, public.environmental_waste_records, public.environmental_resource_records, public.environmental_emission_records, public.ppe_issuances, public.ppe_inspections, public.hse_documents, public.hse_document_versions, public.management_reviews, public.evidence_attachments, public.company_report_settings, public.generated_reports, public.report_subscriptions, public.notifications TO service_role;