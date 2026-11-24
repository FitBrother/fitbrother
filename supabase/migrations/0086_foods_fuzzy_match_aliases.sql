-- fitbrother_foods_fuzzy_match (pipeline de IA, matchFood) passa a usar
-- food_aliases e a preferir o alimento preparado ao cru.
--
-- Com o catálogo TACO completo (0083) o match só por nome escolhia variantes
-- cruas ou alimentos errados ("feijao carioca" -> "Feijão, carioca, cru",
-- "ovo cozido" -> "Cará, cozido"). Mesma assinatura e colunas da 0020
-- (imutável); o servidor e o limiar 0.4 não mudam.
--
--   * Candidatos: nome (`name_normalized`) e aliases de alimentos verified;
--     vale a melhor similarity de cada alimento.
--   * Filtro: similarity real >= p_threshold (como antes).
--   * Ordem: similarity, menos 0.2 quando o match veio do nome, o nome tem a
--     palavra cru/crua/crus/cruas e o termo não tem. Alias não é rebaixado
--     (é curadoria). Desempate: nome mais curto.
--   * A coluna `similarity` devolve a similarity real (sem o rebaixamento).

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
   WHERE b.sim >= p_threshold
   ORDER BY b.rank_score DESC,
            length(f.name_normalized) ASC
   LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.fitbrother_foods_fuzzy_match(text, numeric)
  TO authenticated, anon;
