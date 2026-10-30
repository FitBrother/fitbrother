-- meals.image_path: coluna e backfill do raw_input.
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: a coluna existe e é nullable.
SELECT 'check_1_coluna' AS check,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'meals'
           AND column_name = 'image_path'
           AND is_nullable = 'YES'
       ) AS pass;

-- Check 2: o backfill resgata o path que vivia preso no raw_input.
-- Monta o caso em vez de depender do que houver no banco: o que importa é o
-- offset do substring, e um banco recém-resetado não tem refeição nenhuma.
DO $$
DECLARE
  v_user uuid := 'eeeeeeee-0000-4000-8000-00000000000e';
  v_meal uuid := 'ffffffff-0000-4000-8000-00000000000f';
  v_path text;
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES (v_user, 'backfill-check@fitbrother.test') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.meals (id, user_id, source, raw_input, meal_type, consumed_at)
  VALUES (v_meal, v_user, 'app_photo',
          'Foto: ' || v_user || '/meal-photos/' || v_meal || '.jpg',
          'lunch', now());

  -- Repete exatamente o UPDATE da migration, para provar o offset.
  UPDATE public.meals
     SET image_path = substring(raw_input from 7)
   WHERE id = v_meal AND source = 'app_photo' AND raw_input LIKE 'Foto: %';

  SELECT image_path INTO v_path FROM public.meals WHERE id = v_meal;

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'check_2_FAIL: backfill não escreveu nada';
  ELSIF v_path LIKE 'Foto: %' THEN
    RAISE EXCEPTION 'check_2_FAIL: backfill copiou o prefixo junto (%)', v_path;
  ELSIF v_path <> v_user || '/meal-photos/' || v_meal || '.jpg' THEN
    RAISE EXCEPTION 'check_2_FAIL: path errado (%)', v_path;
  ELSE
    RAISE NOTICE 'check_2_pass: %', v_path;
  END IF;
END $$;

-- Check 3: uma refeição de TEXTO aceita foto depois.
-- É o caso central da feature, e é por isso que não há constraint
-- ligando image_path a source.
DO $$
DECLARE
  v_user uuid := 'eeeeeeee-0000-4000-8000-00000000000e';
  v_meal uuid := 'dddddddd-0000-4000-8000-00000000000d';
BEGIN
  INSERT INTO public.meals (id, user_id, source, raw_input, meal_type, consumed_at)
  VALUES (v_meal, v_user, 'app_text', 'dois ovos', 'breakfast', now());

  UPDATE public.meals
     SET image_path = v_user || '/meal-photos/' || v_meal || '.jpg'
   WHERE id = v_meal;

  RAISE NOTICE 'check_3_pass: refeição de texto aceitou foto';
END $$;

ROLLBACK;
