-- M1 §database. Versioned daily targets. `effective_to IS NULL` = active row.
-- Append-only: changing macros = insert new row + close previous one.

CREATE TABLE public.nutrition_goals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kcal           numeric(7,2) NOT NULL CHECK (kcal > 0),
  protein_g      numeric(7,2) NOT NULL CHECK (protein_g >= 0),
  carbs_g        numeric(7,2) NOT NULL CHECK (carbs_g >= 0),
  fat_g          numeric(7,2) NOT NULL CHECK (fat_g >= 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to   date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_goals_effective_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- At most one active goal per user.
CREATE UNIQUE INDEX nutrition_goals_active_per_user
  ON public.nutrition_goals (user_id)
  WHERE effective_to IS NULL;

CREATE INDEX nutrition_goals_user_effective_from_idx
  ON public.nutrition_goals (user_id, effective_from DESC);

-- ── RLS (owner_all) ───────────────────────────────────────────────────────
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY nutrition_goals_owner_all
  ON public.nutrition_goals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
