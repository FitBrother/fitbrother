-- M2 §database. Canonical food catalog (TACO/USDA/etc) used to anchor LLM
-- macro extraction. Items in meal_items optionally reference foods.id; when a
-- fuzzy match lands on a verified row, the LLM macros are replaced by the
-- catalog's (proportionally to quantity × unit) to keep nutritional accuracy.
--
-- Trigram fuzzy match (pg_trgm) is the lookup strategy. The GIN index on
-- name_normalized makes "arroz cozido" → "Arroz, integral, cozido" feasible
-- at ~1ms even with USDA's 7k rows in v2.
--
-- Global catalog: no per-user RLS. Anon/auth can SELECT verified rows;
-- only service_role can INSERT/UPDATE/DELETE (seed + future curation).

CREATE TABLE public.foods (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  name_normalized     text NOT NULL,
  serving_label       text,
  serving_grams       numeric(7,2)
                        CHECK (serving_grams IS NULL OR serving_grams > 0),
  kcal_per_100g       numeric(7,2) NOT NULL CHECK (kcal_per_100g >= 0),
  protein_per_100g    numeric(7,2) NOT NULL CHECK (protein_per_100g >= 0),
  carbs_per_100g      numeric(7,2) NOT NULL CHECK (carbs_per_100g >= 0),
  fat_per_100g        numeric(7,2) NOT NULL CHECK (fat_per_100g >= 0),
  source              food_source NOT NULL,
  verified            boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Seed idempotency: TACO entries are uniquely identified by (source, name).
-- USDA/OFF can share (name) across sources, which is intentional.
CREATE UNIQUE INDEX foods_source_name_unique
  ON public.foods (source, name);

-- Fuzzy match index (CLAUDE.md backend rule §3 — catálogo é a âncora de macros).
CREATE INDEX foods_name_normalized_trgm
  ON public.foods USING GIN (name_normalized gin_trgm_ops);

-- Filtered lookup: M2 services always query `WHERE verified=true`.
CREATE INDEX foods_verified_source_idx
  ON public.foods (verified, source);

CREATE TRIGGER foods_set_updated_at
  BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Read: any authenticated user can read verified entries.
-- Write: only service_role (seed/curation). Anon and authenticated cannot
-- INSERT, UPDATE or DELETE, even though FORCE is not strictly required.
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY foods_read_verified
  ON public.foods
  FOR SELECT
  TO authenticated, anon
  USING (verified = true);
