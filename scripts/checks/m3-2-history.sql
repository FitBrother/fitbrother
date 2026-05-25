-- M3.2 backend smoke checks. Rodado via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m3-2-history.sql

\set ON_ERROR_STOP on

-- Check 1: daily_summaries tem PK (user_id, day) — confirma que ORDER BY day DESC com WHERE user_id usa index.
SELECT 'check_1_daily_summaries_pk' AS check,
       COUNT(*) = 1 AS pass
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_summaries'
  AND indexdef LIKE '%(user_id, day)%';

-- Check 2: nenhuma daily_summary tem day no futuro (sanity).
SELECT 'check_2_no_future_days' AS check,
       NOT EXISTS (SELECT 1 FROM public.daily_summaries WHERE day > current_date + interval '1 day') AS pass;
