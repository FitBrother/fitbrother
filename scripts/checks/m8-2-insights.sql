-- M8.2 insights — checks SQL. Roda via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m8-2-insights.sql
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: tabela ai_insights + enum insight_period existem.
SELECT 'check_1_schema' AS check,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_insights')
   AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insight_period') AS pass;

-- Check 2: RLS owner-only (terceiro não lê insight de outro).
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); n int;
BEGIN
  INSERT INTO auth.users (id) VALUES (a);
  INSERT INTO public.profiles (user_id, timezone) VALUES (a, 'UTC');
  INSERT INTO public.ai_insights(id,user_id,period_type,period_start,payload,source_hash)
    VALUES (gen_random_uuid(), a, 'day', current_date - 1, '{}'::jsonb, 'x');
  INSERT INTO auth.users (id) VALUES (b);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.ai_insights WHERE user_id = a;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'check_2_FAIL: terceiro leu ai_insights'; END IF;
  RAISE NOTICE 'check_2_pass: ai_insights isolado por RLS';
END $$;

-- Check 3: target de 'day' elegível quando ontem teve refeição.
DO $$
DECLARE u uuid := gen_random_uuid(); cnt int;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.profiles (user_id, timezone, day_start_hour) VALUES (u, 'UTC', 0);
  FOR i IN 1..4 LOOP
    INSERT INTO public.daily_summaries(user_id, day, kcal, protein_g, carbs_g, fat_g, goal_hit, meals_count)
      VALUES (u, (public.fitbrother_today(u) - i), 2000, 120, 200, 60, true, 3);
  END LOOP;
  SELECT count(*) INTO cnt FROM public.fitbrother_insight_targets('day') t WHERE t.user_id = u;
  IF cnt <> 1 THEN RAISE EXCEPTION 'check_3_FAIL: day targets=% (esperado 1)', cnt; END IF;
  RAISE NOTICE 'check_3_pass: day target elegível';
END $$;

ROLLBACK;
