-- M7.1 — Canonical public identity projection. Never expose phone data here.
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
  SELECT user_id, username, full_name AS display_name, avatar_url
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.fitbrother_weekly_leaderboard(p_user_id uuid)
RETURNS TABLE (
  user_id       uuid,
  full_name     text,
  weekly_hits   int,
  window_streak int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  v_today := public.fitbrother_today(p_user_id);

  RETURN QUERY
  WITH network AS (
    SELECT p_user_id AS uid
    UNION
    SELECT f.followee_id FROM public.follows f WHERE f.follower_id = p_user_id
  ),
  hits AS (
    SELECT n.uid,
           count(*) FILTER (
             WHERE ds.goal_hit AND ds.day BETWEEN v_today - 7 AND v_today - 1
           )::int AS weekly_hits
    FROM network n
    LEFT JOIN public.daily_summaries ds ON ds.user_id = n.uid
    GROUP BY n.uid
  ),
  runs AS (
    SELECT n.uid,
           COALESCE((
             SELECT min(gs.offset_d)::int
             FROM generate_series(0, 6) AS gs(offset_d)
             WHERE NOT EXISTS (
               SELECT 1 FROM public.daily_summaries ds2
               WHERE ds2.user_id = n.uid
                 AND ds2.day = v_today - 1 - gs.offset_d
                 AND ds2.goal_hit
             )
           ), 7) AS window_streak
    FROM network n
  )
  SELECT n.uid,
         pp.display_name AS full_name,
         h.weekly_hits,
         r.window_streak
  FROM network n
  JOIN hits h ON h.uid = n.uid
  JOIN runs r ON r.uid = n.uid
  LEFT JOIN public.public_profiles pp ON pp.user_id = n.uid
  ORDER BY h.weekly_hits DESC, r.window_streak DESC;
END;
$$;
