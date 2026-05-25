-- M3.1 backend smoke checks. Rodado via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m3-1-daily-summary.sql
--
-- Assume db já populado pelo seed + ao menos 1 user em auth.users.

\set ON_ERROR_STOP on

-- Check 1: vw_today_summary existe e retorna 0 rows quando rodado sem auth.uid().
-- (auth.uid() é NULL sem JWT context — view filtra user_id = NULL → 0 rows.)
SELECT 'check_1_view_empty_without_auth' AS check,
       COUNT(*) = 0 AS pass
FROM public.vw_today_summary;

-- Check 2: fitbrother_today retorna data quando user existe.
-- Pega primeiro user real do banco pra teste.
DO $$
DECLARE
  v_user uuid;
  v_today date;
BEGIN
  SELECT user_id INTO v_user FROM public.profiles LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'check_2_skipped: no user in profiles';
  ELSE
    SELECT public.fitbrother_today(v_user) INTO v_today;
    IF v_today IS NULL THEN
      RAISE EXCEPTION 'check_2_FAIL: fitbrother_today returned NULL for valid user';
    END IF;
    RAISE NOTICE 'check_2_pass: fitbrother_today(%) = %', v_user, v_today;
  END IF;
END $$;

-- Check 3: boundary respeitada — user com day_start_hour=4 e meal às 03:00 local
-- ainda conta como "ontem". Cria user temporário pra validar.
DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_yesterday date := (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1;
  v_computed date;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'check3@local.test') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles (user_id, timezone, day_start_hour, locale)
    VALUES (v_user, 'America/Sao_Paulo', 4, 'pt-BR')
    ON CONFLICT (user_id) DO UPDATE SET day_start_hour = 4, timezone = 'America/Sao_Paulo';

  SELECT public.fitbrother_nutritional_day(
    v_user,
    (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '3 hours') AT TIME ZONE 'America/Sao_Paulo'
  ) INTO v_computed;

  IF v_computed <> v_yesterday THEN
    RAISE EXCEPTION 'check_3_FAIL: expected %, got % (day_start_hour=4, ts=03:00 local)', v_yesterday, v_computed;
  END IF;
  RAISE NOTICE 'check_3_pass: 03:00 local with day_start_hour=4 → %', v_computed;

  DELETE FROM public.profiles WHERE user_id = v_user;
  DELETE FROM auth.users WHERE id = v_user;
END $$;

-- Check 4: GRANT SELECT em vw_today_summary pra anon/authenticated.
SELECT 'check_4_grants_present' AS check,
       COUNT(*) = 2 AS pass
FROM information_schema.role_table_grants
WHERE table_name = 'vw_today_summary'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT';

-- Check 5: publication contém daily_summaries e meals.
SELECT 'check_5_publication_tables' AS check,
       COUNT(*) = 2 AS pass
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('daily_summaries', 'meals');

-- Check 6: REPLICA IDENTITY FULL em meals (necessário pra DELETE Realtime
-- emitir user_id no payload old, sem o qual o filtro user_id=eq.<uid> falha).
SELECT 'check_6_meals_replica_full' AS check,
       relreplident = 'f' AS pass
FROM pg_class
WHERE relname = 'meals' AND relnamespace = 'public'::regnamespace;
