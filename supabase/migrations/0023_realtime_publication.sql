-- M3.1. Habilita Realtime (Logical Replication via publication
-- "supabase_realtime") em daily_summaries + meals.
--
-- Filtro de eventos por user_id acontece no canal Postgres Changes do
-- cliente. RLS valida que apenas rows pertencentes ao user vão pro
-- subscriber correto (security_invoker em views, owner_read em tabelas).
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_summaries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meals;
