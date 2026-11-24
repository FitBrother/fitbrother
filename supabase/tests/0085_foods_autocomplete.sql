-- Smoke test 0085: fitbrother_foods_autocomplete (catalog + aliases + recents).
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _t (uid uuid, uid2 uuid, f_arroz uuid, f_feijao uuid, f_ovo uuid);
GRANT ALL ON _t TO PUBLIC;

-- Fixtures: two users and meal items for user 1 (and one meal for user 2).
DO $$
DECLARE
  u  uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  f_arroz uuid; f_feijao uuid; f_ovo uuid;
  m1 uuid := gen_random_uuid();
  m2 uuid := gen_random_uuid();
  m3 uuid := gen_random_uuid();
  m4 uuid := gen_random_uuid();
  m_other uuid := gen_random_uuid();
  m_del uuid := gen_random_uuid();
  m_old uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email)
  VALUES (u,  'authenticated', 'authenticated', 'autocomplete-smoke-1@example.invalid'),
         (u2, 'authenticated', 'authenticated', 'autocomplete-smoke-2@example.invalid');

  SELECT id INTO f_arroz  FROM public.foods WHERE source = 'taco' AND name = 'Arroz, tipo 1, cozido';
  SELECT id INTO f_feijao FROM public.foods WHERE source = 'taco' AND name = 'Feijão, carioca, cozido';
  SELECT id INTO f_ovo    FROM public.foods WHERE source = 'taco' AND name = 'Ovo, de galinha, inteiro, cozido/10minutos';
  INSERT INTO _t VALUES (u, u2, f_arroz, f_feijao, f_ovo);

  -- Skip the recompute triggers (they need profiles/daily_summaries, irrelevant here).
  PERFORM set_config('fitbrother.bulk_insert', 'on', true);
  -- Allow an old meal to test the 90-day window (rolled back with the transaction).
  ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_consumed_at_sane_window;

  INSERT INTO public.meals (id, user_id, source, meal_type, consumed_at) VALUES
    (m1, u, 'manual', 'lunch', now() - interval '3 days'),
    (m2, u, 'manual', 'lunch', now() - interval '1 hour'),
    (m3, u, 'manual', 'snack', now() - interval '2 hours'),
    (m4, u, 'manual', 'snack', now() - interval '5 hours'),
    (m_del, u, 'manual', 'other', now() - interval '1 hour'),
    (m_old, u, 'manual', 'other', now() - interval '120 days'),
    (m_other, u2, 'manual', 'lunch', now() - interval '1 hour');

  INSERT INTO public.meal_items (meal_id, food_id, description, quantity, unit, kcal, protein_g, carbs_g, fat_g) VALUES
    -- same food_id twice: older 100 g, newer 250 g
    (m1, f_arroz, 'Meu arroz', 100, 'g', 128, 2.5, 28.1, 0.2),
    (m2, f_arroz, 'Meu arroz', 250, 'g', 320, 6.25, 70.25, 0.5),
    -- feijao recent with food_id
    (m2, f_feijao, 'feijao do almoco', 150, 'g', 143, 9, 24, 0.5),
    -- recents without food_id: same normalized description + unit => one group
    (m3, NULL, 'Pão de Queijo Caseiro', 2, 'unit', 200, 5, 20, 10),
    (m4, NULL, 'pao de queijo, caseiro', 3, 'unit', 300, 7, 30, 15),
    -- same description, different unit => separate group
    (m4, NULL, 'pao de queijo caseiro', 80, 'g', 240, 6, 24, 12),
    -- soft-deleted item inside a live meal
    (m2, NULL, 'Zzdeletado item', 1, 'unit', 10, 1, 1, 1),
    -- item of a soft-deleted meal
    (m_del, NULL, 'Zzmeal apagada', 1, 'unit', 10, 1, 1, 1),
    -- older than 90 days
    (m_old, NULL, 'Zzantigo item', 1, 'unit', 10, 1, 1, 1),
    -- other user
    (m_other, NULL, 'Zzoutro usuario', 1, 'unit', 10, 1, 1, 1);

  UPDATE public.meal_items SET deleted_at = now() WHERE description = 'Zzdeletado item';
  UPDATE public.meals SET deleted_at = now() WHERE id = m_del;
  UPDATE public.meal_items SET deleted_at = now() WHERE meal_id = m_del;
END $$;

-- (a) one character returns nothing.
DO $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('a');
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL (a) 1 char returned % rows', n; END IF;
  RAISE NOTICE 'PASS (a) 1 character returns 0 rows';
END $$;

-- (b) empty query returns only recents, most frequent/recent first.
DO $$
DECLARE n int; n_catalog int; first_name text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*), count(*) FILTER (WHERE kind <> 'recent') INTO n, n_catalog
    FROM public.fitbrother_foods_autocomplete('', 50);
  SELECT name INTO first_name FROM public.fitbrother_foods_autocomplete('', 50) LIMIT 1;
  RESET ROLE;
  IF n_catalog <> 0 THEN RAISE EXCEPTION 'FAIL (b) empty query returned % non-recent rows', n_catalog; END IF;
  -- Meu arroz (2 uses), feijao (1), pao de queijo unit (2 uses), pao de queijo g (1) => 4 groups.
  IF n <> 4 THEN RAISE EXCEPTION 'FAIL (b) expected 4 recent groups, got %', n; END IF;
  IF first_name NOT IN ('Meu arroz', 'pao de queijo, caseiro', 'Pão de Queijo Caseiro') THEN
    RAISE EXCEPTION 'FAIL (b) most frequent group should come first, got %', first_name;
  END IF;
  RAISE NOTICE 'PASS (b) empty query returns only recents (% groups)', n;
END $$;

-- (c) two characters: prefix of the name/alias or of any word, never similarity-only.
DO $$
DECLARE n_ret int; n_expected int; has_arroz boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- Arroz is also a recent (food_id set), so look at food_id across kinds.
  SELECT count(*), bool_or(food_id = (SELECT f_arroz FROM _t)) INTO n_ret, has_arroz
    FROM public.fitbrother_foods_autocomplete('ar', 1000) WHERE food_id IS NOT NULL;
  SELECT count(*) INTO n_expected FROM public.foods f
   WHERE f.verified AND (
     f.name_normalized LIKE 'ar%' OR f.name_normalized LIKE '% ar%'
     OR EXISTS (SELECT 1 FROM public.food_aliases a WHERE a.food_id = f.id
                  AND (a.alias_normalized LIKE 'ar%' OR a.alias_normalized LIKE '% ar%')));
  RESET ROLE;
  IF NOT has_arroz THEN RAISE EXCEPTION 'FAIL (c) "ar" missing Arroz, tipo 1, cozido'; END IF;
  IF n_ret <> n_expected THEN
    RAISE EXCEPTION 'FAIL (c) "ar" returned % food rows, prefix-only expects %', n_ret, n_expected;
  END IF;
  RAISE NOTICE 'PASS (c) "ar" returns prefix matches only (% rows)', n_ret;
END $$;

-- (d) alias match resolves to the canonical food; (e) accents/uppercase do not matter.
-- Run as user 2, who has no recents that would replace the catalog rows.
DO $$
DECLARE n int; n2 int; n3 int; same boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- Production limit (8): the alias target must survive the cut.
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('arroz branco', 8)
   WHERE kind = 'catalog' AND name = 'Arroz, tipo 1, cozido' AND score = 4;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL (d) "arroz branco" should return Arroz, tipo 1, cozido once with score 4, got %', n; END IF;
  RAISE NOTICE 'PASS (d) alias "arroz branco" finds Arroz, tipo 1, cozido (exact alias = 4)';

  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('feijao', 8)
   WHERE kind = 'catalog' AND name = 'Feijão, carioca, cozido';
  SELECT count(*) INTO n2 FROM public.fitbrother_foods_autocomplete('FEIJÃO', 8)
   WHERE kind = 'catalog' AND name = 'Feijão, carioca, cozido';
  SELECT count(*) INTO n3 FROM public.fitbrother_foods_autocomplete('  Feijão,  Carioca ', 8)
   WHERE kind = 'catalog' AND name = 'Feijão, carioca, cozido';
  RESET ROLE;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL (e) "feijao" did not find Feijão, carioca, cozido exactly once (%)', n; END IF;
  IF n2 <> 1 THEN RAISE EXCEPTION 'FAIL (e) "FEIJÃO" (accent/uppercase) did not find it (%)', n2; END IF;
  IF n3 <> 1 THEN RAISE EXCEPTION 'FAIL (e) messy spacing/comma input did not find it (%)', n3; END IF;
  RAISE NOTICE 'PASS (e) "feijao" finds Feijão, carioca, cozido; accent/uppercase/comma-insensitive';
END $$;

-- (f) recent with food_id shows as recent and suppresses the catalog row of the same food.
DO $$
DECLARE
  n_recent int; n_catalog int; r record;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n_recent FROM public.fitbrother_foods_autocomplete('arroz', 50)
   WHERE kind = 'recent' AND food_id = (SELECT f_arroz FROM _t);
  SELECT count(*) INTO n_catalog FROM public.fitbrother_foods_autocomplete('arroz', 50)
   WHERE kind = 'catalog' AND food_id = (SELECT f_arroz FROM _t);
  SELECT * INTO r FROM public.fitbrother_foods_autocomplete('arroz', 50)
   WHERE kind = 'recent' AND food_id = (SELECT f_arroz FROM _t);
  RESET ROLE;
  IF n_recent <> 1 THEN RAISE EXCEPTION 'FAIL (f) expected 1 recent row for arroz, got %', n_recent; END IF;
  IF n_catalog <> 0 THEN RAISE EXCEPTION 'FAIL (f) catalog row of the same food_id was not suppressed'; END IF;
  IF r.name <> 'Meu arroz' OR r.kcal_per_100g IS NULL OR r.serving_grams IS DISTINCT FROM
     (SELECT serving_grams FROM public.foods WHERE id = (SELECT f_arroz FROM _t)) THEN
    RAISE EXCEPTION 'FAIL (f) recent with food_id must carry the food macros/serving (%)', r;
  END IF;
  RAISE NOTICE 'PASS (f) recent with food_id suppresses the catalog row and carries per-100g data';
END $$;

-- (f2) a recent matches through the linked food's name even if its description does not.
DO $$
DECLARE n_recent int; n_catalog int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- "feijao do almoco" is the description; "carioca" only exists in the catalog name.
  SELECT count(*) FILTER (WHERE kind = 'recent'), count(*) FILTER (WHERE kind = 'catalog')
    INTO n_recent, n_catalog
    FROM public.fitbrother_foods_autocomplete('carioca', 50)
   WHERE food_id = (SELECT f_feijao FROM _t);
  RESET ROLE;
  IF n_recent <> 1 OR n_catalog <> 0 THEN
    RAISE EXCEPTION 'FAIL (f2) food-name match should yield 1 recent and 0 catalog rows, got % / %', n_recent, n_catalog;
  END IF;
  RAISE NOTICE 'PASS (f2) recent matches via linked food name and still suppresses catalog';
END $$;

-- (g) another user's items never show up; (h) soft-deleted items/meals and >90 days do not either.
DO $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('zz', 50) WHERE name ILIKE 'zzoutro%';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL (g) item of another user leaked'; END IF;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('', 50) WHERE name ILIKE 'zz%';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL (g) item of another user leaked on empty query'; END IF;
  RAISE NOTICE 'PASS (g) other users items are not returned';

  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('zz', 50)
   WHERE name ILIKE 'zzdeletado%' OR name ILIKE 'zzmeal apagada%';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL (h) soft-deleted item/meal returned'; END IF;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('zz', 50) WHERE name ILIKE 'zzantigo%';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL (h) item older than 90 days returned'; END IF;
  RESET ROLE;
  RAISE NOTICE 'PASS (h) deleted items, deleted meals and items older than 90 days are not returned';

  -- User 2 sees their own item and none of user 1.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('zzoutro', 50) WHERE kind = 'recent';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL (g) user 2 should see own recent, got %', n; END IF;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('', 50) WHERE name ILIKE 'meu arroz%';
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL (g) user 2 sees user 1 recent'; END IF;
  RAISE NOTICE 'PASS (g) isolation holds for the second user too';
END $$;

-- (i) a literal % (or _) is escaped, not a wildcard.
DO $$
DECLARE n int; n2 int; n3 int; n4 int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n  FROM public.fitbrother_foods_autocomplete('100%', 1000);
  SELECT count(*) INTO n2 FROM public.fitbrother_foods_autocomplete('%%', 1000);
  SELECT count(*) INTO n3 FROM public.fitbrother_foods_autocomplete('__', 1000);
  -- The literal still matches real data ("Café, infusão 10%").
  SELECT count(*) INTO n4 FROM public.fitbrother_foods_autocomplete('10%', 1000)
   WHERE kind = 'catalog' AND name = 'Café, infusão 10%';
  RESET ROLE;
  IF n4 <> 1 THEN RAISE EXCEPTION 'FAIL (i) literal "10%%" should find Café, infusão 10%%, got %', n4; END IF;
  IF n >= 100 OR n2 <> 0 OR n3 <> 0 THEN
    RAISE EXCEPTION 'FAIL (i) wildcard not escaped: 100%% -> %, %%%% -> %, __ -> %', n, n2, n3;
  END IF;
  RAISE NOTICE 'PASS (i) literal %% and _ are escaped (100%% -> %, %%%% -> %, __ -> %)', n, n2, n3;
END $$;

-- (j) shorter names first among equal scores.
DO $$
DECLARE prev_len int := 0; prev_score numeric := 99; r record; seen int := 0;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOR r IN SELECT name, score FROM public.fitbrother_foods_autocomplete('ovo', 50) WHERE kind = 'catalog' LOOP
    IF r.score > prev_score THEN RAISE EXCEPTION 'FAIL (j) score not descending at %', r.name; END IF;
    IF r.score = prev_score AND length(r.name) < prev_len THEN
      RAISE EXCEPTION 'FAIL (j) longer name % came before a shorter one with the same score', r.name;
    END IF;
    prev_score := r.score; prev_len := length(r.name); seen := seen + 1;
  END LOOP;
  RESET ROLE;
  IF seen < 2 THEN RAISE EXCEPTION 'FAIL (j) expected several "ovo" rows, got %', seen; END IF;
  RAISE NOTICE 'PASS (j) "ovo" orders by score then shorter name (% rows)', seen;
END $$;

-- (k) same food_id twice => one recent, with the newest use's quantity.
DO $$
DECLARE n int; q numeric; kc numeric; u text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*), max(quantity), max(kcal), max(unit::text) INTO n, q, kc, u
    FROM public.fitbrother_foods_autocomplete('meu arroz', 50)
   WHERE kind = 'recent' AND food_id = (SELECT f_arroz FROM _t);
  RESET ROLE;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL (k) expected 1 recent for the repeated food_id, got %', n; END IF;
  IF q <> 250 OR kc <> 320 OR u <> 'g' THEN
    RAISE EXCEPTION 'FAIL (k) expected newest use (250 g, 320 kcal), got % % %, % kcal', q, u, kc, kc;
  END IF;
  RAISE NOTICE 'PASS (k) repeated food_id collapses to one recent with the newest quantity';
END $$;

-- (l) recents without food_id group by normalized description + unit, newest use wins.
DO $$
DECLARE n_unit int; n_g int; q_unit numeric; r record;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) FILTER (WHERE unit = 'unit'), count(*) FILTER (WHERE unit = 'g'),
         max(quantity) FILTER (WHERE unit = 'unit')
    INTO n_unit, n_g, q_unit
    FROM public.fitbrother_foods_autocomplete('pao de queijo', 50) WHERE kind = 'recent';
  SELECT * INTO r FROM public.fitbrother_foods_autocomplete('pao de queijo', 50)
   WHERE kind = 'recent' AND unit = 'unit';
  RESET ROLE;
  IF n_unit <> 1 OR n_g <> 1 THEN
    RAISE EXCEPTION 'FAIL (l) expected 1 group per unit, got unit=% g=%', n_unit, n_g;
  END IF;
  -- m3 (2 h ago, 2 unit) is newer than m4 (5 h ago, 3 unit).
  IF q_unit <> 2 THEN RAISE EXCEPTION 'FAIL (l) newest use should be 2 unit, got %', q_unit; END IF;
  IF r.food_id IS NOT NULL OR r.kcal_per_100g IS NOT NULL OR r.serving_grams IS NOT NULL OR r.serving_label IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL (l) recent without food_id must have null catalog fields (%)', r;
  END IF;
  RAISE NOTICE 'PASS (l) recents without food_id group by description+unit';
END $$;

-- (m) recent rows rank above a catalog row with the same match score (+0.5).
DO $$
DECLARE first_kind text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT kind INTO first_kind FROM public.fitbrother_foods_autocomplete('pao', 8) LIMIT 1;
  RESET ROLE;
  IF first_kind <> 'recent' THEN RAISE EXCEPTION 'FAIL (m) recent should rank first for "pao", got %', first_kind; END IF;
  RAISE NOTICE 'PASS (m) recent outranks catalog at equal match';
END $$;

-- (n) 3+ characters fall back to similarity when nothing is a prefix.
DO $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('aroz', 50)
   WHERE kind = 'catalog' AND name = 'Arroz, tipo 1, cozido';
  RESET ROLE;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL (n) typo "aroz" should still find Arroz via similarity, got %', n; END IF;
  RAISE NOTICE 'PASS (n) similarity fallback finds "aroz" -> Arroz';
END $$;

-- (o) limit is respected and catalog rows carry no last-use fields.
DO $$
DECLARE n int; bad int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.fitbrother_foods_autocomplete('ba', 3);
  SELECT count(*) INTO bad FROM public.fitbrother_foods_autocomplete('ba', 50)
   WHERE kind = 'catalog' AND (quantity IS NOT NULL OR unit IS NOT NULL OR kcal IS NOT NULL
                               OR protein_g IS NOT NULL OR carbs_g IS NOT NULL OR fat_g IS NOT NULL);
  RESET ROLE;
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL (o) p_limit=3 returned % rows', n; END IF;
  IF bad <> 0 THEN RAISE EXCEPTION 'FAIL (o) catalog rows carry last-use fields'; END IF;
  RAISE NOTICE 'PASS (o) limit respected; catalog rows have null last-use fields';
END $$;

-- (q) "feijao" at the production limit: the alias target comes first, raw beans after cooked ones.
DO $$
DECLARE first_name text; n_target int; max_cooked int; min_raw int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  CREATE TEMP TABLE _r ON COMMIT DROP AS
    SELECT row_number() OVER () AS pos, a.* FROM public.fitbrother_foods_autocomplete('feijao', 8) a;
  RESET ROLE;
  SELECT name INTO first_name FROM _r WHERE pos = 1;
  SELECT count(*) INTO n_target FROM _r WHERE name = 'Feijão, carioca, cozido';
  SELECT max(pos) INTO max_cooked FROM _r WHERE name ~* '\mcozid[oa]s?\M';
  SELECT min(pos) INTO min_raw FROM _r WHERE name ~* '\mcru[as]*\M';
  DROP TABLE _r;
  IF n_target <> 1 THEN RAISE EXCEPTION 'FAIL (q) "feijao" top-8 lacks Feijão, carioca, cozido'; END IF;
  IF first_name <> 'Feijão, carioca, cozido' THEN RAISE EXCEPTION 'FAIL (q) "feijao" first is %', first_name; END IF;
  IF min_raw IS NOT NULL AND min_raw < max_cooked THEN
    RAISE EXCEPTION 'FAIL (q) raw bean at % before a cooked one at %', min_raw, max_cooked;
  END IF;
  RAISE NOTICE 'PASS (q) "feijao" (limit 8): Feijão, carioca, cozido first, cooked before raw';
END $$;

-- (r) "arroz": cooked rice before raw rice; the alias target first.
DO $$
DECLARE first_name text; max_cooked int; min_raw int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  CREATE TEMP TABLE _r ON COMMIT DROP AS
    SELECT row_number() OVER () AS pos, a.* FROM public.fitbrother_foods_autocomplete('arroz', 8) a;
  RESET ROLE;
  SELECT name INTO first_name FROM _r WHERE pos = 1;
  SELECT max(pos) INTO max_cooked FROM _r WHERE name LIKE 'Arroz,%cozido';
  SELECT min(pos) INTO min_raw FROM _r WHERE name ~* '\mcru[as]*\M';
  DROP TABLE _r;
  IF first_name <> 'Arroz, tipo 1, cozido' THEN RAISE EXCEPTION 'FAIL (r) "arroz" first is %', first_name; END IF;
  IF max_cooked IS NULL THEN RAISE EXCEPTION 'FAIL (r) no cooked rice in top-8'; END IF;
  IF min_raw IS NOT NULL AND min_raw < max_cooked THEN
    RAISE EXCEPTION 'FAIL (r) raw rice at % before cooked rice at %', min_raw, max_cooked;
  END IF;
  RAISE NOTICE 'PASS (r) "arroz" (limit 8): Arroz, tipo 1, cozido first, cooked before raw';
END $$;

-- (s) "ovo": the first suggestion is not a raw or quail egg.
DO $$
DECLARE first_name text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT name INTO first_name FROM public.fitbrother_foods_autocomplete('ovo', 8) LIMIT 1;
  RESET ROLE;
  IF first_name IS NULL OR first_name ~* '\mcru[as]*\M' OR first_name ~* 'codorna' THEN
    RAISE EXCEPTION 'FAIL (s) "ovo" first is %', first_name;
  END IF;
  RAISE NOTICE 'PASS (s) "ovo" (limit 8) first is %', first_name;
END $$;

-- (t) "leite" never returns a 0-kcal catalog row.
DO $$
DECLARE n int; n_zero int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*), count(*) FILTER (WHERE kcal_per_100g = 0) INTO n, n_zero
    FROM public.fitbrother_foods_autocomplete('leite', 8);
  RESET ROLE;
  IF n = 0 THEN RAISE EXCEPTION 'FAIL (t) "leite" returned nothing'; END IF;
  IF n_zero <> 0 THEN RAISE EXCEPTION 'FAIL (t) "leite" returned % rows with 0 kcal', n_zero; END IF;
  RAISE NOTICE 'PASS (t) "leite" (limit 8) has no 0-kcal rows (% rows)', n;
END $$;

-- (u) asking for raw keeps raw foods up front (no demotion).
DO $$
DECLARE first_name text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT uid2 FROM _t), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT name INTO first_name FROM public.fitbrother_foods_autocomplete('feijao cru', 8) LIMIT 1;
  RESET ROLE;
  IF first_name IS NULL OR first_name !~* '^feij.*\mcru\M' THEN
    RAISE EXCEPTION 'FAIL (u) "feijao cru" first is %', first_name;
  END IF;
  RAISE NOTICE 'PASS (u) "feijao cru" first is %', first_name;
END $$;

-- (p) anon cannot call it; authenticated can.
DO $$
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM * FROM public.fitbrother_foods_autocomplete('arroz');
    RAISE EXCEPTION 'FAIL (p) anon executed the function';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS (p) anon EXECUTE denied';
  END;
  RESET ROLE;
END $$;

ROLLBACK;
