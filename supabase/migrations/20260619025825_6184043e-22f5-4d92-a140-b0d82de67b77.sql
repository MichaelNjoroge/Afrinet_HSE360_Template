
-- Ensure pgcrypto is available (Supabase installs extensions in the `extensions` schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Add `extensions` to the function's search_path AND fully-qualify the call so it works in any environment.
CREATE OR REPLACE FUNCTION public.process_due_report_subscriptions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  _subscription public.report_subscriptions%ROWTYPE;
  _recipient text;
  _normalized_recipient text;
  _report_id uuid;
  _report_number text;
  _payload jsonb;
  _processed integer := 0;
  _settings public.company_report_settings%ROWTYPE;
  _message_id uuid;
  _unsubscribe_token text;
  _report_title text;
  _subject text;
  _html text;
  _text text;
BEGIN
  SELECT * INTO _settings FROM public.company_report_settings ORDER BY updated_at DESC LIMIT 1;

  FOR _subscription IN
    SELECT * FROM public.report_subscriptions
    WHERE is_active = true AND next_run_at <= now()
    ORDER BY next_run_at FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      _report_number := 'RPT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8));
      _report_title := initcap(replace(_subscription.module, '_', ' ')) || ' scheduled report';
      _payload := jsonb_build_object(
        'module', _subscription.module, 'generated_at', now(),
        'schedule', _subscription.cadence, 'timezone', _subscription.timezone,
        'summary', 'Scheduled HSE report draft generated for secure review.',
        'company_name', coalesce(_settings.company_name, 'Prosel Limited'),
        'report_footer', coalesce(_settings.report_footer, ''),
        'letterhead_path', _settings.letterhead_path,
        'recipient_count', cardinality(_subscription.recipients),
        'next_run_at', _subscription.next_run_at
      );

      INSERT INTO public.generated_reports(report_number, module, title, report_data, status, generated_by)
      VALUES (_report_number, _subscription.module, _report_title, _payload, 'draft', _subscription.created_by)
      RETURNING id INTO _report_id;

      FOREACH _recipient IN ARRAY _subscription.recipients LOOP
        _normalized_recipient := lower(trim(_recipient));
        _message_id := gen_random_uuid();

        SELECT token INTO _unsubscribe_token FROM public.email_unsubscribe_tokens
        WHERE email = _normalized_recipient AND used_at IS NULL LIMIT 1;

        IF _unsubscribe_token IS NULL THEN
          -- Fully qualify in case search_path is overridden somewhere upstream.
          _unsubscribe_token := encode(extensions.gen_random_bytes(32), 'hex');
          INSERT INTO public.email_unsubscribe_tokens(token, email)
          VALUES (_unsubscribe_token, _normalized_recipient) ON CONFLICT (email) DO NOTHING;
          SELECT token INTO _unsubscribe_token FROM public.email_unsubscribe_tokens
          WHERE email = _normalized_recipient AND used_at IS NULL LIMIT 1;
        END IF;

        IF _unsubscribe_token IS NULL THEN
          RAISE EXCEPTION 'Could not prepare unsubscribe token for scheduled report recipient.';
        END IF;

        _subject := coalesce(_settings.company_name, 'Prosel Limited') || ' · ' || _report_title || ' ' || _report_number;
        _html := '<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">'
          || '<p style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b">'
          || coalesce(_settings.company_name, 'Prosel Limited') || '</p>'
          || '<h1 style="font-size:24px;margin:0 0 12px">' || _report_title || '</h1>'
          || '<p>Your scheduled HSE report draft <strong>' || _report_number || '</strong> is ready for review and approval.</p>'
          || '<p><strong>Module:</strong> ' || initcap(replace(_subscription.module, '_', ' ')) || '<br />'
          || '<strong>Schedule:</strong> ' || _subscription.cadence || '<br />'
          || '<strong>Timezone:</strong> ' || _subscription.timezone || '</p>'
          || '<p>Sign in to Afrinet HSE360 to review the full branded report and supporting records before official use.</p>'
          || CASE WHEN coalesce(_settings.report_footer, '') <> ''
             THEN '<p style="margin-top:24px;color:#64748b;font-size:12px">' || _settings.report_footer || '</p>'
             ELSE '' END
          || '</div>';
        _text := coalesce(_settings.company_name, 'Prosel Limited') || E'\n' || _report_title || E'\n'
          || 'Your scheduled HSE report draft ' || _report_number || ' is ready for review and approval.' || E'\n'
          || 'Module: ' || initcap(replace(_subscription.module, '_', ' ')) || E'\n'
          || 'Schedule: ' || _subscription.cadence || E'\n'
          || 'Timezone: ' || _subscription.timezone || E'\n'
          || 'Sign in to Afrinet HSE360 to review the full branded report.';

        INSERT INTO public.email_send_log(message_id, template_name, recipient_email, status)
        VALUES (_message_id, 'hse-report', _normalized_recipient, 'pending');

        PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
          'message_id', _message_id, 'to', _normalized_recipient,
          'from', 'prosel-safety-hub <noreply@notify.prosellimited.com>',
          'sender_domain', 'notify.prosellimited.com',
          'subject', _subject, 'html', _html, 'text', _text,
          'purpose', 'transactional', 'label', 'hse-report',
          'idempotency_key', 'scheduled-report-' || _subscription.id || '-' || _subscription.next_run_at::text || '-' || _normalized_recipient,
          'unsubscribe_token', _unsubscribe_token,
          'queued_at', now()
        ));
      END LOOP;

      UPDATE public.report_subscriptions
      SET last_run_at = now(),
          next_run_at = public.advance_report_run(next_run_at, cadence, weekday, hour_utc, timezone),
          failure_count = 0, last_error = NULL, updated_at = now()
      WHERE id = _subscription.id;
      _processed := _processed + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.report_subscriptions
      SET failure_count = failure_count + 1, last_error = left(SQLERRM, 1000),
          next_run_at = now() + make_interval(mins => LEAST(60, 5 * (failure_count + 1))),
          updated_at = now()
      WHERE id = _subscription.id;
    END;
  END LOOP;
  RETURN _processed;
END;
$function$;
