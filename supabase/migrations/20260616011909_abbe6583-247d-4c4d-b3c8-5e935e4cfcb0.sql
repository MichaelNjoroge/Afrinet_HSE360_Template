CREATE POLICY "Admins manage all profile photos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'profile-photos' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'profile-photos' AND public.has_role(auth.uid(), 'admin'));