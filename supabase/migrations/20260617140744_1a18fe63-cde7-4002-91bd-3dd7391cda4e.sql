
-- Safety Committee meetings, signatories (up to 10), and schedule
CREATE TABLE public.safety_committee_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_number text,
  title text not null,
  meeting_date timestamptz not null,
  location text,
  chairperson text,
  secretary text,
  agenda text,
  minutes text,
  decisions text,
  next_meeting_at timestamptz,
  status text not null default 'planned' check (status in ('planned','held','cancelled','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_committee_meetings TO authenticated;
GRANT ALL ON public.safety_committee_meetings TO service_role;
ALTER TABLE public.safety_committee_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Level 4+ can view meetings" ON public.safety_committee_meetings FOR SELECT TO authenticated USING (public.user_auth_level(auth.uid()) >= 4);
CREATE POLICY "Level 4+ can insert meetings" ON public.safety_committee_meetings FOR INSERT TO authenticated WITH CHECK (public.user_auth_level(auth.uid()) >= 4);
CREATE POLICY "Level 4+ can update meetings" ON public.safety_committee_meetings FOR UPDATE TO authenticated USING (public.user_auth_level(auth.uid()) >= 4) WITH CHECK (public.user_auth_level(auth.uid()) >= 4);
CREATE POLICY "Admins can delete meetings" ON public.safety_committee_meetings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER set_safety_committee_meetings_updated_at BEFORE UPDATE ON public.safety_committee_meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.safety_committee_signatories (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.safety_committee_meetings(id) on delete cascade,
  signatory_position smallint not null check (signatory_position between 1 and 10),
  full_name text not null,
  role_title text,
  signed_at timestamptz,
  signature_note text,
  created_at timestamptz not null default now(),
  unique (meeting_id, signatory_position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_committee_signatories TO authenticated;
GRANT ALL ON public.safety_committee_signatories TO service_role;
ALTER TABLE public.safety_committee_signatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Level 4+ can view signatories" ON public.safety_committee_signatories FOR SELECT TO authenticated USING (public.user_auth_level(auth.uid()) >= 4);
CREATE POLICY "Level 4+ can manage signatories" ON public.safety_committee_signatories FOR ALL TO authenticated USING (public.user_auth_level(auth.uid()) >= 4) WITH CHECK (public.user_auth_level(auth.uid()) >= 4);

-- Emergency Response drills/events
CREATE TABLE public.emergency_response_records (
  id uuid primary key default gen_random_uuid(),
  reference text,
  record_type text not null default 'drill' check (record_type in ('drill','incident_response','readiness_check','post_event_review')),
  scenario text not null,
  location text,
  occurred_at timestamptz not null,
  participants integer,
  response_time_minutes integer,
  outcome text,
  lessons_learned text,
  performance_rating text check (performance_rating in ('excellent','good','satisfactory','needs_improvement','poor')),
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_response_records TO authenticated;
GRANT ALL ON public.emergency_response_records TO service_role;
ALTER TABLE public.emergency_response_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Level 4+ can view emergency records" ON public.emergency_response_records FOR SELECT TO authenticated USING (public.user_auth_level(auth.uid()) >= 4);
CREATE POLICY "Level 4+ can insert emergency records" ON public.emergency_response_records FOR INSERT TO authenticated WITH CHECK (public.user_auth_level(auth.uid()) >= 4);
CREATE POLICY "Level 4+ can update emergency records" ON public.emergency_response_records FOR UPDATE TO authenticated USING (public.user_auth_level(auth.uid()) >= 4) WITH CHECK (public.user_auth_level(auth.uid()) >= 4);
CREATE POLICY "Admins can delete emergency records" ON public.emergency_response_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER set_emergency_response_records_updated_at BEFORE UPDATE ON public.emergency_response_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
