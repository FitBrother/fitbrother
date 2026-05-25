-- M3.1 follow-up (originally an M1 bug). The onboarding function relied on
-- the column default `effective_from date NOT NULL DEFAULT CURRENT_DATE`
-- (0005_nutrition_goals.sql:11), but `CURRENT_DATE` resolves in the SERVER's
-- timezone, not the user's. A user in BRT (UTC-3) finishing onboarding right
-- after midnight UTC (= ~21:00 BRT the day before) gets a goal with
-- `effective_from = tomorrow (BRT)` — and their meals consumed that very
-- evening fall into a nutritional day where no goal is active, leaving
-- `daily_summaries.goal_*` NULL. The dashboard rings then render empty
-- because the schema has nothing to divide against.
--
-- Fix: in the onboarding function, set `effective_from` explicitly using
-- `fitbrother_nutritional_day(uid, now())` (added in 0014). That respects
-- the user's timezone + day_start_hour and matches whatever nutritional day
-- the user is in when they hit "complete".
--
-- Also backfill existing rows: for every goal where effective_from is later
-- than the user's nutritional day at the goal's created_at, walk it back to
-- that nutritional day. Then enqueue recompute of all daily_summaries
-- between the corrected effective_from and today, so cached goal_* snapshots
-- pick up the active goal.

CREATE OR REPLACE FUNCTION public.complete_onboarding(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  uid               uuid := auth.uid();
  v_birth_date      date  := (payload->>'birth_date')::date;
  v_sex             sex   := (payload->>'sex')::sex;
  v_activity_level  activity_level := (payload->>'activity_level')::activity_level;
  v_goal            goal  := (payload->>'goal')::goal;
  v_weight_kg       numeric := (payload->>'weight_kg')::numeric;
  v_height_cm       numeric := (payload->>'height_cm')::numeric;
  v_policy_version  text  := COALESCE(payload->'consents'->>'policy_version', 'v1.0');
  v_anthro_id       uuid;
  v_tdee            numeric;
  v_kcal_factor     numeric;
  v_protein_per_kg  numeric;
  v_kcal            numeric;
  v_protein_g       numeric;
  v_fat_g           numeric;
  v_carbs_g         numeric;
  v_goal_id         uuid;
  v_effective_from  date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires authenticated user';
  END IF;

  -- 1. profiles ------------------------------------------------------------
  INSERT INTO public.profiles (
    user_id, full_name, phone_e164, birth_date, sex,
    activity_level, goal, timezone, day_start_hour, locale,
    lgpd_consent_at
  )
  VALUES (
    uid,
    payload->>'full_name',
    NULLIF(payload->>'phone_e164', ''),
    v_birth_date,
    v_sex,
    v_activity_level,
    v_goal,
    payload->>'timezone',
    COALESCE((payload->>'day_start_hour')::smallint, 0),
    COALESCE(payload->>'locale', 'pt-BR'),
    now()
  );

  -- 2. anthropometrics (trigger fills bmr_kcal / tdee_kcal) ----------------
  INSERT INTO public.anthropometrics (user_id, weight_kg, height_cm)
  VALUES (uid, v_weight_kg, v_height_cm)
  RETURNING id, tdee_kcal INTO v_anthro_id, v_tdee;

  -- 3. nutrition_goals (derived from TDEE + goal) --------------------------
  v_kcal_factor := CASE v_goal
    WHEN 'lose'     THEN 0.80
    WHEN 'maintain' THEN 1.00
    WHEN 'gain'     THEN 1.10
    WHEN 'recomp'   THEN 0.95
  END;
  v_protein_per_kg := CASE v_goal
    WHEN 'lose'     THEN 2.0
    WHEN 'recomp'   THEN 2.0
    WHEN 'maintain' THEN 1.6
    WHEN 'gain'     THEN 1.6
  END;

  v_kcal      := ROUND(v_tdee * v_kcal_factor, 2);
  v_protein_g := ROUND(v_weight_kg * v_protein_per_kg, 2);
  v_fat_g     := ROUND(v_kcal * 0.25 / 9, 2);
  v_carbs_g   := ROUND((v_kcal - 4 * v_protein_g - 9 * v_fat_g) / 4, 2);
  IF v_carbs_g < 0 THEN v_carbs_g := 0; END IF;

  -- Compute effective_from in the USER's nutritional day, not server CURRENT_DATE.
  -- The profile insert above ran in the same transaction, so the row is visible
  -- to fitbrother_nutritional_day (uncommitted but readable inside the txn).
  v_effective_from := public.fitbrother_nutritional_day(uid, now());

  INSERT INTO public.nutrition_goals (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g
  )
  VALUES (uid, v_effective_from, v_kcal, v_protein_g, v_carbs_g, v_fat_g)
  RETURNING id INTO v_goal_id;

  -- 4. subscriptions (defaults: free / active) ------------------------------
  INSERT INTO public.subscriptions (user_id) VALUES (uid);

  -- 5. consent_log (terms / privacy / ai_processing) ------------------------
  INSERT INTO public.consent_log (user_id, scope, policy_version)
  VALUES
    (uid, 'terms',         v_policy_version),
    (uid, 'privacy',       v_policy_version),
    (uid, 'ai_processing', v_policy_version);

  RETURN jsonb_build_object(
    'user_id',           uid,
    'anthropometric_id', v_anthro_id,
    'nutrition_goal_id', v_goal_id,
    'tdee_kcal',         v_tdee,
    'kcal',              v_kcal,
    'protein_g',         v_protein_g,
    'carbs_g',           v_carbs_g,
    'fat_g',             v_fat_g
  );
END;
$$;

-- ── Backfill ─────────────────────────────────────────────────────────────
-- For every goal whose effective_from > nutritional_day(created_at), walk
-- effective_from back to that nutritional day. This corrects goals created
-- in the gap between server midnight (UTC) and user midnight (local TZ +
-- day_start_hour).
DO $backfill$
DECLARE
  r RECORD;
  v_correct_date date;
BEGIN
  FOR r IN
    SELECT g.id, g.user_id, g.effective_from, g.created_at
    FROM public.nutrition_goals g
    JOIN public.profiles p ON p.user_id = g.user_id
  LOOP
    v_correct_date := public.fitbrother_nutritional_day(r.user_id, r.created_at);
    IF v_correct_date IS NOT NULL AND r.effective_from > v_correct_date THEN
      UPDATE public.nutrition_goals
      SET effective_from = v_correct_date
      WHERE id = r.id;
      RAISE NOTICE 'backfill: goal % moved effective_from from % to %',
        r.id, r.effective_from, v_correct_date;
    END IF;
  END LOOP;
END;
$backfill$;

-- ── Recompute daily_summaries ────────────────────────────────────────────
-- After backfill, any daily_summary that overlaps the corrected goal window
-- needs its goal_* snapshot refreshed. Walk every (user, day) we currently
-- have a summary for and call recompute — it's idempotent and cheap.
DO $recompute$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, day
    FROM public.daily_summaries
  LOOP
    PERFORM public.fitbrother_recompute_daily_summary(r.user_id, r.day);
  END LOOP;
END;
$recompute$;
