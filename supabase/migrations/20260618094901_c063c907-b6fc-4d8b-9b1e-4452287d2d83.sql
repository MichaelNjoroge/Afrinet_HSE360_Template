CREATE OR REPLACE FUNCTION public.get_reporting_index(_window_months integer DEFAULT 12)
 RETURNS TABLE(user_id uuid, full_name text, department text, job_title text, module text, month date, reports_count bigint, user_total bigint, user_rank bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
    COALESCE(
      NULLIF(trim(e.full_name), ''),
      NULLIF(trim(prof.full_name), ''),
      NULLIF(initcap(regexp_replace(split_part(au.email, '@', 1), '[._-]+', ' ', 'g')), ''),
      'Team member'
    ) AS full_name,
    COALESCE(e.department, NULL) AS department,
    COALESCE(e.job_title, NULL) AS job_title,
    p.module,
    p.month,
    p.reports_count,
    r.total AS user_total,
    r.user_rank
  FROM per_user_module_month p
  JOIN ranked r ON r.actor_user_id = p.actor_user_id
  LEFT JOIN public.employees e ON e.user_id = p.actor_user_id
  LEFT JOIN public.profiles prof ON prof.id = p.actor_user_id
  LEFT JOIN auth.users au ON au.id = p.actor_user_id
  ORDER BY r.user_rank, p.actor_user_id, p.module, p.month;
$function$;
