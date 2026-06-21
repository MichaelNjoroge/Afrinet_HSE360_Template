CREATE POLICY "Authenticated staff can view secure HSE files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hse-secure-files');

CREATE POLICY "Users can upload secure HSE files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hse-secure-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners and HSE leaders can update secure HSE files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hse-secure-files' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')))
WITH CHECK (bucket_id = 'hse-secure-files' AND (owner_id = auth.uid()::text OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')));

CREATE POLICY "HSE leaders can delete secure HSE files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hse-secure-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager')));