-- M5.2 — Realtime em user_achievements.
--
-- O app assina INSERTs em user_achievements (filter user_id=eq.<uid>) pra
-- mostrar o toast de conquista no instante do unlock, sem esperar o push.
-- PK composta (user_id, achievement_id) já inclui user_id, então o filtro
-- casa no payload de INSERT — não precisa de REPLICA IDENTITY FULL (só
-- relevante p/ DELETE/UPDATE, que não usamos aqui).
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
