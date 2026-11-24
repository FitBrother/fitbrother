-- Smoke test 0086: fitbrother_foods_fuzzy_match on the real TACO catalog (0083 + 0084), threshold 0.4 as matchFood uses.
\set ON_ERROR_STOP on
BEGIN;

-- Needles arrive normalized by matchFood (lower, no accents, no commas).
DO $$
DECLARE
  c record; top text; n int;
BEGIN
  SET LOCAL ROLE authenticated;
  FOR c IN SELECT * FROM (VALUES
    ('feijao carioca',  '^Feijão, carioca, cozido$'),
    ('feijao',          '^Feijão, .*cozido$'),
    ('ovo cozido',      '^Ovo, de galinha, inteiro, cozido/10minutos$'),
    ('frango grelhado', '^Frango, peito, sem pele, grelhado$'),
    ('batata doce',     '^Batata, doce, cozida$'),
    ('arroz branco',    '^Arroz, tipo 1, cozido$'),
    ('feijao cru',      '^Feijão, .*\mcru$')
  ) AS t(needle, expected) LOOP
    SELECT name INTO top FROM public.fitbrother_foods_fuzzy_match(c.needle, 0.4) LIMIT 1;
    IF top IS NULL OR top !~ c.expected THEN
      RAISE EXCEPTION 'FAIL "%" top-1 is %, expected %', c.needle, top, c.expected;
    END IF;
    RAISE NOTICE 'PASS "%" -> %', c.needle, top;
  END LOOP;

  -- TACO has no cooked pasta: the top-1 must at least not be a raw one.
  SELECT name INTO top FROM public.fitbrother_foods_fuzzy_match('macarrao', 0.4) LIMIT 1;
  IF top IS NULL OR top !~* '^macarr' OR top ~* '\mcru[as]*\M' THEN
    RAISE EXCEPTION 'FAIL "macarrao" top-1 is %', top;
  END IF;
  RAISE NOTICE 'PASS "macarrao" -> % (not raw; TACO has no cooked pasta)', top;

  -- Unrelated noise still misses at 0.4.
  SELECT count(*) INTO n FROM public.fitbrother_foods_fuzzy_match('xyzzy plugh', 0.4);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL noise matched % rows', n; END IF;
  RAISE NOTICE 'PASS noise returns nothing';
  RESET ROLE;
END $$;

-- The similarity column stays the true similarity (best of name/alias), never the demoted ranking score.
DO $$
DECLARE r record;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT * INTO r FROM public.fitbrother_foods_fuzzy_match('ovo cozido', 0.4) LIMIT 1;
  IF r.similarity <> 1 THEN RAISE EXCEPTION 'FAIL exact alias should report similarity 1, got %', r.similarity; END IF;
  FOR r IN SELECT * FROM public.fitbrother_foods_fuzzy_match('feijao', 0.4) LOOP
    IF r.similarity < 0.4 OR r.similarity > 1 THEN
      RAISE EXCEPTION 'FAIL similarity out of range for %: %', r.name, r.similarity;
    END IF;
  END LOOP;
  RESET ROLE;
  RAISE NOTICE 'PASS similarity column is the real similarity';
END $$;

-- Unverified foods never match, by name or by alias.
DO $$
DECLARE fid uuid; n int;
BEGIN
  INSERT INTO public.foods (name, name_normalized, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source, verified)
  VALUES ('Zzcomida, teste', 'zzcomida teste', 100, 1, 1, 1, 'user', false) RETURNING id INTO fid;
  INSERT INTO public.food_aliases (food_id, alias, alias_normalized) VALUES (fid, 'qqalias teste', 'qqalias teste');
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.fitbrother_foods_fuzzy_match('zzcomida teste', 0.4) WHERE id = fid;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL unverified food matched by name'; END IF;
  SELECT count(*) INTO n FROM public.fitbrother_foods_fuzzy_match('qqalias teste', 0.4) WHERE id = fid;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL unverified food matched by alias'; END IF;
  RESET ROLE;
  -- Also as a superuser (bypasses RLS): the verified filter lives in the function.
  SELECT count(*) INTO n FROM public.fitbrother_foods_fuzzy_match('qqalias teste', 0.4) WHERE id = fid;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL unverified food matched by alias without RLS'; END IF;
  RAISE NOTICE 'PASS unverified foods never match';
END $$;

-- At most 5 rows, one per food.
DO $$
DECLARE n int; d int;
BEGIN
  SELECT count(*), count(DISTINCT id) INTO n, d FROM public.fitbrother_foods_fuzzy_match('feijao', 0.4);
  IF n > 5 OR n <> d THEN RAISE EXCEPTION 'FAIL expected <=5 distinct foods, got % rows / % distinct', n, d; END IF;
  RAISE NOTICE 'PASS at most 5 rows, one per food (%)', n;
END $$;

ROLLBACK;
