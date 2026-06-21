CREATE OR REPLACE FUNCTION public.advance_report_run(_current timestamptz, _cadence text, _weekday smallint, _hour smallint, _timezone text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  _zone text;
  _local_now timestamp;
  _candidate_local timestamp;
  _days integer;
BEGIN
  SELECT name INTO _zone FROM pg_timezone_names WHERE name = _timezone LIMIT 1;
  IF _zone IS NULL THEN
    RAISE EXCEPTION 'Unsupported report timezone';
  END IF;

  _local_now := GREATEST(_current, now()) AT TIME ZONE _zone;

  IF _cadence = 'daily' THEN
    _candidate_local := date_trunc('day', _local_now) + make_interval(hours => _hour);
    IF _candidate_local <= _local_now THEN
      _candidate_local := _candidate_local + interval '1 day';
    END IF;
  ELSIF _cadence = 'weekly' THEN
    _days := ((_weekday::integer - extract(dow from _local_now)::integer + 7) % 7);
    _candidate_local := date_trunc('day', _local_now) + make_interval(days => _days, hours => _hour);
    IF _candidate_local <= _local_now THEN
      _candidate_local := _candidate_local + interval '7 days';
    END IF;
  ELSIF _cadence = 'monthly' THEN
    _candidate_local := date_trunc('month', _local_now) + make_interval(hours => _hour);
    IF _candidate_local <= _local_now THEN
      _candidate_local := _candidate_local + interval '1 month';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported report cadence';
  END IF;

  RETURN _candidate_local AT TIME ZONE _zone;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_report_run(timestamptz, text, smallint, smallint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_report_run(timestamptz, text, smallint, smallint, text) TO service_role;

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
        'summary', 'Scheduled HSE report draft generated for secure review.'
      );

      INSERT INTO public.generated_reports(report_number, module, title, report_data, status, generated_by)
      VALUES (_report_number, _subscription.module, initcap(replace(_subscription.module, '_', ' ')) || ' scheduled report', _payload, 'draft', _subscription.created_by)
      RETURNING id INTO _report_id;

      FOREACH _recipient IN ARRAY _subscription.recipients LOOP
        PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
          'message_id', gen_random_uuid(),
          'to', lower(_recipient),
          'from', 'prosel-safety-hub <noreply@prosellimited.com>',
          'sender_domain', 'notify.prosellimited.com',
          'subject', initcap(replace(_subscription.module, '_', ' ')) || ' HSE report draft ' || _report_number,
          'html', '<p>Your scheduled HSE report draft <strong>' || _report_number || '</strong> is ready. Sign in to Afrinet HSE360 to review and approve it before official use.</p>',
          'text', 'Your scheduled HSE report draft ' || _report_number || ' is ready. Sign in to Afrinet HSE360 to review and approve it before official use.',
          'purpose', 'transactional',
          'label', 'hse-report',
          'idempotency_key', 'scheduled-report-' || _subscription.id || '-' || _subscription.next_run_at::text || '-' || lower(_recipient),
          'queued_at', now()
        ));
      END LOOP;

      UPDATE public.report_subscriptions
      SET last_run_at = now(),
          next_run_at = public.advance_report_run(next_run_at, cadence, weekday, hour_utc, timezone),
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

DROP FUNCTION IF EXISTS public.advance_report_run(timestamptz, text, smallint, smallint);