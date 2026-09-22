-- Fix search_path for new functions
ALTER FUNCTION public.update_tasks_updated_at() SET search_path = public;
ALTER FUNCTION public.check_task_alerts() SET search_path = public;
ALTER FUNCTION public.notify_task_assignment() SET search_path = public;
ALTER FUNCTION public.notify_task_mentions() SET search_path = public;