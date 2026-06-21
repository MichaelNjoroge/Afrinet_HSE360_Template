CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.purge_old_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  _activity_deleted integer := 0;
  _events_deleted integer := 0;
BEGIN
  WITH d AS (
    DELETE FROM public.user_activity_logs
    WHERE created_at < now() - interval '18 months'
    RETURNING 1
  )
  SELECT count(*) INTO _activity_deleted FROM d;

  WITH d AS (
    DELETE FROM public.workflow_events
    WHERE created_at < now() - interval '18 months'
    RETURNING 1
  )
  SELECT count(*) INTO _events_deleted FROM d;

  RETURN _activity_deleted + _events_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_audit_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_audit_logs() TO service_role;

-- Unschedule any prior version, then schedule monthly on the 1st at 03:15 UTC.
DO $$
BEGIN
  PERFORM cron.unschedule('purge-old-audit-logs');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-old-audit-logs',
  '15 3 1 * *',
  $$SELECT public.purge_old_audit_logs();$$
);