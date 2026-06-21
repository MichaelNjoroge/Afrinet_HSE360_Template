ALTER TABLE public.audits ALTER COLUMN status SET DEFAULT 'planned';
UPDATE public.audits SET status='planned' WHERE status='scheduled';