-- M1 §database. Anthropometrics history — append-only.
-- Each INSERT snapshots BMR/TDEE using the profile's current sex/activity_level.

CREATE TABLE public.anthropometrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg   numeric(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  height_cm   numeric(5,2) NOT NULL CHECK (height_cm > 0 AND height_cm < 300),
  bmr_kcal    numeric(7,2),
  tdee_kcal   numeric(7,2),
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX anthropometrics_user_measured_at_idx
  ON public.anthropometrics (user_id, measured_at DESC);

-- ── BMR / TDEE trigger ────────────────────────────────────────────────────
-- Mifflin-St Jeor BMR:
--   male:   10*kg + 6.25*cm - 5*age + 5
--   female: 10*kg + 6.25*cm - 5*age - 161
--   other:  uses the midpoint constant (-78) as a neutral default.
-- TDEE  = BMR * activity_factor (snapshot of profiles.activity_level).
--   sedentary 1.2 / light 1.375 / moderate 1.55 / active 1.725 / very_active 1.9
CREATE OR REPLACE FUNCTION public.calculate_bmr_tdee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  p_birth_date     date;
  p_sex            sex;
  p_activity_level activity_level;
  age_years        int;
  sex_constant     numeric;
  activity_factor  numeric;
BEGIN
  SELECT birth_date, sex, activity_level
    INTO p_birth_date, p_sex, p_activity_level
    FROM public.profiles
   WHERE user_id = NEW.user_id;

  IF p_birth_date IS NULL OR p_sex IS NULL OR p_activity_level IS NULL THEN
    RAISE EXCEPTION
      'anthropometrics requires profiles.birth_date / sex / activity_level for user %',
      NEW.user_id;
  END IF;

  age_years := EXTRACT(YEAR FROM age(p_birth_date))::int;

  sex_constant := CASE p_sex
    WHEN 'male'   THEN  5
    WHEN 'female' THEN -161
    ELSE              -78
  END;

  activity_factor := CASE p_activity_level
    WHEN 'sedentary'   THEN 1.2
    WHEN 'light'       THEN 1.375
    WHEN 'moderate'    THEN 1.55
    WHEN 'active'      THEN 1.725
    WHEN 'very_active' THEN 1.9
  END;

  NEW.bmr_kcal  := ROUND(
    10 * NEW.weight_kg + 6.25 * NEW.height_cm - 5 * age_years + sex_constant,
    2
  );
  NEW.tdee_kcal := ROUND(NEW.bmr_kcal * activity_factor, 2);

  RETURN NEW;
END;
$$;

CREATE TRIGGER anthropometrics_calculate_bmr_tdee
  BEFORE INSERT ON public.anthropometrics
  FOR EACH ROW EXECUTE FUNCTION public.calculate_bmr_tdee();

-- ── append-only guard ─────────────────────────────────────────────────────
-- UPDATE / DELETE on history rows would break audit trail (CLAUDE.md rule #10).
CREATE OR REPLACE FUNCTION public.anthropometrics_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'anthropometrics is append-only; insert a new row instead';
END;
$$;

CREATE TRIGGER anthropometrics_no_update
  BEFORE UPDATE ON public.anthropometrics
  FOR EACH ROW EXECUTE FUNCTION public.anthropometrics_block_mutation();

CREATE TRIGGER anthropometrics_no_delete
  BEFORE DELETE ON public.anthropometrics
  FOR EACH ROW EXECUTE FUNCTION public.anthropometrics_block_mutation();

-- ── RLS (owner_all) ───────────────────────────────────────────────────────
ALTER TABLE public.anthropometrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY anthropometrics_owner_all
  ON public.anthropometrics
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
