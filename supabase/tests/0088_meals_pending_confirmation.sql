-- Smoke test 0088: payload.require_confirmation=true creates the meal pending; it only counts after confirmation.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _t (uid uuid, first_day date);
GRANT ALL ON _t TO PUBLIC;

DO $$
DECLARE
  u uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email)
  VALUES (u, 'authenticated', 'authenticated', 'pending-smoke-1@example.invalid');
  INSERT INTO _t VALUES (u, (now() AT TIME ZONE 'America/Sao_Paulo')::date - 40);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.complete_onboarding(jsonb_build_object(
    'full_name', 'Smoke Test', 'username', 'pending_smoke_1',
    'birth_date', '1990-01-01', 'sex', 'male', 'activity_level', 'moderate',
    'goal', 'maintain', 'timezone', 'America/Sao_Paulo', 'day_start_hour', 0,
    'weight_kg', 80, 'height_cm', 180, 'body_fat_pct', 20,
    'strength_training', false, 'is_pregnant_or_lactating', false,
    'has_kidney_disease', false, 'has_type1_diabetes', false,
    'uses_glp1', false, 'tca_screening_positive', false,
    'consents', jsonb_build_object('terms', true, 'privacy', true,
      'ai_processing', true, 'health_data', true, 'policy_version', 'v1.0'),
    'targets', jsonb_build_object('bmr_kcal', 1800, 'tdee_kcal', 2500, 'kcal', 2500,
      'protein_g', 150, 'carbs_g', 300, 'fat_g', 70, 'fiber_g', 30)));
  RESET ROLE;
END $$;

-- 0044's CHECK omits app_barcode (pre-existing bug); widen it inside this rolled-back transaction only.
ALTER TABLE public.meals DROP CONSTRAINT meals_audio_path_matches_source,
  ADD CONSTRAINT meals_audio_path_matches_source CHECK (
    (source IN ('app_audio', 'wa_audio') AND audio_path IS NOT NULL)
    OR (source IN ('app_text', 'app_photo', 'app_barcode', 'wa_text', 'manual') AND audio_path IS NULL)
  );

-- One meal per nutritional day, so each day's summary reflects only that meal.
DO $$
DECLARE
  u uuid; c record; r jsonb; flag boolean; n int; d date;
BEGIN
  SELECT uid, first_day INTO u, d FROM _t;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOR c IN SELECT * FROM (VALUES
    ('app_text',    0.9, true,  true),
    ('app_audio',   0.9, true,  true),
    ('app_photo',   0.9, true,  true),
    ('manual',      0.9, true,  true),
    ('wa_text',     0.9, true,  true),
    ('app_text',    0.9, NULL,  false),
    ('app_audio',   0.9, false, false),
    ('app_photo',   0.9, NULL,  false),
    ('app_barcode', 1.0, NULL,  false),
    ('wa_text',     0.9, NULL,  false),
    ('wa_audio',    0.9, NULL,  false),
    ('manual',      0.9, NULL,  false),
    ('app_barcode', 0.5, NULL,  true),
    ('wa_text',     0.5, NULL,  true),
    ('app_text',    0.5, false, true),
    ('app_text',    0.5, true,  true)
  ) AS t(source, confidence, req, pending) LOOP
    r := public.create_meal_with_items(jsonb_build_object(
      'id', gen_random_uuid(), 'source', c.source, 'raw_input', 'arroz',
      'audio_path', CASE WHEN c.source LIKE '%audio' THEN u || '/smoke.m4a' END,
      'meal_type', 'lunch', 'consumed_at', (d + time '15:00') AT TIME ZONE 'America/Sao_Paulo',
      'confidence', c.confidence,
      'review_required', NOT c.pending,
      'items', jsonb_build_array(jsonb_build_object(
        'description', 'arroz', 'quantity', 100, 'unit', 'g',
        'kcal', 128, 'protein_g', 2.5, 'carbs_g', 28, 'fat_g', 0.2)))
      || CASE WHEN c.req IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('require_confirmation', c.req) END);
    SELECT review_required INTO flag FROM public.meals WHERE id = (r->>'id')::uuid;
    IF flag IS DISTINCT FROM c.pending OR (r->>'review_required')::boolean IS DISTINCT FROM c.pending THEN
      RAISE EXCEPTION 'FAIL % @ % flag=%: review_required=% (rpc %), expected %',
        c.source, c.confidence, c.req, flag, r->>'review_required', c.pending;
    END IF;
    SELECT COALESCE(max(meals_count), 0) INTO n FROM public.daily_summaries
      WHERE user_id = u AND day = d;
    IF n <> (CASE WHEN c.pending THEN 0 ELSE 1 END) THEN
      RAISE EXCEPTION 'FAIL % @ % flag=%: daily_summaries meals_count=% on %', c.source, c.confidence, c.req, n, d;
    END IF;
    RAISE NOTICE 'PASS % @ % flag=% -> review_required=%, counted=%', c.source, c.confidence, COALESCE(c.req::text, 'absent'), flag, n;
    d := d + 1;
  END LOOP;
  RESET ROLE;
END $$;

-- Replaying the same id returns already_existed and keeps the flag.
DO $$
DECLARE
  u uuid; v_id uuid := gen_random_uuid(); r jsonb; flag boolean; p jsonb;
BEGIN
  SELECT uid INTO u FROM _t;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  p := jsonb_build_object(
    'id', v_id, 'source', 'app_text', 'raw_input', 'feijao', 'meal_type', 'dinner',
    'consumed_at', now() - interval '20 days', 'confidence', 0.9, 'require_confirmation', true,
    'items', jsonb_build_array(jsonb_build_object(
      'description', 'feijao', 'quantity', 100, 'unit', 'g',
      'kcal', 76, 'protein_g', 4.8, 'carbs_g', 13.6, 'fat_g', 0.5)));
  r := public.create_meal_with_items(p);
  IF (r->>'already_existed')::boolean THEN RAISE EXCEPTION 'FAIL first insert reported already_existed'; END IF;
  r := public.create_meal_with_items(p || jsonb_build_object('source', 'manual', 'confidence', 1.0, 'require_confirmation', false));
  IF NOT (r->>'already_existed')::boolean THEN RAISE EXCEPTION 'FAIL replay did not report already_existed'; END IF;
  SELECT review_required INTO flag FROM public.meals WHERE meals.id = v_id;
  IF flag IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL replay changed review_required to %', flag; END IF;
  RAISE NOTICE 'PASS replay returns already_existed and keeps review_required=true';
  RESET ROLE;
END $$;

-- Confirming (review_required -> false) makes the existing trigger count the meal.
DO $$
DECLARE
  u uuid; v_id uuid; n int; v_kcal numeric; d date;
BEGIN
  SELECT uid, first_day INTO u, d FROM _t;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT m.id INTO v_id FROM public.meals m
    WHERE public.fitbrother_nutritional_day(u, m.consumed_at) = d;
  UPDATE public.meals SET review_required = false WHERE meals.id = v_id;
  SELECT s.meals_count, s.kcal INTO n, v_kcal FROM public.daily_summaries s
    WHERE s.user_id = u AND s.day = d;
  IF n IS DISTINCT FROM 1 OR v_kcal IS DISTINCT FROM 128 THEN
    RAISE EXCEPTION 'FAIL confirmed meal not counted: meals_count=%, kcal=%', n, v_kcal;
  END IF;
  RAISE NOTICE 'PASS confirming counts the meal in daily_summaries (1 meal, 128 kcal)';
  RESET ROLE;
END $$;

ROLLBACK;
