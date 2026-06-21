
CREATE OR REPLACE FUNCTION public.purge_old_operational_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
  _deleted integer := 0;
  _n integer;
BEGIN
  WITH d AS (DELETE FROM public.email_send_log WHERE status = 'sent' AND created_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*) INTO _n FROM d; _deleted := _deleted + _n;

  WITH d AS (DELETE FROM public.email_send_log WHERE status IN ('failed','dlq','suppressed') AND created_at < now() - interval '180 days' RETURNING 1)
  SELECT count(*) INTO _n FROM d; _deleted := _deleted + _n;

  WITH d AS (DELETE FROM public.generated_reports WHERE status = 'draft' AND created_at < now() - interval '180 days' RETURNING 1)
  SELECT count(*) INTO _n FROM d; _deleted := _deleted + _n;

  WITH d AS (DELETE FROM public.email_unsubscribe_tokens WHERE used_at IS NOT NULL AND used_at < now() - interval '365 days' RETURNING 1)
  SELECT count(*) INTO _n FROM d; _deleted := _deleted + _n;

  WITH d AS (DELETE FROM public.public_endpoint_rate_limits WHERE window_started_at < now() - interval '2 days' RETURNING 1)
  SELECT count(*) INTO _n FROM d; _deleted := _deleted + _n;

  RETURN _deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_operational_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_operational_data() TO service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-operational-data') THEN
      PERFORM cron.unschedule('purge-old-operational-data');
    END IF;
    PERFORM cron.schedule('purge-old-operational-data','17 3 * * *', $c$SELECT public.purge_old_operational_data();$c$);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_status_created ON public.email_send_log(status, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status_created ON public.generated_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_events_created_at ON public.workflow_events(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_events_module_record ON public.workflow_events(module, record_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_actor_created ON public.user_activity_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.notifications(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.public_endpoint_rate_limits(window_started_at);
