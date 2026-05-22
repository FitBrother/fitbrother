-- M1 §backend. Atomic onboarding: profiles + anthropometrics + nutrition_goals
-- + subscriptions + 3 consent_log rows in a single PL/pgSQL block.
--
-- SECURITY INVOKER (default): runs as the calling user, so RLS owner_all
-- on every table validates auth.uid() = user_id and the function only
-- works for the authenticated caller's own row.
--
-- Macro formulas (FEATURES §4.1 + PLAN.md §M1):
--   kcal      = TDEE * {lose:0.8, maintain:1.0, gain:1.1, recomp:0.95}
--   protein_g = weight_kg * {lose|recomp:2.0, maintain|gain:1.6}
--   fat_g     = kcal * 0.25 / 9
--   carbs_g   = (kcal - 4*protein_g - 9*fat_g) / 4

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

  INSERT INTO public.nutrition_goals (
    user_id, kcal, protein_g, carbs_g, fat_g
  )
  VALUES (uid, v_kcal, v_protein_g, v_carbs_g, v_fat_g)
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
