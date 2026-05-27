-- M5.3 — Liga friends_total às follows e reavalia conquistas ao seguir.
-- Substitui o hardcoded 0::bigint da 0028 por count(*) de follows do usuário.
-- A conquista 'first_friend' (friends_total>=1) passa a desbloquear no 1º follow.
CREATE OR REPLACE FUNCTION public.fitbrother_evaluate_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  WITH metrics AS (
    SELECT
      COALESCE((SELECT s.current_streak FROM public.streaks s
                WHERE s.user_id = p_user_id), 0) AS streak,
      (SELECT count(*) FROM public.meals m
        WHERE m.user_id = p_user_id
          AND m.deleted_at IS NULL
          AND m.review_required = false) AS meals_total,
      (SELECT count(*) FROM public.meals m
        WHERE m.user_id = p_user_id
          AND m.deleted_at IS NULL
          AND m.review_required = false
          AND m.source IN ('wa_text', 'wa_audio')) AS wa_meals_total,
      (SELECT count(*) FROM public.daily_summaries ds
        WHERE ds.user_id = p_user_id
          AND ds.goal_hit
          AND ds.day > public.fitbrother_today(p_user_id) - 7) AS weekly_hits,
      (SELECT count(*) FROM public.daily_summaries ds
        WHERE ds.user_id = p_user_id
          AND ds.meals_count > 0) AS days_active,
      (SELECT count(*) FROM public.follows f
        WHERE f.follower_id = p_user_id) AS friends_total
  ),
  unlocked AS (
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT p_user_id, a.id
    FROM public.achievements a, metrics m
    WHERE
      CASE a.criteria_json->>'type'
        WHEN 'streak'         THEN m.streak         >= (a.criteria_json->>'value')::int
        WHEN 'meals_total'    THEN m.meals_total    >= (a.criteria_json->>'value')::int
        WHEN 'wa_meals_total' THEN m.wa_meals_total >= (a.criteria_json->>'value')::int
        WHEN 'weekly_hits'    THEN m.weekly_hits    >= (a.criteria_json->>'value')::int
        WHEN 'days_active'    THEN m.days_active     >= (a.criteria_json->>'value')::int
        WHEN 'friends_total'  THEN m.friends_total  >= (a.criteria_json->>'value')::int
        ELSE false
      END
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id
  )
  INSERT INTO public.notifications (user_id, channel, kind, template, payload)
  SELECT
    p_user_id, 'push', 'achievement', 'achievement_unlocked',
    jsonb_build_object('code', a.code, 'title', a.title, 'icon', a.icon)
  FROM unlocked u
  JOIN public.achievements a ON a.id = u.achievement_id;
END;
$$;

-- Reavalia o follower ao criar um follow (desbloqueia 'first_friend').
CREATE OR REPLACE FUNCTION public.fitbrother_follows_achievements_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fitbrother_evaluate_achievements(NEW.follower_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_eval_achievements_follows
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_follows_achievements_trigger();
