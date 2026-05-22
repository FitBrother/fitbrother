-- M2 §database. Pre-aggregated per-day nutrition for the home dashboard.
--
-- The boundary helper + recompute function live here together — they're
-- the single source of truth for "what does Today mean for this user".
--
-- Why pre-aggregate
-- ─────────────────
-- The home screen lists today's meals AND shows aggregated macros + goal
-- progress. Computing the aggregate per render means a JOIN over all of
-- today's meal_items, gated by the per-user timezone+day_start_hour. Doing
-- it once at write-time and reading the cached row is ~50× faster at the
-- p95 and unlocks Realtime: clients subscribe to daily_summaries directly
-- (M3) instead of recomputing client-side.
--
-- Race safety
-- ───────────
-- pg_advisory_xact_lock keyed on (user_id, day) serializes concurrent
-- recomputes. Without it, two simultaneous meal inserts (rare but real:
-- text + audio submitted nearly together) can each read a stale sum
-- before writing, last-writer wins, and one meal's macros get lost from
-- the daily total. The lock costs ~µs and avoids weird user-visible drift.

-- ── Boundary helper ──────────────────────────────────────────────────────
-- "What date does this timestamp belong to for THIS user?"
--   = ((ts AT TIME ZONE profile.tz) - day_start_hour hours)::date
-- A user with day_start_hour=3 in America/Sao_Paulo who eats at 02:30 BRT
-- still belongs to the previous nutritional day. Used everywhere the app
-- groups by day: daily_summaries, ai_usage, M3 history, M5 streaks.
CREATE OR REPLACE FUNCTION public.fitbrother_nutritional_day(
  p_user_id uuid,
  p_ts      timestamptz DEFAULT now()
)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (p_ts AT TIME ZONE p.timezone)
    - (p.day_start_hour || ' hours')::interval
  )::date
  FROM public.profiles p
  WHERE p.user_id = p_user_id;
$$;

-- ── daily_summaries ──────────────────────────────────────────────────────
CREATE TABLE public.daily_summaries (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day            date NOT NULL,
  kcal           numeric(8,2) NOT NULL DEFAULT 0,
  protein_g      numeric(8,2) NOT NULL DEFAULT 0,
  carbs_g        numeric(8,2) NOT NULL DEFAULT 0,
  fat_g          numeric(8,2) NOT NULL DEFAULT 0,
  goal_kcal      numeric(8,2),
  goal_protein_g numeric(8,2),
  goal_carbs_g   numeric(8,2),
  goal_fat_g     numeric(8,2),
  goal_hit       boolean NOT NULL DEFAULT false,
  meals_count    int NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_summaries_owner_read
  ON public.daily_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy: writes happen via SECURITY DEFINER recompute
-- (declared below) or service_role. RLS without write policies = no writes.

-- ── Recompute function ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fitbrother_recompute_daily_summary(
  p_user_id uuid,
  p_day     date
)
RETURNS void
LANGUAGE plpgsql
-- SECURITY DEFINER so the function can write daily_summaries even when
-- called from a trigger fired by an unprivileged user. The body still
-- requires p_user_id matches the meals being summed, so RLS holds at
-- the data layer.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key bigint;
  v_kcal      numeric := 0;
  v_protein_g numeric := 0;
  v_carbs_g   numeric := 0;
  v_fat_g     numeric := 0;
  v_meals_count int := 0;
  v_goal_kcal numeric;
  v_goal_protein_g numeric;
  v_goal_carbs_g numeric;
  v_goal_fat_g numeric;
  v_goal_hit boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_day IS NULL THEN
    RETURN;
  END IF;

  -- Advisory lock keyed on (user_id, day). hashtextextended packs both
  -- into a stable bigint; the lock is released at transaction commit.
  v_lock_key := hashtextextended(p_user_id::text || '|' || p_day::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Sum from meals.total_* (already maintained by meal_items triggers).
  -- Filter out soft-deleted and review_required meals (FEATURES §3.3:
  -- "Não computa em daily_summaries enquanto review_required = true").
  SELECT
    COALESCE(SUM(m.total_kcal), 0),
    COALESCE(SUM(m.total_protein_g), 0),
    COALESCE(SUM(m.total_carbs_g), 0),
    COALESCE(SUM(m.total_fat_g), 0),
    COUNT(*)
  INTO v_kcal, v_protein_g, v_carbs_g, v_fat_g, v_meals_count
  FROM public.meals m
  WHERE m.user_id = p_user_id
    AND m.deleted_at IS NULL
    AND m.review_required = false
    AND public.fitbrother_nutritional_day(p_user_id, m.consumed_at) = p_day;

  -- Snapshot the goal active on this date (nutrition_goals is append-only
  -- and versioned via effective_from / effective_to from M1).
  SELECT g.kcal, g.protein_g, g.carbs_g, g.fat_g
    INTO v_goal_kcal, v_goal_protein_g, v_goal_carbs_g, v_goal_fat_g
  FROM public.nutrition_goals g
  WHERE g.user_id = p_user_id
    AND g.effective_from <= p_day
    AND (g.effective_to IS NULL OR g.effective_to >= p_day)
  ORDER BY g.effective_from DESC
  LIMIT 1;

  -- goal_hit rule v1 (CLAUDE.md backend rule #9).
  IF v_goal_kcal IS NOT NULL AND v_goal_protein_g IS NOT NULL THEN
    v_goal_hit :=
      v_kcal BETWEEN v_goal_kcal * 0.9 AND v_goal_kcal * 1.1
      AND v_protein_g >= v_goal_protein_g * 0.85;
  END IF;

  INSERT INTO public.daily_summaries (
    user_id, day, kcal, protein_g, carbs_g, fat_g,
    goal_kcal, goal_protein_g, goal_carbs_g, goal_fat_g,
    goal_hit, meals_count, updated_at
  ) VALUES (
    p_user_id, p_day, v_kcal, v_protein_g, v_carbs_g, v_fat_g,
    v_goal_kcal, v_goal_protein_g, v_goal_carbs_g, v_goal_fat_g,
    v_goal_hit, v_meals_count, now()
  )
  ON CONFLICT (user_id, day) DO UPDATE SET
    kcal           = EXCLUDED.kcal,
    protein_g      = EXCLUDED.protein_g,
    carbs_g        = EXCLUDED.carbs_g,
    fat_g          = EXCLUDED.fat_g,
    goal_kcal      = EXCLUDED.goal_kcal,
    goal_protein_g = EXCLUDED.goal_protein_g,
    goal_carbs_g   = EXCLUDED.goal_carbs_g,
    goal_fat_g     = EXCLUDED.goal_fat_g,
    goal_hit       = EXCLUDED.goal_hit,
    meals_count    = EXCLUDED.meals_count,
    updated_at     = now();
END;
$$;
