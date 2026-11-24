-- Autocomplete de alimentos na edição de refeição.
--
-- Une, numa lista só, (1) o catálogo `foods` (por nome e por alias de
-- `food_aliases`) e (2) os "recentes" do usuário (itens de `meal_items` dos
-- últimos 90 dias). SECURITY INVOKER: a RLS de `meals`/`meal_items` resolve os
-- recentes via auth.uid(); `foods`/`food_aliases` só expõem linhas verified.
--
-- Regras (spec 2026-11-24-autocomplete-alimentos-edicao, Entrega 2):
--   * p_query chega normalizado do servidor, mas é normalizado de novo aqui
--     (lower + unaccent, vírgulas -> espaço, espaços colapsados) para a função
--     ser segura chamada direto.
--   * ''           -> só recentes (por frequência, depois recência).
--   * 1 caractere  -> vazio.
--   * 2 caracteres -> só prefixo (início do nome/alias ou de qualquer palavra).
--   * 3+           -> prefixo primeiro, depois similarity >= 0.3.
--   * score: alias igual ao termo 4, alias começando pelo termo 3.5, nome
--     começando pelo termo 3, início de palavra 2, similarity no resto;
--     recentes somam 0.5. Desempate: recente antes de catálogo, depois nome
--     mais curto.
--   * Nome com a palavra cru/crua/crus/cruas perde 0.5 quando o termo não
--     tem essa palavra ("feijao" prefere o cozido; "feijao cru" não rebaixa).
--     Só o score vindo do nome é rebaixado; alias é curadoria e vale inteiro.
--   * Recente com food_id suprime a linha de catálogo do mesmo food_id. Um
--     recente com food_id também casa pelo nome/alias do alimento vinculado,
--     assim a supressão nunca esconde o único caminho até aquele alimento.
--   * Recentes agrupados por food_id (ou, sem food_id, por descrição
--     normalizada + unit); vale o uso mais recente do grupo.
--   * `%`, `_` e `\` do termo são escapados no LIKE.

CREATE OR REPLACE FUNCTION public.fitbrother_foods_autocomplete(
  p_query text,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  kind             text,
  food_id          uuid,
  name             text,
  serving_label    text,
  serving_grams    numeric,
  kcal_per_100g    numeric,
  protein_per_100g numeric,
  carbs_per_100g   numeric,
  fat_per_100g     numeric,
  quantity         numeric,
  unit             unit,
  kcal             numeric,
  protein_g        numeric,
  carbs_g          numeric,
  fat_g            numeric,
  score            numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
#variable_conflict use_column
DECLARE
  v_term text;
  v_len  int;
  v_esc  text;
  v_raw_ok boolean;
BEGIN
  v_term := btrim(regexp_replace(
              replace(lower(unaccent(coalesce(p_query, ''))), ',', ' '),
              '\s+', ' ', 'g'));
  v_len := length(v_term);

  IF v_len = 1 THEN
    RETURN;
  END IF;

  v_raw_ok := v_term ~ '\m(cru|crua|crus|cruas)\M';
  v_esc := replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  WITH
  -- Catalog candidates: canonical names and aliases, filtered so the trigram
  -- GIN indexes can serve LIKE and `%`.
  cand AS (
    SELECT f.id AS cand_food_id, f.name_normalized AS txt, false AS is_alias,
           (NOT v_raw_ok AND f.name_normalized ~ '\m(cru|crua|crus|cruas)\M') AS demote
      FROM public.foods f
     WHERE v_len >= 2
       AND f.verified = true
       AND (f.name_normalized LIKE v_esc || '%' ESCAPE '\'
            OR f.name_normalized LIKE '% ' || v_esc || '%' ESCAPE '\'
            OR (v_len >= 3 AND f.name_normalized % v_term))
    UNION ALL
    SELECT a.food_id, a.alias_normalized, true, false
      FROM public.food_aliases a
      JOIN public.foods f ON f.id = a.food_id AND f.verified = true
     WHERE v_len >= 2
       AND (a.alias_normalized LIKE v_esc || '%' ESCAPE '\'
            OR a.alias_normalized LIKE '% ' || v_esc || '%' ESCAPE '\'
            OR (v_len >= 3 AND a.alias_normalized % v_term))
  ),
  catalog_best AS (
    SELECT s.cand_food_id, max(s.sc - CASE WHEN s.demote THEN 0.5 ELSE 0 END) AS sc
      FROM (
        SELECT c.cand_food_id, c.demote,
               CASE
                 WHEN c.is_alias AND c.txt = v_term THEN 4::numeric
                 WHEN c.is_alias AND c.txt LIKE v_esc || '%' ESCAPE '\' THEN 3.5::numeric
                 WHEN c.txt LIKE v_esc || '%' ESCAPE '\' THEN 3::numeric
                 WHEN c.txt LIKE '% ' || v_esc || '%' ESCAPE '\' THEN 2::numeric
                 WHEN v_len >= 3 AND similarity(c.txt, v_term) >= 0.3
                   THEN similarity(c.txt, v_term)::numeric
               END AS sc
          FROM cand c
      ) s
     WHERE s.sc IS NOT NULL
     GROUP BY s.cand_food_id
  ),
  recent_raw AS (
    SELECT mi.food_id AS mi_food_id,
           mi.description,
           btrim(regexp_replace(replace(lower(unaccent(mi.description)), ',', ' '),
                                '\s+', ' ', 'g')) AS norm_desc,
           mi.quantity, mi.unit, mi.kcal, mi.protein_g, mi.carbs_g, mi.fat_g,
           m.consumed_at, mi.created_at
      FROM public.meal_items mi
      JOIN public.meals m ON m.id = mi.meal_id
     WHERE m.user_id = auth.uid()
       AND m.deleted_at IS NULL
       AND mi.deleted_at IS NULL
       AND m.consumed_at >= now() - interval '90 days'
       AND (v_len = 0 OR v_len >= 2)
  ),
  recent_groups AS (
    SELECT DISTINCT ON (g.gkey)
           g.mi_food_id, g.description, g.norm_desc, g.quantity, g.unit,
           g.kcal, g.protein_g, g.carbs_g, g.fat_g, g.consumed_at,
           count(*) OVER (PARTITION BY g.gkey) AS uses
      FROM (
        SELECT r.*, COALESCE(r.mi_food_id::text, r.norm_desc || '|' || r.unit::text) AS gkey
          FROM recent_raw r
      ) g
     ORDER BY g.gkey, g.consumed_at DESC, g.created_at DESC
  ),
  recent_scored AS (
    SELECT rg.*,
           CASE
             WHEN v_len = 0 THEN 0::numeric
             ELSE greatest(
               CASE
                 WHEN rg.norm_desc LIKE v_esc || '%' ESCAPE '\' THEN 3::numeric
                 WHEN rg.norm_desc LIKE '% ' || v_esc || '%' ESCAPE '\' THEN 2::numeric
                 WHEN v_len >= 3 AND similarity(rg.norm_desc, v_term) >= 0.3
                   THEN similarity(rg.norm_desc, v_term)::numeric
               END,
               cb.sc)
           END AS sc
      FROM recent_groups rg
      LEFT JOIN catalog_best cb ON cb.cand_food_id = rg.mi_food_id
  ),
  recent_rows AS (
    SELECT 'recent'::text AS kind,
           f.id AS food_id,
           rs.description AS name,
           f.serving_label,
           f.serving_grams::numeric AS serving_grams,
           f.kcal_per_100g::numeric,
           f.protein_per_100g::numeric,
           f.carbs_per_100g::numeric,
           f.fat_per_100g::numeric,
           rs.quantity::numeric AS quantity,
           rs.unit AS unit,
           rs.kcal::numeric AS kcal,
           rs.protein_g::numeric AS protein_g,
           rs.carbs_g::numeric AS carbs_g,
           rs.fat_g::numeric AS fat_g,
           (rs.sc + 0.5)::numeric AS score,
           rs.uses AS uses,
           rs.consumed_at AS last_at
      FROM recent_scored rs
      LEFT JOIN public.foods f ON f.id = rs.mi_food_id
     WHERE rs.sc IS NOT NULL
  ),
  catalog_rows AS (
    SELECT 'catalog'::text AS kind,
           f.id AS food_id,
           f.name AS name,
           f.serving_label,
           f.serving_grams::numeric AS serving_grams,
           f.kcal_per_100g::numeric,
           f.protein_per_100g::numeric,
           f.carbs_per_100g::numeric,
           f.fat_per_100g::numeric,
           NULL::numeric AS quantity,
           NULL::unit AS unit,
           NULL::numeric AS kcal,
           NULL::numeric AS protein_g,
           NULL::numeric AS carbs_g,
           NULL::numeric AS fat_g,
           cb.sc AS score,
           NULL::bigint AS uses,
           NULL::timestamptz AS last_at
      FROM catalog_best cb
      JOIN public.foods f ON f.id = cb.cand_food_id
     WHERE NOT EXISTS (SELECT 1 FROM recent_rows rr WHERE rr.food_id = f.id)
  )
  SELECT u.kind, u.food_id, u.name, u.serving_label, u.serving_grams,
         u.kcal_per_100g, u.protein_per_100g, u.carbs_per_100g, u.fat_per_100g,
         u.quantity, u.unit, u.kcal, u.protein_g, u.carbs_g, u.fat_g, u.score
    FROM (
      SELECT * FROM recent_rows
      UNION ALL
      SELECT * FROM catalog_rows
    ) u
   ORDER BY u.score DESC,
            (u.kind = 'recent') DESC,
            CASE WHEN v_len = 0 THEN u.uses END DESC NULLS LAST,
            CASE WHEN v_len = 0 THEN u.last_at END DESC NULLS LAST,
            length(u.name) ASC,
            u.last_at DESC NULLS LAST,
            u.name ASC
   LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.fitbrother_foods_autocomplete(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fitbrother_foods_autocomplete(text, int) TO authenticated;
