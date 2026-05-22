-- M2 §database. Triggers that keep meals.total_* and daily_summaries in sync
-- with meal_items, plus soft-delete and review-state propagation.
--
-- Design notes
-- ─────────────
-- 1. STATEMENT-level triggers with transition tables instead of FOR EACH ROW.
--    A meal with N items hits the recompute logic *once*, not N times. The
--    RPC create_meal_with_items still benefits because the bulk INSERT is a
--    single statement; the GUC fitbrother.bulk_insert short-circuits the
--    trigger so the RPC can recompute exactly once at the end (avoiding
--    intermediate states where meals.total_* doesn't match the partial
--    meal_items set yet).
-- 2. Recompute fans out to two layers:
--      meals.total_*       — done here via fitbrother_recompute_meal_totals
--      daily_summaries     — delegated to fitbrother_recompute_daily_summary
--                            (defined in 0014; lazy symbol resolution).
-- 3. Soft delete cascades from meals to meal_items via a mirror trigger,
--    keeping the WHERE deleted_at IS NULL filter uniform across both tables.
-- 4. consumed_at moves between days recompute *both* affected days, which
--    is rare but matters for daily_summaries correctness.

-- ── Helper: meals.total_* from current meal_items ─────────────────────────
CREATE OR REPLACE FUNCTION public.fitbrother_recompute_meal_totals(p_meal_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.meals m SET
    total_kcal      = COALESCE((
      SELECT SUM(kcal)      FROM public.meal_items
       WHERE meal_id = p_meal_id AND deleted_at IS NULL), 0),
    total_protein_g = COALESCE((
      SELECT SUM(protein_g) FROM public.meal_items
       WHERE meal_id = p_meal_id AND deleted_at IS NULL), 0),
    total_carbs_g   = COALESCE((
      SELECT SUM(carbs_g)   FROM public.meal_items
       WHERE meal_id = p_meal_id AND deleted_at IS NULL), 0),
    total_fat_g     = COALESCE((
      SELECT SUM(fat_g)     FROM public.meal_items
       WHERE meal_id = p_meal_id AND deleted_at IS NULL), 0)
  WHERE m.id = p_meal_id;
END;
$$;

-- ── meal_items STATEMENT triggers ─────────────────────────────────────────
-- Single function, three triggers — each declares the REFERENCING clause
-- it can use (NEW for INSERT, OLD for DELETE, both for UPDATE) and the
-- function branches on TG_OP.
CREATE OR REPLACE FUNCTION public.fitbrother_meal_items_recompute()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_meal_id uuid;
  v_user_id uuid;
  v_consumed_at timestamptz;
BEGIN
  -- Bulk-insert RPC handles its own recompute at the end of the transaction.
  IF current_setting('fitbrother.bulk_insert', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- Collect distinct affected meal_ids from the relevant transition tables.
  IF TG_OP = 'INSERT' THEN
    FOR v_meal_id IN SELECT DISTINCT meal_id FROM new_items LOOP
      PERFORM public.fitbrother_recompute_meal_totals(v_meal_id);
      SELECT user_id, consumed_at INTO v_user_id, v_consumed_at
        FROM public.meals WHERE id = v_meal_id;
      IF v_user_id IS NOT NULL THEN
        PERFORM public.fitbrother_recompute_daily_summary(
          v_user_id,
          public.fitbrother_nutritional_day(v_user_id, v_consumed_at));
      END IF;
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    FOR v_meal_id IN
      SELECT DISTINCT meal_id FROM new_items
      UNION
      SELECT DISTINCT meal_id FROM old_items
    LOOP
      PERFORM public.fitbrother_recompute_meal_totals(v_meal_id);
      SELECT user_id, consumed_at INTO v_user_id, v_consumed_at
        FROM public.meals WHERE id = v_meal_id;
      IF v_user_id IS NOT NULL THEN
        PERFORM public.fitbrother_recompute_daily_summary(
          v_user_id,
          public.fitbrother_nutritional_day(v_user_id, v_consumed_at));
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOR v_meal_id IN SELECT DISTINCT meal_id FROM old_items LOOP
      PERFORM public.fitbrother_recompute_meal_totals(v_meal_id);
      SELECT user_id, consumed_at INTO v_user_id, v_consumed_at
        FROM public.meals WHERE id = v_meal_id;
      IF v_user_id IS NOT NULL THEN
        PERFORM public.fitbrother_recompute_daily_summary(
          v_user_id,
          public.fitbrother_nutritional_day(v_user_id, v_consumed_at));
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER meal_items_after_insert
  AFTER INSERT ON public.meal_items
  REFERENCING NEW TABLE AS new_items
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.fitbrother_meal_items_recompute();

CREATE TRIGGER meal_items_after_update
  AFTER UPDATE ON public.meal_items
  REFERENCING NEW TABLE AS new_items OLD TABLE AS old_items
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.fitbrother_meal_items_recompute();

CREATE TRIGGER meal_items_after_delete
  AFTER DELETE ON public.meal_items
  REFERENCING OLD TABLE AS old_items
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.fitbrother_meal_items_recompute();

-- ── meals lifecycle triggers ──────────────────────────────────────────────
-- Soft-delete propagation, review confirmation, and consumed_at moves.
CREATE OR REPLACE FUNCTION public.fitbrother_meals_after_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_day date;
  v_new_day date;
BEGIN
  -- 1. Soft delete cascade: meals.deleted_at toggled → mirror to meal_items.
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    UPDATE public.meal_items
       SET deleted_at = NEW.deleted_at
     WHERE meal_id = NEW.id
       AND deleted_at IS DISTINCT FROM NEW.deleted_at;
    -- The meal_items UPDATE will fire its own trigger and recompute the
    -- daily summary for the meal's day.  If meal_items were empty (rare
    -- but possible), force recompute here.
    IF NOT EXISTS (SELECT 1 FROM public.meal_items WHERE meal_id = NEW.id) THEN
      v_new_day := public.fitbrother_nutritional_day(NEW.user_id, NEW.consumed_at);
      PERFORM public.fitbrother_recompute_daily_summary(NEW.user_id, v_new_day);
    END IF;
    RETURN NULL;
  END IF;

  -- 2. Review confirmation: review_required false → meal becomes countable.
  IF OLD.review_required IS DISTINCT FROM NEW.review_required THEN
    v_new_day := public.fitbrother_nutritional_day(NEW.user_id, NEW.consumed_at);
    PERFORM public.fitbrother_recompute_daily_summary(NEW.user_id, v_new_day);
  END IF;

  -- 3. consumed_at moves between days → recompute both.
  IF OLD.consumed_at IS DISTINCT FROM NEW.consumed_at THEN
    v_old_day := public.fitbrother_nutritional_day(NEW.user_id, OLD.consumed_at);
    v_new_day := public.fitbrother_nutritional_day(NEW.user_id, NEW.consumed_at);
    IF v_old_day IS DISTINCT FROM v_new_day THEN
      PERFORM public.fitbrother_recompute_daily_summary(NEW.user_id, v_old_day);
      PERFORM public.fitbrother_recompute_daily_summary(NEW.user_id, v_new_day);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER meals_after_update
  AFTER UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_meals_after_update();
