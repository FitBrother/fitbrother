-- Smoke test 0084: food_aliases seeded from taco-aliases.json, read-only for clients, verified-only visibility.
\set ON_ERROR_STOP on
BEGIN;

-- Expected alias count = total aliases in supabase/seed/taco-aliases.json.
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.food_aliases;
  IF n <> 47 THEN RAISE EXCEPTION 'FAIL seed: expected 47 aliases, got %', n; END IF;
  RAISE NOTICE 'PASS every alias in taco-aliases.json resolved to a food';
END $$;

-- authenticated and anon can read aliases of verified foods; writes denied.
DO $$
DECLARE
  n int;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.food_aliases;
  IF n <> 47 THEN RAISE EXCEPTION 'FAIL authenticated select: expected 47, got %', n; END IF;
  RAISE NOTICE 'PASS authenticated reads food_aliases';

  BEGIN
    INSERT INTO public.food_aliases (food_id, alias, alias_normalized)
    SELECT id, 'x', 'x' FROM public.foods LIMIT 1;
    RAISE EXCEPTION 'FAIL authenticated INSERT was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated INSERT denied';
  END;
  BEGIN
    UPDATE public.food_aliases SET alias = 'x';
    RAISE EXCEPTION 'FAIL authenticated UPDATE was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated UPDATE denied';
  END;
  BEGIN
    DELETE FROM public.food_aliases;
    RAISE EXCEPTION 'FAIL authenticated DELETE was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated DELETE denied';
  END;
  RESET ROLE;

  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.food_aliases;
  IF n <> 47 THEN RAISE EXCEPTION 'FAIL anon select: expected 47, got %', n; END IF;
  RAISE NOTICE 'PASS anon reads food_aliases';
  BEGIN
    INSERT INTO public.food_aliases (food_id, alias, alias_normalized)
    SELECT id, 'x', 'x' FROM public.foods LIMIT 1;
    RAISE EXCEPTION 'FAIL anon INSERT was not denied';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS anon INSERT denied';
  END;
  RESET ROLE;
END $$;

-- service_role writes; aliases of unverified foods stay hidden from clients.
DO $$
DECLARE
  f_unv uuid; f_ver uuid; n int;
BEGIN
  INSERT INTO public.foods (name, name_normalized, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source, verified)
  VALUES ('Smoke unverified', 'smoke unverified', 1, 1, 1, 1, 'user', false) RETURNING id INTO f_unv;
  INSERT INTO public.foods (name, name_normalized, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source, verified)
  VALUES ('Smoke verified', 'smoke verified', 1, 1, 1, 1, 'user', true) RETURNING id INTO f_ver;

  SET LOCAL ROLE service_role;
  INSERT INTO public.food_aliases (food_id, alias, alias_normalized)
  VALUES (f_unv, 'Smoke Alias Unv', 'smoke alias unv'), (f_ver, 'Smoke Alias Ver', 'smoke alias ver');
  RESET ROLE;
  RAISE NOTICE 'PASS service_role INSERT food_aliases';

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.food_aliases WHERE alias_normalized = 'smoke alias unv';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL authenticated sees alias of unverified food'; END IF;
  SELECT count(*) INTO n FROM public.food_aliases WHERE alias_normalized = 'smoke alias ver';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL authenticated cannot see alias of verified food'; END IF;
  RESET ROLE;
  RAISE NOTICE 'PASS alias of unverified food hidden from authenticated';

  -- Same (food_id, alias_normalized) is unique.
  BEGIN
    INSERT INTO public.food_aliases (food_id, alias, alias_normalized) VALUES (f_ver, 'Smoke  Alias Ver', 'smoke alias ver');
    RAISE EXCEPTION 'FAIL duplicate alias accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS (food_id, alias_normalized) is unique';
  END;

  -- Deleting the food cascades to its aliases.
  DELETE FROM public.foods WHERE id IN (f_unv, f_ver);
  SELECT count(*) INTO n FROM public.food_aliases WHERE food_id IN (f_unv, f_ver);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL cascade: % aliases left', n; END IF;
  RAISE NOTICE 'PASS deleting a food deletes its aliases';
END $$;

-- Trigram index exists on alias_normalized.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname = 'public' AND tablename = 'food_aliases'
                   AND indexdef ILIKE '%gin%' AND indexdef ILIKE '%alias_normalized%gin_trgm_ops%') THEN
    RAISE EXCEPTION 'FAIL no gin_trgm_ops index on alias_normalized';
  END IF;
  RAISE NOTICE 'PASS trigram index on alias_normalized';
END $$;

ROLLBACK;
