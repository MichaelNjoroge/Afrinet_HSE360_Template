
-- Finding 1: Restrict profiles SELECT so only the owner or an admin can read full row (email/phone).
DROP POLICY IF EXISTS "Authenticated users can view directory fields" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Keep cross-user directory name lookups working without exposing sensitive columns:
-- make directory_names a SECURITY DEFINER function so peers can still resolve names.
CREATE OR REPLACE FUNCTION public.directory_names()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT e.id, e.full_name FROM public.employees e WHERE e.full_name IS NOT NULL
  UNION
  SELECT e.user_id, e.full_name
  FROM public.employees e
  WHERE e.user_id IS NOT NULL AND e.full_name IS NOT NULL
  UNION
  SELECT p.id, p.full_name FROM public.profiles p WHERE p.full_name IS NOT NULL
$function$;

-- Finding 2: Allow uploaders to delete their own files in hse-secure-files.
CREATE POLICY "Owners can delete own secure HSE files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hse-secure-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
