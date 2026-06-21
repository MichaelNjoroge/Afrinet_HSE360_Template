DROP POLICY IF EXISTS "Authenticated staff can view contractors" ON public.contractors;
CREATE POLICY "HSE leaders can view contractors" ON public.contractors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hse_manager'));

DROP POLICY IF EXISTS "Users can create their notifications" ON public.notifications;

CREATE POLICY "Admins can assign roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can remove roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));