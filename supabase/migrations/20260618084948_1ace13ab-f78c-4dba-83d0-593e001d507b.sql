
-- Make achievement_percent / rag_status reflect the SUM(actual)/SUM(target) bottom-row figure
-- from hse_objective_monthly_progress instead of the single current_performance vs target value.

-- 1) Drop generated columns and replace with regular columns
ALTER TABLE public.hse_objectives DROP COLUMN IF EXISTS rag_status;
ALTER TABLE public.hse_objectives DROP COLUMN IF EXISTS achievement_percent;
ALTER TABLE public.hse_objectives ADD COLUMN achievement_percent numeric;
ALTER TABLE public.hse_objectives ADD COLUMN rag_status text;

-- 2) Recompute function: bottom % = sum(actual) / sum(target) * 100 across all monthly rows
CREATE OR REPLACE FUNCTION public.recompute_hse_objective_rag(_objective_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_target numeric;
  _total_actual numeric;
  _ach numeric;
  _rag text;
  _direction text;
  _fallback_target numeric;
  _fallback_current numeric;
BEGIN
  SELECT direction, target, current_performance
    INTO _direction, _fallback_target, _fallback_current
    FROM public.hse_objectives WHERE id = _objective_id;

  SELECT
    COALESCE(SUM(target_value), 0),
    COALESCE(SUM(actual_value), 0)
  INTO _total_target, _total_actual
  FROM public.hse_objective_monthly_progress
  WHERE objective_id = _objective_id
    AND actual_value IS NOT NULL;

  IF _total_target > 0 THEN
    _ach := ROUND((_total_actual / _total_target) * 100);
  ELSIF _fallback_target IS NOT NULL AND _fallback_target <> 0 AND _fallback_current IS NOT NULL THEN
    -- Fallback for objectives with no monthly entries yet
    _ach := ROUND((_fallback_current / _fallback_target) * 100);
  ELSE
    _ach := NULL;
  END IF;

  IF _ach IS NULL THEN
    _rag := NULL;
  ELSIF _ach >= 90 THEN
    _rag := 'green';
  ELSIF _ach >= 70 THEN
    _rag := 'amber';
  ELSE
    _rag := 'red';
  END IF;

  UPDATE public.hse_objectives
     SET achievement_percent = _ach,
         rag_status = _rag
   WHERE id = _objective_id;
END;
$$;

-- 3) Trigger on monthly progress changes
CREATE OR REPLACE FUNCTION public.trg_recompute_objective_rag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_hse_objective_rag(OLD.objective_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_hse_objective_rag(NEW.objective_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS recompute_objective_rag_aiud ON public.hse_objective_monthly_progress;
CREATE TRIGGER recompute_objective_rag_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.hse_objective_monthly_progress
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_objective_rag();

-- 4) Trigger on objective changes (so fallback updates when target/current_performance edited)
CREATE OR REPLACE FUNCTION public.trg_recompute_objective_rag_self()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_hse_objective_rag(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recompute_objective_rag_self ON public.hse_objectives;
CREATE TRIGGER recompute_objective_rag_self
AFTER INSERT OR UPDATE OF target, current_performance, baseline, direction ON public.hse_objectives
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_objective_rag_self();

-- 5) Backfill existing objectives
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.hse_objectives LOOP
    PERFORM public.recompute_hse_objective_rag(r.id);
  END LOOP;
END $$;
