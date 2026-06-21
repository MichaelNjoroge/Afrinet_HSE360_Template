DROP POLICY IF EXISTS "Owners and HSE leaders can update secure HSE files" ON storage.objects;
CREATE POLICY "Owners and HSE leaders can update secure HSE files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'hse-secure-files'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'hse-secure-files'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Owners and authorized managers can view secure HSE files" ON storage.objects;
CREATE POLICY "Owners and authorized managers can view secure HSE files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hse-secure-files'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
);