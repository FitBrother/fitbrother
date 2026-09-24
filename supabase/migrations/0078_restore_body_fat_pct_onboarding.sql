-- Restaura o INSERT de anthropometrics.body_fat_pct em complete_onboarding_impl.
--
-- Regressão introduzida pela 0074: seu comentário diz "derivado de 0066 por
-- substituição do bloco 5" (só o bloco de consentimento) — mas 0066 é ANTERIOR
-- à 0068 (que adicionou body_fat_pct ao INSERT). A 0074 acabou copiando a base
-- errada e silenciosamente voltou a não gravar body_fat_pct, apesar de
-- `OnboardingPayloadSchema.body_fat_pct` continuar obrigatório no payload e a
-- UI continuar coletando o dado normalmente — ele só nunca chegava no banco.
--
-- Toda conta criada entre a 0074 e esta migration tem
-- `anthropometrics.body_fat_pct IS NULL` sem forma de recuperar o valor
-- original (não existe em nenhuma outra tabela) — `buildTargetsInputFromAccountState`
-- (M20) já cobre esse caso com um fallback neutro de 20%, mas o valor real do
-- usuário fica perdido até ele reinformar em algum fluxo futuro de edição.
CREATE OR REPLACE FUNCTION public.complete_onboarding_impl(payload jsonb)
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
  v_phone_e164      text := NULLIF(payload->>'phone_e164', '');
  v_targets         jsonb := payload->'targets';
  v_soft_mode       boolean := COALESCE((payload->>'soft_mode')::boolean, false);
  v_anthro_id       uuid;
  v_goal_id         uuid;
  v_effective_from  date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires authenticated user';
  END IF;

  IF v_targets IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires payload.targets (computed by computeTargets)';
  END IF;

  -- 1. profiles ------------------------------------------------------------
  INSERT INTO public.profiles (
    user_id, full_name, username, avatar_url, birth_date, sex,
    activity_level, goal, timezone, day_start_hour, locale, lgpd_consent_at,
    onboarding_context, soft_mode
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
    now(),
    COALESCE(payload->'onboarding_context', '{}'::jsonb),
    v_soft_mode
  );

  IF v_phone_e164 IS NOT NULL THEN
    INSERT INTO public.profiles_private (user_id, phone_e164)
    VALUES (uid, v_phone_e164);
  END IF;

  -- 2. anthropometrics (bmr/tdee chegam prontos de computeTargets; flags de
  --    saúde, peso-alvo/ritmo, % de gordura e frequência de treino vêm do
  --    payload — M15/M16/M18/M19) --------------------------------------------
  INSERT INTO public.anthropometrics (
    user_id, weight_kg, height_cm, bmr_kcal, tdee_kcal,
    target_weight_kg, rate_kg_per_week, body_fat_pct,
    strength_training, is_pregnant_or_lactating, has_kidney_disease,
    has_type1_diabetes, uses_glp1, tca_screening_positive,
    training_days_per_week
  )
  VALUES (
    uid,
    v_weight_kg,
    v_height_cm,
    (v_targets->>'bmr_kcal')::numeric,
    (v_targets->>'tdee_kcal')::numeric,
    NULLIF(payload->>'target_weight_kg', '')::numeric,
    NULLIF(payload->>'rate_kg_per_week', '')::numeric,
    (payload->>'body_fat_pct')::numeric,
    (payload->>'strength_training')::boolean,
    (payload->>'is_pregnant_or_lactating')::boolean,
    (payload->>'has_kidney_disease')::boolean,
    (payload->>'has_type1_diabetes')::boolean,
    (payload->>'uses_glp1')::boolean,
    (payload->>'tca_screening_positive')::boolean,
    NULLIF(payload->>'training_days_per_week', '')::smallint
  )
  RETURNING id INTO v_anthro_id;

  -- 3. nutrition_goals (kcal/macros já computados; effective_from pelo dia
  --    nutricional do usuário, não CURRENT_DATE do servidor — 0024) --------
  v_effective_from := public.fitbrother_nutritional_day(uid, now());

  INSERT INTO public.nutrition_goals (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g, fiber_g,
    tdee_source, warnings, blocked
  )
  VALUES (
    uid,
    v_effective_from,
    (v_targets->>'kcal')::numeric,
    (v_targets->>'protein_g')::numeric,
    (v_targets->>'carbs_g')::numeric,
    (v_targets->>'fat_g')::numeric,
    (v_targets->>'fiber_g')::numeric,
    COALESCE(v_targets->>'tdee_source', 'declared'),
    COALESCE(v_targets->'warnings', '[]'::jsonb),
    COALESCE((v_targets->>'blocked')::boolean, false)
  )
  RETURNING id INTO v_goal_id;

  -- 4. subscriptions (defaults: free / active) ------------------------------
  INSERT INTO public.subscriptions (user_id) VALUES (uid);

  -- 5. consent_log (terms / privacy / ai_processing / health_data) ----------
  INSERT INTO public.consent_log (user_id, scope, policy_version)
  VALUES
    (uid, 'terms',         v_policy_version),
    (uid, 'privacy',       v_policy_version),
    (uid, 'ai_processing', v_policy_version),
    (uid, 'health_data',   v_policy_version);

  -- 6. onboarding_progress não tem mais o que retomar: a conta existe -------
  DELETE FROM public.onboarding_progress WHERE user_id = uid;

  RETURN jsonb_build_object(
    'user_id',           uid,
    'anthropometric_id', v_anthro_id,
    'nutrition_goal_id', v_goal_id,
    'tdee_kcal',         v_targets->>'tdee_kcal',
    'kcal',              v_targets->>'kcal',
    'protein_g',         v_targets->>'protein_g',
    'carbs_g',           v_targets->>'carbs_g',
    'fat_g',             v_targets->>'fat_g',
    'fiber_g',           v_targets->>'fiber_g',
    'warnings',          v_targets->'warnings',
    'blocked',           v_targets->>'blocked',
    'block_reason',      v_targets->>'block_reason',
    'soft_mode',         v_soft_mode
  );
END;
$$;
