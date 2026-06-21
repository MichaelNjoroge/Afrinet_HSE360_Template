CREATE TABLE public.hse_objective_monthly_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.hse_objectives(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_value numeric,
  actual_value numeric,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (objective_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hse_objective_monthly_progress TO authenticated;
GRANT ALL ON public.hse_objective_monthly_progress TO service_role;

ALTER TABLE public.hse_objective_monthly_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read monthly progress"
  ON public.hse_objective_monthly_progress FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Managers manage monthly progress"
  ON public.hse_objective_monthly_progress FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  );

CREATE INDEX hse_objective_monthly_progress_objective_year_idx
  ON public.hse_objective_monthly_progress(objective_id, year);

CREATE TRIGGER set_hse_objective_monthly_progress_updated_at
  BEFORE UPDATE ON public.hse_objective_monthly_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
