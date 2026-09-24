-- M20. Edição manual de calorias/macros e peso/altura na área de Perfil
-- ("Metas e macros" + "Meu corpo"). nutrition_goals e anthropometrics
-- continuam append-only (CLAUDE.md regra de ouro #10): estas RPCs nunca
-- fazem UPDATE nos valores históricos — só fecham a linha vigente
-- (nutrition_goals.effective_to) ou inserem uma linha nova (anthropometrics,
-- que já bloqueia UPDATE/DELETE via trigger em 0004_anthropometrics.sql).

-- ── fitbrother_set_nutrition_goals ──────────────────────────────────────────
-- Fecha a meta vigente e abre outra a partir do dia nutricional atual do
-- usuário (fitbrother_nutritional_day, 0014). Duas edições no MESMO dia
-- nutricional corrigem a linha do dia em vez de fragmentar o histórico com
-- duas versões cobrindo a mesma data.
CREATE OR REPLACE FUNCTION public.fitbrother_set_nutrition_goals(
  p_kcal      numeric,
  p_protein_g numeric,
  p_carbs_g   numeric,
  p_fat_g     numeric,
  p_fiber_g   numeric DEFAULT NULL,
  p_source    text    DEFAULT 'manual'
)
RETURNS public.nutrition_goals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_today  date;
  v_active public.nutrition_goals;
  v_new    public.nutrition_goals;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fitbrother_set_nutrition_goals requires authenticated user';
  END IF;

  v_today := public.fitbrother_nutritional_day(v_uid, now());

  SELECT * INTO v_active
    FROM public.nutrition_goals
   WHERE user_id = v_uid AND effective_to IS NULL;

  IF v_active.id IS NOT NULL AND v_active.effective_from = v_today THEN
    UPDATE public.nutrition_goals
       SET kcal = p_kcal, protein_g = p_protein_g, carbs_g = p_carbs_g,
           fat_g = p_fat_g, fiber_g = p_fiber_g, tdee_source = p_source,
           warnings = '[]'::jsonb, blocked = false
     WHERE id = v_active.id
     RETURNING * INTO v_new;
  ELSE
    IF v_active.id IS NOT NULL THEN
      UPDATE public.nutrition_goals
         SET effective_to = v_today - 1
       WHERE id = v_active.id;
    END IF;

    INSERT INTO public.nutrition_goals (
      user_id, effective_from, kcal, protein_g, carbs_g, fat_g, fiber_g,
      tdee_source, warnings, blocked
    )
    VALUES (
      v_uid, v_today, p_kcal, p_protein_g, p_carbs_g, p_fat_g, p_fiber_g,
      p_source, '[]'::jsonb, false
    )
    RETURNING * INTO v_new;
  END IF;

  -- Sem isso, o anel de calorias do dashboard só refletiria a meta nova no
  -- próximo INSERT/UPDATE de meal_items (gatilho que normalmente recomputa
  -- daily_summaries) — o usuário salvaria a meta e veria o número velho.
  PERFORM public.fitbrother_recompute_daily_summary(v_uid, v_today);

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.fitbrother_set_nutrition_goals(numeric, numeric, numeric, numeric, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fitbrother_set_nutrition_goals(numeric, numeric, numeric, numeric, numeric, text)
  TO authenticated;

-- ── fitbrother_set_anthropometrics ──────────────────────────────────────────
-- Peso/altura só fazem INSERT (append-only por trigger, 0004). Os demais
-- campos "insumo do cálculo" da linha (peso-alvo, ritmo, % de gordura, flags
-- de saúde, frequência de treino) não fazem parte deste formulário — herdam
-- da última linha pra não perder o que o usuário já informou no onboarding.
--
-- bmr_kcal/tdee_kcal chegam PRONTOS do servidor (p_bmr_kcal/p_tdee_kcal): a
-- 0056 removeu o trigger que calculava isso em SQL porque o motor de cálculo
-- migrou pra TS puro (packages/shared/src/targets) — o único inserter previsto
-- na época era `complete_onboarding`, que já manda os valores computados por
-- `computeTargets`. Esta RPC é o segundo inserter e precisa do mesmo contrato.
CREATE OR REPLACE FUNCTION public.fitbrother_set_anthropometrics(
  p_weight_kg numeric,
  p_height_cm numeric,
  p_bmr_kcal  numeric,
  p_tdee_kcal numeric
)
RETURNS public.anthropometrics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_prev public.anthropometrics;
  v_new  public.anthropometrics;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fitbrother_set_anthropometrics requires authenticated user';
  END IF;

  SELECT * INTO v_prev
    FROM public.anthropometrics
   WHERE user_id = v_uid
   ORDER BY measured_at DESC
   LIMIT 1;

  INSERT INTO public.anthropometrics (
    user_id, weight_kg, height_cm, bmr_kcal, tdee_kcal,
    target_weight_kg, rate_kg_per_week, body_fat_pct,
    strength_training, is_pregnant_or_lactating, has_kidney_disease,
    has_type1_diabetes, uses_glp1, tca_screening_positive,
    training_days_per_week
  )
  VALUES (
    v_uid, p_weight_kg, p_height_cm, p_bmr_kcal, p_tdee_kcal,
    v_prev.target_weight_kg, v_prev.rate_kg_per_week, v_prev.body_fat_pct,
    v_prev.strength_training, v_prev.is_pregnant_or_lactating, v_prev.has_kidney_disease,
    v_prev.has_type1_diabetes, v_prev.uses_glp1, v_prev.tca_screening_positive,
    v_prev.training_days_per_week
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.fitbrother_set_anthropometrics(numeric, numeric, numeric, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fitbrother_set_anthropometrics(numeric, numeric, numeric, numeric)
  TO authenticated;
