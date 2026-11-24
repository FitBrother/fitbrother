-- Smoke test 0087: fitbrother_foods_fuzzy_match on the real TACO catalog (0083 + 0084), threshold 0.4 as matchFood uses.
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

  -- Single-word needles need similarity >= 0.5, so weak matches fall back to the LLM macros.
  FOR c IN SELECT * FROM (VALUES
    ('leite',    'cow milk is not in TACO; "Leite, de coco" (0.43) must not override the LLM'),
    ('macarrao', 'TACO has no cooked pasta; LLM macros are kept instead of raw/instant pasta'),
    ('ovo',      'weak 0.4 match to fried egg must not override the LLM'),
    ('frango',   'weak 0.44 match to grilled breast must not override the LLM')
  ) AS t(needle, why) LOOP
    SELECT count(*) INTO n FROM public.fitbrother_foods_fuzzy_match(c.needle, 0.4);
    IF n <> 0 THEN RAISE EXCEPTION 'FAIL "%" returned % rows, expected 0 (%)', c.needle, n, c.why; END IF;
    RAISE NOTICE 'PASS "%" returns nothing (%)', c.needle, c.why;
  END LOOP;

  -- Single words with a strong or alias match still resolve.
  FOR c IN SELECT * FROM (VALUES
    ('arroz',       '^Arroz, tipo 1, cozido$'),
    ('banana',      '^Banana, prata, crua$'),
    ('pao frances', '^Pão, trigo, francês$'),
    ('queijo',      '^Queijo, prato$'),
    ('tomate',      '^Tomate, purê$')
  ) AS t(needle, expected) LOOP
    SELECT name INTO top FROM public.fitbrother_foods_fuzzy_match(c.needle, 0.4) LIMIT 1;
    IF top IS NULL OR top !~ c.expected THEN
      RAISE EXCEPTION 'FAIL "%" top-1 is %, expected %', c.needle, top, c.expected;
    END IF;
    RAISE NOTICE 'PASS "%" -> %', c.needle, top;
  END LOOP;

  -- The 0.5 floor applies to every row of a single-word needle, not only the top-1.
  SELECT count(*) INTO n FROM public.fitbrother_foods_fuzzy_match('arroz', 0.4) WHERE similarity < 0.5;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL "arroz" returned % rows below 0.5', n; END IF;
  RAISE NOTICE 'PASS single-word needle returns only similarity >= 0.5';

  -- A caller threshold above the floor still wins.
  SELECT count(*) INTO n FROM public.fitbrother_foods_fuzzy_match('queijo', 0.6);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL "queijo" at 0.6 returned % rows', n; END IF;
  RAISE NOTICE 'PASS threshold above 0.5 is honored for single words';

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
