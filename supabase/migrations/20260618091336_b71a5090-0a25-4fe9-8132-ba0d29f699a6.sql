CREATE OR REPLACE FUNCTION public.recompute_hse_objective_rag(_objective_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total_target numeric;
  _total_actual numeric;
  _has_any_actual boolean;
  _ach numeric;
  _rag text;
  _fallback_target numeric;
  _fallback_current numeric;
BEGIN
  SELECT target, current_performance
    INTO _fallback_target, _fallback_current
    FROM public.hse_objectives WHERE id = _objective_id;

  SELECT
    COALESCE(SUM(target_value), 0),
    COALESCE(SUM(COALESCE(actual_value, 0)), 0),
    bool_or(actual_value IS NOT NULL)
  INTO _total_target, _total_actual, _has_any_actual
  FROM public.hse_objective_monthly_progress
  WHERE objective_id = _objective_id;

  IF COALESCE(_has_any_actual, false) AND _total_target > 0 THEN
    _ach := ROUND((_total_actual / _total_target) * 100);
  ELSIF _fallback_target IS NOT NULL AND _fallback_target <> 0 AND _fallback_current IS NOT NULL THEN
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
$function$;

-- Backfill all existing objectives with the corrected formula
DO $$
DECLARE _id uuid;
BEGIN
  FOR _id IN SELECT id FROM public.hse_objectives LOOP
    PERFORM public.recompute_hse_objective_rag(_id);
  END LOOP;
END $$;