-- M7.1 — Phone isolation. Moves phone fields from profiles to profiles_private.
CREATE TABLE public.profiles_private (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164        text UNIQUE,
  phone_hash        text,
  phone_verified_at timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles_private
  ADD CONSTRAINT profiles_private_phone_e164_format
  CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

CREATE INDEX profiles_private_phone_hash_idx ON public.profiles_private (phone_hash)
  WHERE phone_hash IS NOT NULL;

CREATE TRIGGER profiles_private_set_updated_at
  BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.profiles_private (user_id, phone_e164, phone_hash, phone_verified_at)
SELECT user_id, phone_e164, phone_hash, phone_verified_at
FROM public.profiles
WHERE phone_e164 IS NOT NULL OR phone_hash IS NOT NULL OR phone_verified_at IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_e164_format;
DROP INDEX IF EXISTS public.profiles_phone_hash_idx;
ALTER TABLE public.profiles DROP COLUMN phone_e164;
ALTER TABLE public.profiles DROP COLUMN phone_hash;
ALTER TABLE public.profiles DROP COLUMN phone_verified_at;

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_private_owner_all
  ON public.profiles_private
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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
  v_phone_e164      text := NULLIF(payload->>'phone_e164', '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires authenticated user';
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, username, avatar_url, birth_date, sex,
    activity_level, goal, timezone, day_start_hour, locale, lgpd_consent_at
  )
  VALUES (
    uid,
    payload->>'full_name',
    NULLIF(payload->>'username', '')::citext,
    NULLIF(payload->>'avatar_url', ''),
    v_birth_date,
    v_sex,
    v_activity_level,
    v_goal,
    payload->>'timezone',
    COALESCE((payload->>'day_start_hour')::smallint, 0),
    COALESCE(payload->>'locale', 'pt-BR'),
    now()
  );

  IF v_phone_e164 IS NOT NULL THEN
    INSERT INTO public.profiles_private (user_id, phone_e164)
    VALUES (uid, v_phone_e164);
  END IF;

  INSERT INTO public.anthropometrics (user_id, weight_kg, height_cm)
  VALUES (uid, v_weight_kg, v_height_cm)
  RETURNING id, tdee_kcal INTO v_anthro_id, v_tdee;

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

  v_effective_from := public.fitbrother_nutritional_day(uid, now());

  INSERT INTO public.nutrition_goals (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g
  )
  VALUES (uid, v_effective_from, v_kcal, v_protein_g, v_carbs_g, v_fat_g)
  RETURNING id INTO v_goal_id;

  INSERT INTO public.subscriptions (user_id) VALUES (uid);

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
