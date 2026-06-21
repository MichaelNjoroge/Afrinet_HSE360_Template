CREATE OR REPLACE FUNCTION public.recompute_hse_objective_rag(_objective_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_target numeric;
  v_total_target numeric;
  v_total_actual numeric;
  v_pct numeric;
  v_rag text;
  v_year integer := EXTRACT(YEAR FROM now())::int;
BEGIN
  SELECT target INTO v_default_target FROM public.hse_objectives WHERE id = _objective_id;

  -- For each of 12 months in current year, use saved target or fall back to objective.target;
  -- actual defaults to 0 when not entered. Matches the UI's Total / Achievement row.
  SELECT
    COALESCE(SUM(COALESCE(p.target_value, v_default_target)), 0),
    COALESCE(SUM(COALESCE(p.actual_value, 0)), 0)
  INTO v_total_target, v_total_actual
  FROM generate_series(1, 12) AS m(month)
  LEFT JOIN public.hse_objective_monthly_progress p
    ON p.objective_id = _objective_id AND p.year = v_year AND p.month = m.month;

  IF v_total_target > 0 THEN
    v_pct := ROUND((v_total_actual / v_total_target) * 100);
  ELSE
    v_pct := NULL;
  END IF;

  IF v_pct IS NULL THEN
    v_rag := NULL;
  ELSIF v_pct >= 90 THEN
    v_rag := 'green';
  ELSIF v_pct >= 70 THEN
    v_rag := 'amber';
  ELSE
    v_rag := 'red';
  END IF;

  UPDATE public.hse_objectives
  SET achievement_percent = v_pct,
      rag_status = v_rag,
      updated_at = now()
  WHERE id = _objective_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_hse_objective_rag(uuid) FROM PUBLIC, anon, authenticated;

-- Backfill all objectives
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.hse_objectives LOOP
    PERFORM public.recompute_hse_objective_rag(r.id);
  END LOOP;
END $$;