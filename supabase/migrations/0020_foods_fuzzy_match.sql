-- M2 §services. RPC wrapper around the foods trigram lookup.
--
-- Why an RPC instead of inlining the query
-- ─────────────────────────────────────────
-- PostgREST doesn't expose pg_trgm's `%` operator from the .from().select()
-- builder. Wrapping the query in a function gives the server side a clean
-- supabase.rpc('...') call with type-safe params + similarity ordering.
--
-- The function is callable by `authenticated` users (it only reads the
-- foods catalog, which is global and protected by foods_read_verified
-- policy). No SECURITY DEFINER needed.

CREATE OR REPLACE FUNCTION public.fitbrother_foods_fuzzy_match(
  p_needle    text,
  p_threshold numeric DEFAULT 0.4
)
RETURNS TABLE (
  id               uuid,
  name             text,
  kcal_per_100g    numeric,
  protein_per_100g numeric,
  carbs_per_100g   numeric,
  fat_per_100g     numeric,
  serving_grams    numeric,
  similarity       numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id,
    f.name,
    f.kcal_per_100g,
    f.protein_per_100g,
    f.carbs_per_100g,
    f.fat_per_100g,
    f.serving_grams,
    similarity(f.name_normalized, p_needle)::numeric AS similarity
  FROM public.foods f
  WHERE f.verified = true
    AND f.name_normalized % p_needle
    AND similarity(f.name_normalized, p_needle) >= p_threshold
  ORDER BY similarity(f.name_normalized, p_needle) DESC,
           length(f.name_normalized) ASC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.fitbrother_foods_fuzzy_match(text, numeric)
  TO authenticated, anon;
