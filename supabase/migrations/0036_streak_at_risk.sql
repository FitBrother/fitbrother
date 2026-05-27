-- M5.3 — at_risk do StreakCounter (§12.4). True quando: streak vivo (>0),
-- hoje ainda sem goal_hit, e estamos dentro de 4h do próximo boundary
-- (timezone + day_start_hour do usuário).
CREATE OR REPLACE FUNCTION public.fitbrother_streak_at_risk(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz        text;
  v_dsh       int;
  v_streak    int;
  v_today     date;
  v_hit       boolean;
  v_now_local timestamp;
  v_boundary  timestamp;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  SELECT timezone, day_start_hour INTO v_tz, v_dsh
  FROM public.profiles WHERE user_id = p_user_id;
  IF v_tz IS NULL THEN RETURN false; END IF;

  SELECT current_streak INTO v_streak FROM public.streaks WHERE user_id = p_user_id;
  IF COALESCE(v_streak, 0) = 0 THEN RETURN false; END IF;

  v_today := public.fitbrother_today(p_user_id);
  SELECT ds.goal_hit INTO v_hit FROM public.daily_summaries ds
  WHERE ds.user_id = p_user_id AND ds.day = v_today;
  IF COALESCE(v_hit, false) THEN RETURN false; END IF;  -- já bateu hoje

  v_now_local := now() AT TIME ZONE v_tz;  -- hora de parede local como timestamp
  v_boundary  := date_trunc('day', v_now_local) + make_interval(hours => v_dsh);
  IF v_now_local >= v_boundary THEN
    v_boundary := v_boundary + interval '1 day';
  END IF;

  RETURN (v_boundary - v_now_local) <= interval '4 hours';
END;
$$;
