-- Add incident-style investigation / CAPA / approval columns to environmental records
ALTER TABLE public.environmental_aspects
  ADD COLUMN IF NOT EXISTS investigation_findings text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS immediate_action text,
  ADD COLUMN IF NOT EXISTS corrective_actions text,
  ADD COLUMN IF NOT EXISTS preventive_actions text,
  ADD COLUMN IF NOT EXISTS responsible_person_id uuid,
  ADD COLUMN IF NOT EXISTS action_due_date date,
  ADD COLUMN IF NOT EXISTS lessons_learned text,
  ADD COLUMN IF NOT EXISTS closure_evidence text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.environmental_emission_records
  ADD COLUMN IF NOT EXISTS investigation_findings text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS corrective_actions text,
  ADD COLUMN IF NOT EXISTS preventive_actions text,
  ADD COLUMN IF NOT EXISTS responsible_person_id uuid,
  ADD COLUMN IF NOT EXISTS action_due_date date,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.environmental_resource_records
  ADD COLUMN IF NOT EXISTS investigation_findings text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS corrective_actions text,
  ADD COLUMN IF NOT EXISTS preventive_actions text,
  ADD COLUMN IF NOT EXISTS responsible_person_id uuid,
  ADD COLUMN IF NOT EXISTS action_due_date date,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.environmental_waste_records
  ADD COLUMN IF NOT EXISTS investigation_findings text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS corrective_actions text,
  ADD COLUMN IF NOT EXISTS preventive_actions text,
  ADD COLUMN IF NOT EXISTS responsible_person_id uuid,
  ADD COLUMN IF NOT EXISTS action_due_date date,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
