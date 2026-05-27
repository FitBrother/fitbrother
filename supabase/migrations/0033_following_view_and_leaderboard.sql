-- M5.3 — View de privacidade + RPC do leaderboard.
--
-- following_summaries_view: expõe APENAS day/goal_hit/meals_count de quem o
-- caller segue. NUNCA macros (FEATURES §3.5). security_invoker → respeita o RLS
-- de follows do caller.
CREATE VIEW public.following_summaries_view
WITH (security_invoker = true) AS
  SELECT ds.user_id AS followee_id, ds.day, ds.goal_hit, ds.meals_count
  FROM public.follows f
  JOIN public.daily_summaries ds ON ds.user_id = f.followee_id
  WHERE f.follower_id = auth.uid();

GRANT SELECT ON public.following_summaries_view TO authenticated;

-- RPC do leaderboard semanal. SECURITY DEFINER (chamado pelo backend com
-- service-role passando p_user_id). Agrega p_user_id + quem ele segue.
--   weekly_hits   = nº de goal_hit nas últimas 7 noites nutricionais.
--   window_streak = run consecutivo de goal_hit terminando no último dia
--                   fechado, LIMITADO à janela de 7 dias. Derivado de
--                   daily_summaries — não lê a tabela streaks de terceiros,
--                   então não vaza o streak privado.
-- Retorna só agregados — nenhum macro.
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
  v_today := public.fitbrother_today(p_user_id);  -- dia nutricional atual

  RETURN QUERY
  WITH network AS (
    SELECT p_user_id AS uid
    UNION
    SELECT f.followee_id FROM public.follows f WHERE f.follower_id = p_user_id
  ),
  -- Janela = 7 noites fechadas: [today-7, today-1].
  hits AS (
    SELECT n.uid,
           count(*) FILTER (
             WHERE ds.goal_hit AND ds.day BETWEEN v_today - 7 AND v_today - 1
           )::int AS weekly_hits
    FROM network n
    LEFT JOIN public.daily_summaries ds ON ds.user_id = n.uid
    GROUP BY n.uid
  ),
  -- window_streak: dias consecutivos com goal_hit terminando em today-1,
  -- limitado a 7. Acha o 1º offset (0..6, onde 0 = today-1) que NÃO bateu —
  -- esse offset é exatamente o tamanho do run a partir do fim. Se todos os 7
  -- bateram, min() é NULL → COALESCE 7.
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
         pr.full_name,
         h.weekly_hits,
         r.window_streak
  FROM network n
  JOIN hits h    ON h.uid = n.uid
  JOIN runs r    ON r.uid = n.uid
  LEFT JOIN public.profiles pr ON pr.user_id = n.uid
  ORDER BY h.weekly_hits DESC, r.window_streak DESC;
END;
$$;
