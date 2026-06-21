
-- 1) Tighten DELETE policies on evidence metadata + storage: uploader OR auth level >= 4
DROP POLICY IF EXISTS "Owners and managers remove evidence metadata" ON public.evidence_attachments;
CREATE POLICY "Uploaders and L4/L5 remove evidence metadata"
  ON public.evidence_attachments
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.user_auth_level(auth.uid()) >= 4);

DROP POLICY IF EXISTS "Owners and managers remove HSE evidence" ON storage.objects;
CREATE POLICY "Uploaders and L4/L5 remove HSE evidence"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hse-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.user_auth_level(auth.uid()) >= 4
    )
  );

-- 2) Directory name resolver available to every authenticated user.
-- Returns id->display name for both employee.id and the underlying user_id,
-- plus profiles.id so reporter/observer/created_by UUIDs (which are auth user ids)
-- always resolve to a person's name regardless of module permissions.
CREATE OR REPLACE FUNCTION public.directory_names()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT e.id, e.full_name FROM public.employees e WHERE e.full_name IS NOT NULL
  UNION
  SELECT e.user_id, e.full_name
  FROM public.employees e
  WHERE e.user_id IS NOT NULL AND e.full_name IS NOT NULL
  UNION
  SELECT p.id, p.full_name FROM public.profiles p WHERE p.full_name IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.directory_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_names() TO authenticated;
