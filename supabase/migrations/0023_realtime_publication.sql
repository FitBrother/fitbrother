-- M3.1. Habilita Realtime (Logical Replication via publication
-- "supabase_realtime") em daily_summaries + meals.
--
-- Filtro de eventos por user_id acontece no canal Postgres Changes do
-- cliente. RLS valida que apenas rows pertencentes ao user vão pro
-- subscriber correto (security_invoker em views, owner_read em tabelas).
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_summaries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meals;

-- REPLICA IDENTITY FULL em meals: o cliente subscribe com
-- filter='user_id=eq.<uid>'. Em DELETE, o payload "old" só inclui colunas
-- da REPLICA IDENTITY — default é a PK (id) e o filtro user_id falha.
-- FULL emite o row inteiro no WAL, garantindo que o filtro casa em DELETE.
-- daily_summaries não precisa: PK (user_id, day) já cobre o filtro.
ALTER TABLE public.meals REPLICA IDENTITY FULL;
