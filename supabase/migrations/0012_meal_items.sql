-- M2 §database. Items within a meal.
--
-- Snapshot semantics: macros are frozen at insert time. If the foods catalog
-- entry changes later (curation, version bump), historical meal_items keep
-- the macros that were actually counted toward the user's daily totals.
--
-- Soft delete is mirrored from the parent meal: when meals.deleted_at is set,
-- a trigger (see 0013) sets meal_items.deleted_at to the same instant. This
-- keeps the recompute logic uniform — both tables filter `WHERE deleted_at IS NULL`.
-- Hard CASCADE is still in place for `auth.users` deletion (LGPD §7.4).
--
-- `density_assumed`: set to true when the LLM gave us a `ml` quantity and we
-- applied density=1 for the catalog conversion. Lets us flag suspect rows
-- for future curation without re-running historical inference.

CREATE TABLE public.meal_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id           uuid NOT NULL
                      REFERENCES public.meals(id) ON DELETE CASCADE,
  food_id           uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  description       text NOT NULL,
  quantity          numeric(7,2) NOT NULL CHECK (quantity > 0),
  unit              unit NOT NULL,
  kcal              numeric(7,2) NOT NULL CHECK (kcal >= 0),
  protein_g         numeric(7,2) NOT NULL CHECK (protein_g >= 0),
  carbs_g           numeric(7,2) NOT NULL CHECK (carbs_g >= 0),
  fat_g             numeric(7,2) NOT NULL CHECK (fat_g >= 0),
  density_assumed   boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- Recompute path joins meal_items to meals on meal_id and filters by both
-- deleted_at columns. Composite index speeds the join + filter.
CREATE INDEX meal_items_meal_alive_idx
  ON public.meal_items (meal_id)
  WHERE deleted_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────
-- meal_items inherit ownership from the parent meal. No user_id column —
-- RLS resolves through the FK to keep a single source of truth.
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_items_owner_all
  ON public.meal_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meals m
       WHERE m.id = meal_items.meal_id
         AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meals m
       WHERE m.id = meal_items.meal_id
         AND m.user_id = auth.uid()
    )
  );
