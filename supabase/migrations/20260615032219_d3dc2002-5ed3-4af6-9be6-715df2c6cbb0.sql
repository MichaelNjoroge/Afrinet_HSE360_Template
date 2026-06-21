ALTER TABLE public.report_subscriptions
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.permits_to_work
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes text;

CREATE OR REPLACE FUNCTION public.validate_permit_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.valid_until <= NEW.valid_from THEN
    RAISE EXCEPTION 'Permit end must be after its start.';
  END IF;
  IF NEW.status IN ('approved','active','suspended','closed') AND (NEW.issued_by IS NULL OR NEW.issued_at IS NULL) THEN
    RAISE EXCEPTION 'A permit must be issued before work can proceed.';
  END IF;
  IF NEW.status IN ('approved','active','suspended','closed') AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'A permit must be approved before work can proceed.';
  END IF;
  IF NEW.approved_by IS NOT NULL AND NEW.approved_by = NEW.issued_by THEN
    RAISE EXCEPTION 'Permit approval must be completed by a different authorized person.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_permit_workflow_trigger ON public.permits_to_work;
CREATE TRIGGER validate_permit_workflow_trigger
BEFORE INSERT OR UPDATE ON public.permits_to_work
FOR EACH ROW EXECUTE FUNCTION public.validate_permit_workflow();

CREATE OR REPLACE FUNCTION public.advance_report_run(_current timestamptz, _cadence text, _weekday smallint, _hour smallint)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  _next timestamptz := date_trunc('hour', GREATEST(_current, now()));
  _days integer;
BEGIN
  IF _cadence = 'daily' THEN
    RETURN _next + interval '1 day';
  ELSIF _cadence = 'weekly' THEN
    _days := ((_weekday::integer - extract(dow from _next)::integer + 7) % 7);
    IF _days = 0 THEN _days := 7; END IF;
    RETURN date_trunc('day', _next) + make_interval(days => _days, hours => _hour);
  ELSIF _cadence = 'monthly' THEN
    RETURN date_trunc('month', _next) + interval '1 month' + make_interval(hours => _hour);
  END IF;
  RAISE EXCEPTION 'Unsupported report cadence';
END;
$$;

REVOKE ALL ON FUNCTION public.advance_report_run(timestamptz, text, smallint, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_report_run(timestamptz, text, smallint, smallint) TO service_role;

CREATE OR REPLACE FUNCTION public.process_due_report_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  _subscription public.report_subscriptions%ROWTYPE;
  _recipient text;
  _report_id uuid;
  _report_number text;
  _payload jsonb;
  _processed integer := 0;
BEGIN
  FOR _subscription IN
    SELECT * FROM public.report_subscriptions
    WHERE is_active = true AND next_run_at <= now()
    ORDER BY next_run_at
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      _report_number := 'RPT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8));
      _payload := jsonb_build_object(
        'module', _subscription.module,
        'generated_at', now(),
        'schedule', _subscription.cadence,
        'timezone', _subscription.timezone,
        'summary', 'Scheduled HSE report generated for secure review.'
      );

      INSERT INTO public.generated_reports(report_number, module, title, report_data, status, generated_by)
      VALUES (_report_number, _subscription.module, initcap(replace(_subscription.module, '_', ' ')) || ' scheduled report', _payload, 'approved', _subscription.created_by)
      RETURNING id INTO _report_id;

      FOREACH _recipient IN ARRAY _subscription.recipients LOOP
        PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
          'message_id', gen_random_uuid(),
          'to', lower(_recipient),
          'from', 'prosel-safety-hub <noreply@prosellimited.com>',
          'sender_domain', 'notify.prosellimited.com',
          'subject', initcap(replace(_subscription.module, '_', ' ')) || ' HSE report ' || _report_number,
          'html', '<p>Your scheduled HSE report <strong>' || _report_number || '</strong> is ready. Sign in to Afrinet HSE360 to review it securely.</p>',
          'text', 'Your scheduled HSE report ' || _report_number || ' is ready. Sign in to Afrinet HSE360 to review it securely.',
          'purpose', 'transactional',
          'label', 'hse-report',
          'idempotency_key', 'scheduled-report-' || _subscription.id || '-' || _subscription.next_run_at::text || '-' || lower(_recipient),
          'queued_at', now()
        ));
      END LOOP;

      UPDATE public.report_subscriptions
      SET last_run_at = now(),
          next_run_at = public.advance_report_run(next_run_at, cadence, weekday, hour_utc),
          failure_count = 0,
          last_error = NULL,
          updated_at = now()
      WHERE id = _subscription.id;
      _processed := _processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.report_subscriptions
      SET failure_count = failure_count + 1,
          last_error = left(SQLERRM, 1000),
          next_run_at = now() + make_interval(mins => LEAST(60, 5 * (failure_count + 1))),
          updated_at = now()
      WHERE id = _subscription.id;
    END;
  END LOOP;
  RETURN _processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_report_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_report_subscriptions() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-due-hse-reports';
    PERFORM cron.schedule('process-due-hse-reports', '*/5 * * * *', 'SELECT public.process_due_report_subscriptions()');
  END IF;
END $$;