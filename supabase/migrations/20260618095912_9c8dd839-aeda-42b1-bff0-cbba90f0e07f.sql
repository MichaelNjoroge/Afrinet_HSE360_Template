CREATE TABLE public.audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  executive_summary text NOT NULL CHECK (char_length(executive_summary) BETWEEN 1 AND 12000),
  findings text NOT NULL CHECK (char_length(findings) BETWEEN 1 AND 20000),
  recommendations text NOT NULL CHECK (char_length(recommendations) BETWEEN 1 AND 20000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  generated_by uuid NOT NULL DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_reports TO authenticated;
GRANT ALL ON public.audit_reports TO service_role;

ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Module viewers read audit reports"
  ON public.audit_reports FOR SELECT TO authenticated
  USING (public.has_module_permission(auth.uid(), 'audits', 'view'));

CREATE POLICY "Audit managers create reports"
  ON public.audit_reports FOR INSERT TO authenticated
  WITH CHECK (
    generated_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'hse_manager') OR
      public.has_role(auth.uid(), 'hse_coordinator') OR
      public.has_role(auth.uid(), 'auditor') OR
      public.has_role(auth.uid(), 'supervisor')
    )
  );

CREATE POLICY "Audit managers update reports"
  ON public.audit_reports FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'hse_manager') OR
    public.has_role(auth.uid(), 'hse_coordinator') OR
    public.has_role(auth.uid(), 'auditor') OR
    public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'hse_manager') OR
    public.has_role(auth.uid(), 'hse_coordinator') OR
    public.has_role(auth.uid(), 'auditor') OR
    public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Admins delete draft audit reports"
  ON public.audit_reports FOR DELETE TO authenticated
  USING (status = 'draft' AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_audit_reports_updated_at
  BEFORE UPDATE ON public.audit_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX audit_reports_audit_idx ON public.audit_reports(audit_id, version DESC);