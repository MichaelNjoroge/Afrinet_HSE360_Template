CREATE OR REPLACE FUNCTION public.hse_objective_achievement(_baseline numeric, _target numeric, _current numeric, _direction text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT round(CASE
    WHEN _direction = 'decrease' AND _baseline <> _target THEN ((_baseline - _current) / (_baseline - _target)) * 100
    WHEN _direction = 'increase' AND _target <> _baseline THEN ((_current - _baseline) / (_target - _baseline)) * 100
    WHEN _current = _target THEN 100
    ELSE 0
  END, 1)
$$;

CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  inspection_type text NOT NULL CHECK (inspection_type IN ('workplace','vehicle','warehouse','office','ppe','fire_safety')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  site text NOT NULL DEFAULT 'Thika' CHECK (char_length(site) BETWEEN 2 AND 120),
  department text NOT NULL CHECK (char_length(department) BETWEEN 2 AND 120),
  area text NOT NULL CHECK (char_length(area) BETWEEN 2 AND 200),
  scheduled_on date NOT NULL,
  inspector_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','closed')),
  summary text CHECK (summary IS NULL OR char_length(summary) <= 4000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view inspections" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can create inspections" ON public.inspections FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators and HSE managers can update inspections" ON public.inspections FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE managers can delete inspections" ON public.inspections FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER set_inspections_updated_at BEFORE UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX inspections_schedule_idx ON public.inspections (scheduled_on, status);

CREATE TABLE public.inspection_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  item_order integer NOT NULL DEFAULT 1 CHECK (item_order BETWEEN 1 AND 500),
  requirement text NOT NULL CHECK (char_length(requirement) BETWEEN 2 AND 1000),
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','pass','fail','not_applicable')),
  observation text CHECK (observation IS NULL OR char_length(observation) <= 2000),
  action_id uuid REFERENCES public.actions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_checklist_items TO authenticated;
GRANT ALL ON public.inspection_checklist_items TO service_role;
ALTER TABLE public.inspection_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view inspection items" ON public.inspection_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can create inspection items" ON public.inspection_checklist_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators and HSE managers can update inspection items" ON public.inspection_checklist_items FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE managers can delete inspection items" ON public.inspection_checklist_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER set_inspection_items_updated_at BEFORE UPDATE ON public.inspection_checklist_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX inspection_items_inspection_idx ON public.inspection_checklist_items (inspection_id, item_order);

CREATE TABLE public.hse_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  objective text NOT NULL CHECK (char_length(objective) BETWEEN 2 AND 500),
  kpi text NOT NULL CHECK (char_length(kpi) BETWEEN 2 AND 300),
  baseline numeric NOT NULL,
  target numeric NOT NULL,
  current_performance numeric NOT NULL,
  direction text NOT NULL DEFAULT 'increase' CHECK (direction IN ('increase','decrease')),
  achievement_percent numeric GENERATED ALWAYS AS (public.hse_objective_achievement(baseline, target, current_performance, direction)) STORED,
  rag_status text GENERATED ALWAYS AS (CASE WHEN public.hse_objective_achievement(baseline, target, current_performance, direction) >= 90 THEN 'green' WHEN public.hse_objective_achievement(baseline, target, current_performance, direction) >= 70 THEN 'amber' ELSE 'red' END) STORED,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  review_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','closed')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_objectives TO authenticated;
GRANT ALL ON public.hse_objectives TO service_role;
ALTER TABLE public.hse_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in staff can view HSE objectives" ON public.hse_objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in staff can create HSE objectives" ON public.hse_objectives FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators and HSE managers can update HSE objectives" ON public.hse_objectives FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')) WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE POLICY "HSE managers can delete HSE objectives" ON public.hse_objectives FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));
CREATE TRIGGER set_hse_objectives_updated_at BEFORE UPDATE ON public.hse_objectives FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX hse_objectives_review_idx ON public.hse_objectives (review_date, status);

ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_source_type_check;
ALTER TABLE public.actions ADD CONSTRAINT actions_source_type_check CHECK (source_type IN ('incident','hazard','observation','near_miss','risk','audit','inspection','management_review','other'));

ALTER TABLE public.workflow_events DROP CONSTRAINT IF EXISTS workflow_events_module_check;
ALTER TABLE public.workflow_events ADD CONSTRAINT workflow_events_module_check CHECK (module IN ('incident','hazard','observation','near_miss','risk','audit','capa','inspection','objective','training'));