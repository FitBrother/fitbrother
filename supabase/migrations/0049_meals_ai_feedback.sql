-- M8.1 — Feedback imediato da refeição (piggyback na extração). Coluna nova +
-- a RPC create_meal_with_items passa a persistir payload->>'ai_feedback'.
ALTER TABLE public.meals ADD COLUMN ai_feedback text;

CREATE OR REPLACE FUNCTION public.create_meal_with_items(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  uid              uuid := auth.uid();
  v_meal_id        uuid := (payload->>'id')::uuid;
  v_source         meal_source := (payload->>'source')::meal_source;
  v_raw_input      text := payload->>'raw_input';
  v_audio_path     text := NULLIF(payload->>'audio_path', '');
  v_meal_type      meal_type := COALESCE((payload->>'meal_type')::meal_type, 'other');
  v_consumed_at    timestamptz := COALESCE((payload->>'consumed_at')::timestamptz, now());
  v_confidence     numeric := NULLIF(payload->>'confidence', '')::numeric;
  v_review_required boolean := COALESCE(v_confidence < 0.6, false);
  v_ai_feedback    text := NULLIF(payload->>'ai_feedback', '');
  v_inserted_id    uuid;
  v_item           jsonb;
  v_day            date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'create_meal_with_items requires authenticated user';
  END IF;
  IF v_meal_id IS NULL THEN
    RAISE EXCEPTION 'create_meal_with_items requires payload.id (client UUID)';
  END IF;
  IF v_source IS NULL THEN
    RAISE EXCEPTION 'create_meal_with_items requires payload.source';
  END IF;

  INSERT INTO public.meals (
    id, user_id, source, raw_input, audio_path, meal_type,
    consumed_at, confidence, review_required, ai_feedback
  )
  VALUES (
    v_meal_id, uid, v_source, v_raw_input, v_audio_path, v_meal_type,
    v_consumed_at, v_confidence, v_review_required, v_ai_feedback
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('id', v_meal_id, 'already_existed', true);
  END IF;

  PERFORM set_config('fitbrother.bulk_insert', 'on', true);
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO public.meal_items (
      meal_id, food_id, description, quantity, unit,
      kcal, protein_g, carbs_g, fat_g, density_assumed
    )
    VALUES (
      v_meal_id,
      NULLIF(v_item->>'food_id', '')::uuid,
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit')::unit,
      (v_item->>'kcal')::numeric,
      (v_item->>'protein_g')::numeric,
      (v_item->>'carbs_g')::numeric,
      (v_item->>'fat_g')::numeric,
      COALESCE((v_item->>'density_assumed')::bool, false)
    );
  END LOOP;
  PERFORM set_config('fitbrother.bulk_insert', 'off', true);

  PERFORM public.fitbrother_recompute_meal_totals(v_meal_id);

  IF NOT v_review_required THEN
    v_day := public.fitbrother_nutritional_day(uid, v_consumed_at);
    PERFORM public.fitbrother_recompute_daily_summary(uid, v_day);
  END IF;

  RETURN jsonb_build_object(
    'id', v_meal_id,
    'already_existed', false,
    'review_required', v_review_required,
    'day', public.fitbrother_nutritional_day(uid, v_consumed_at)
  );
END;
$$;
