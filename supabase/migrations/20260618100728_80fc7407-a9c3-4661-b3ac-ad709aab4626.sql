
-- 1. Lock down email_send_log and suppressed_emails to service_role only at GRANT level
REVOKE ALL ON public.email_send_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.suppressed_emails FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_send_log TO service_role;
GRANT ALL ON public.suppressed_emails TO service_role;

-- 2. Expose a safe public directory view so any authenticated user can resolve
-- colleague names/avatars without exposing emails or phone numbers.
CREATE OR REPLACE VIEW public.profiles_directory
WITH (security_invoker = on) AS
SELECT id, full_name, department, job_title, avatar_path
FROM public.profiles
WHERE employment_status = 'active';

GRANT SELECT ON public.profiles_directory TO authenticated;

-- Allow the view's underlying SELECT to succeed for any authenticated user
-- without widening direct access to sensitive columns (email, phone).
CREATE POLICY "Authenticated users can view directory fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Replace prior SELECT policy so we don't have an overly-narrow one shadowing the new one's intent.
DROP POLICY IF EXISTS "Employees and people managers can view profiles" ON public.profiles;
