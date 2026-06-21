
-- Enforce {auth.uid()}/... path prefix for non-admin uploads to hse-secure-files
DROP POLICY IF EXISTS "Authenticated users can upload secure HSE files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder in hse-secure-files" ON storage.objects;

CREATE POLICY "Users can upload to own folder in hse-secure-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hse-secure-files'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Mirror the same restriction on UPDATE (rename/move) so files can't be relocated outside the owner folder
DROP POLICY IF EXISTS "Users can update own secure HSE files" ON storage.objects;

CREATE POLICY "Users can update own secure HSE files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hse-secure-files'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'hse-secure-files'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
