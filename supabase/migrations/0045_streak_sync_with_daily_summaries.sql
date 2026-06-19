-- M7.x fix — keep streaks consistent with daily_summaries edits/backfills.
--
-- Problem:
-- - Home reads streaks.current_streak (/me/streak).
-- - Weekly leaderboard reads daily_summaries.goal_hit window.
-- - streaks was only recomputed by hourly tick on day boundary, so edits/backfills
--   after that could desync Home vs Ranking until the next boundary.
--
-- Solution:
-- - Recompute streak from the last closed nutritional day whenever
--   daily_summaries changes on a closed/past day.
-- - Backfill all existing users once in this migration.

CREATE OR REPLACE FUNCTION public.fitbrother_sync_streak_on_daily_summary_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_changed_day date;
  v_last_closed_day date;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_changed_day := COALESCE(NEW.day, OLD.day);

  IF v_user_id IS NULL OR v_changed_day IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_last_closed_day := public.fitbrother_today(v_user_id) - 1;

  -- Changes to the open day do not affect current_streak yet.
  IF v_changed_day <= v_last_closed_day THEN
    PERFORM public.fitbrother_apply_streak(v_user_id, v_last_closed_day);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_daily_summaries_sync_streak ON public.daily_summaries;

CREATE TRIGGER trg_daily_summaries_sync_streak
AFTER INSERT OR UPDATE OR DELETE ON public.daily_summaries
FOR EACH ROW
EXECUTE FUNCTION public.fitbrother_sync_streak_on_daily_summary_change();

-- One-time repair so existing users are immediately consistent.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN SELECT p.user_id FROM public.profiles p
  LOOP
    PERFORM public.fitbrother_apply_streak(v_user_id, public.fitbrother_today(v_user_id) - 1);
  END LOOP;
END;
$$;
