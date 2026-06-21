CREATE OR REPLACE FUNCTION public.claim_employee_account()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_id uuid;
  login_email text;
BEGIN
  login_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  IF auth.uid() IS NULL OR login_email = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.employees
  SET user_id = auth.uid(), account_status = 'active', updated_at = now()
  WHERE lower(email) = login_email
    AND employment_status = 'active'
    AND (user_id IS NULL OR user_id = auth.uid())
  RETURNING id INTO claimed_id;

  IF claimed_id IS NULL THEN
    SELECT id INTO claimed_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  IF claimed_id IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (auth.uid(), 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN claimed_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_employee_account() TO authenticated;