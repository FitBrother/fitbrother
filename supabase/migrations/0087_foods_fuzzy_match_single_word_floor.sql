-- Single-word needles need similarity >= 0.5 so weak catalog matches keep the LLM macros.

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
  WITH cand AS (
    SELECT f.id AS food_id,
           similarity(f.name_normalized, p_needle) AS sim,
           CASE
             WHEN f.name_normalized ~ '\m(cru|crua|crus|cruas)\M'
              AND p_needle !~ '\m(cru|crua|crus|cruas)\M'
             THEN 0.2 ELSE 0
           END AS penalty
      FROM public.foods f
     WHERE f.verified = true
       AND f.name_normalized % p_needle
    UNION ALL
    SELECT a.food_id, similarity(a.alias_normalized, p_needle), 0
      FROM public.food_aliases a
      JOIN public.foods f ON f.id = a.food_id AND f.verified = true
     WHERE a.alias_normalized % p_needle
  ),
  best AS (
    SELECT c.food_id, max(c.sim) AS sim, max(c.sim - c.penalty) AS rank_score
      FROM cand c
     GROUP BY c.food_id
  )
  SELECT f.id,
         f.name,
         f.kcal_per_100g,
         f.protein_per_100g,
         f.carbs_per_100g,
         f.fat_per_100g,
         f.serving_grams,
         b.sim::numeric AS similarity
    FROM best b
    JOIN public.foods f ON f.id = b.food_id
   WHERE b.sim >= CASE WHEN btrim(p_needle) ~ '\s'
                       THEN p_threshold
                       ELSE GREATEST(p_threshold, 0.5) END
   ORDER BY b.rank_score DESC,
            length(f.name_normalized) ASC
   LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.fitbrother_foods_fuzzy_match(text, numeric)
  TO authenticated, anon;
