-- Phase 4 — reporting activity view + leaderboard / history RPCs

-- 1) Activity view: union of all "I reported this" actions across modules.
--    SECURITY INVOKER -> existing per-module RLS still hides rows the caller
--    cannot see. Actor is the user_id who created/reported the record.
CREATE OR REPLACE VIEW public.v_reporting_activity
WITH (security_invoker = true) AS
  SELECT 'incidents'::text         AS module, i.reported_by  AS actor_user_id, i.created_at FROM public.incidents i           WHERE i.reported_by  IS NOT NULL
UNION ALL
  SELECT 'near_misses'::text       AS module, n.reported_by  AS actor_user_id, n.created_at FROM public.near_misses n         WHERE n.reported_by  IS NOT NULL
UNION ALL
  SELECT 'observations'::text      AS module, o.observed_by  AS actor_user_id, o.created_at FROM public.safety_observations o WHERE o.observed_by  IS NOT NULL
UNION ALL
  SELECT 'hazards'::text           AS module, h.reported_by  AS actor_user_id, h.created_at FROM public.hazards h             WHERE h.reported_by  IS NOT NULL
UNION ALL
  SELECT 'ppe_inspections'::text   AS module, p.created_by   AS actor_user_id, p.created_at FROM public.ppe_inspections p     WHERE p.created_by   IS NOT NULL
UNION ALL
  SELECT 'inspections'::text       AS module, ins.created_by AS actor_user_id, ins.created_at FROM public.inspections ins     WHERE ins.created_by IS NOT NULL
UNION ALL
  SELECT 'audits'::text            AS module, a.created_by   AS actor_user_id, a.created_at FROM public.audits a              WHERE a.created_by   IS NOT NULL
UNION ALL
  SELECT 'capa'::text              AS module, ac.created_by  AS actor_user_id, ac.created_at FROM public.actions ac           WHERE ac.created_by  IS NOT NULL;

GRANT SELECT ON public.v_reporting_activity TO authenticated;

-- 2) Reporting leaderboard: one row per (user, module, month) plus a total
--    and the user's overall rank. Returns last _window_months months.
CREATE OR REPLACE FUNCTION public.get_reporting_index(_window_months integer DEFAULT 12)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  department text,
  job_title text,
  module text,
  month date,
  reports_count bigint,
  user_total bigint,
  user_rank bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $$
  WITH window_bounds AS (
    SELECT date_trunc('month', now())::date - (GREATEST(_window_months, 1) - 1) AS start_month
  ),
  activity AS (
    SELECT a.actor_user_id, a.module, date_trunc('month', a.created_at)::date AS month
    FROM public.v_reporting_activity a, window_bounds wb
    WHERE a.created_at >= wb.start_month
  ),
  per_user_module_month AS (
    SELECT actor_user_id, module, month, count(*)::bigint AS reports_count
    FROM activity
    GROUP BY actor_user_id, module, month
  ),
  per_user_total AS (
    SELECT actor_user_id, count(*)::bigint AS total
    FROM activity GROUP BY actor_user_id
  ),
  ranked AS (
    SELECT actor_user_id, total,
           rank() OVER (ORDER BY total DESC, actor_user_id) AS user_rank
    FROM per_user_total
  )
  SELECT
    p.actor_user_id AS user_id,
    e.full_name,
    e.department,
    e.job_title,
    p.module,
    p.month,
    p.reports_count,
    r.total AS user_total,
    r.user_rank
  FROM per_user_module_month p
  JOIN ranked r ON r.actor_user_id = p.actor_user_id
  LEFT JOIN public.employees e ON e.user_id = p.actor_user_id
  ORDER BY r.user_rank, p.actor_user_id, p.module, p.month;
$$;

REVOKE EXECUTE ON FUNCTION public.get_reporting_index(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_reporting_index(integer) TO authenticated;

-- 3) Per-employee history: monthly counts per module for one person.
CREATE OR REPLACE FUNCTION public.get_employee_reporting_history(_user_id uuid, _window_months integer DEFAULT 12)
RETURNS TABLE(module text, month date, reports_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $$
  WITH window_bounds AS (
    SELECT date_trunc('month', now())::date - (GREATEST(_window_months, 1) - 1) AS start_month
  )
  SELECT a.module, date_trunc('month', a.created_at)::date AS month, count(*)::bigint AS reports_count
  FROM public.v_reporting_activity a, window_bounds wb
  WHERE a.actor_user_id = _user_id AND a.created_at >= wb.start_month
  GROUP BY a.module, date_trunc('month', a.created_at)
  ORDER BY month, module;
$$;

REVOKE EXECUTE ON FUNCTION public.get_employee_reporting_history(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_employee_reporting_history(uuid, integer) TO authenticated;