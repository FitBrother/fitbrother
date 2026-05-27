-- M5.3 social — checks SQL. Roda via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m5-3-social.sql
\set ON_ERROR_STOP on

-- Check 1: following_summaries_view NÃO expõe macros.
SELECT 'check_1_view_no_macros' AS check,
       NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'following_summaries_view'
           AND column_name IN ('kcal','protein_g','carbs_g','fat_g')
       ) AS pass;

-- Check 2: self-follow bloqueado.
DO $$
DECLARE u uuid;
BEGIN
  SELECT id INTO u FROM auth.users LIMIT 1;
  IF u IS NULL THEN RAISE NOTICE 'check_2_skip: no users'; RETURN; END IF;
  BEGIN
    INSERT INTO public.follows(follower_id,followee_id) VALUES (u,u);
    RAISE EXCEPTION 'check_2_FAIL: self-follow permitido';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'check_2_pass: self-follow bloqueado';
  END;
END $$;

-- Check 3: leaderboard inclui o próprio usuário.
DO $$
DECLARE u uuid; r record;
BEGIN
  SELECT user_id INTO u FROM public.profiles LIMIT 1;
  IF u IS NULL THEN RAISE NOTICE 'check_3_skip: no profiles'; RETURN; END IF;
  SELECT * INTO r FROM public.fitbrother_weekly_leaderboard(u) WHERE user_id = u;
  IF r.user_id IS NULL THEN RAISE EXCEPTION 'check_3_FAIL: self ausente do leaderboard'; END IF;
  RAISE NOTICE 'check_3_pass: leaderboard inclui self';
END $$;

-- Check 4: alertas idempotentes (2x sem erro).
SELECT public.fitbrother_streak_alert();
SELECT public.fitbrother_streak_alert();
SELECT public.fitbrother_goal_reminder();
SELECT 'check_4_pass: alertas rodam idempotentes' AS check;
