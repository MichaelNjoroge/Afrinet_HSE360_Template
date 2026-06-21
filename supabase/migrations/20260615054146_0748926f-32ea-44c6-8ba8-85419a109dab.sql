GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_report_settings TO authenticated;
GRANT ALL ON public.company_report_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_subscriptions TO authenticated;
GRANT ALL ON public.report_subscriptions TO service_role;