-- M8.1 feedback — checks SQL. Roda via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m8-1-feedback.sql
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: coluna meals.ai_feedback existe.
SELECT 'check_1_column' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'meals' AND column_name = 'ai_feedback') AS pass;

-- Check 2: RPC create_meal_with_items persiste ai_feedback do payload.
DO $$
DECLARE u uuid := gen_random_uuid(); m uuid := gen_random_uuid(); fb text;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.profiles (user_id, timezone) VALUES (u, 'UTC');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.create_meal_with_items(jsonb_build_object(
    'id', m, 'source', 'app_text', 'raw_input', 'ovos',
    'meal_type', 'breakfast', 'confidence', 0.9,
    'ai_feedback', 'Ótima fonte de proteína',
    'items', jsonb_build_array(jsonb_build_object(
      'description','Ovos','quantity',2,'unit','unit',
      'kcal',140,'protein_g',12,'carbs_g',1,'fat_g',10))
  ));
  RESET ROLE;
  SELECT ai_feedback INTO fb FROM public.meals WHERE id = m;
  IF fb IS DISTINCT FROM 'Ótima fonte de proteína' THEN
    RAISE EXCEPTION 'check_2_FAIL: ai_feedback=%', fb;
  END IF;
  RAISE NOTICE 'check_2_pass: RPC persiste ai_feedback';
END $$;

ROLLBACK;
