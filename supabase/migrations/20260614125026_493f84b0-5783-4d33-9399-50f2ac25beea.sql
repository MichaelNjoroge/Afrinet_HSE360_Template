ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_path text;

CREATE OR REPLACE FUNCTION public.sync_employee_avatar_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.employees
  SET avatar_path = NEW.avatar_path,
      updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_employee_avatar_path() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_employee_avatar_path() TO service_role;

DROP TRIGGER IF EXISTS sync_employee_avatar_path_on_profile ON public.profiles;
CREATE TRIGGER sync_employee_avatar_path_on_profile
AFTER INSERT OR UPDATE OF avatar_path ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_avatar_path();

CREATE POLICY "Users upload own profile photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "Users update own profile photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
);

CREATE POLICY "Users delete own profile photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authorized users view profile photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hr_manager'::public.app_role)
  )
);