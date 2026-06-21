CREATE TABLE public.public_endpoint_rate_limits (
  key_hash text NOT NULL,
  route text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key_hash, route, window_started_at)
);
GRANT ALL ON public.public_endpoint_rate_limits TO service_role;
ALTER TABLE public.public_endpoint_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages endpoint rate limits" ON public.public_endpoint_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER set_public_endpoint_rate_limits_updated_at BEFORE UPDATE ON public.public_endpoint_rate_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.consume_endpoint_rate_limit(_key_hash text, _route text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _window timestamptz;
  _count integer;
BEGIN
  IF _key_hash !~ '^[a-f0-9]{64}$' OR char_length(_route) > 120 OR _limit < 1 OR _limit > 1000 OR _window_seconds < 10 OR _window_seconds > 86400 THEN
    RETURN false;
  END IF;
  _window := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.public_endpoint_rate_limits(key_hash, route, window_started_at, request_count)
  VALUES (_key_hash, _route, _window, 1)
  ON CONFLICT (key_hash, route, window_started_at)
  DO UPDATE SET request_count = public.public_endpoint_rate_limits.request_count + 1, updated_at = now()
  RETURNING request_count INTO _count;
  DELETE FROM public.public_endpoint_rate_limits WHERE window_started_at < now() - interval '2 days';
  RETURN _count <= _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_endpoint_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_endpoint_rate_limit(text, text, integer, integer) TO service_role;

DROP POLICY IF EXISTS "Owners and managers read HSE evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users read HSE evidence files" ON storage.objects;
CREATE POLICY "Authorized module viewers read HSE evidence files" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'hse-evidence' AND EXISTS (
    SELECT 1 FROM public.evidence_attachments ea
    WHERE ea.storage_path = storage.objects.name
      AND public.has_module_permission(auth.uid(), ea.module, 'view')
  )
);