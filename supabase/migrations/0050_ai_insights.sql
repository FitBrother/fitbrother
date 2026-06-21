-- M8.2 — Insights de período. Tabela + função que seleciona, por usuário e
-- calendário nutricional, o período recém-fechado elegível e devolve o payload
-- agregado (daily_summaries do período + streak). NÃO chama IA — isso é no worker.
CREATE TYPE insight_period AS ENUM ('day','week','month');

CREATE TABLE public.ai_insights (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type  insight_period NOT NULL,
  period_start date NOT NULL,
  payload      jsonb NOT NULL,
  source_hash  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_insights_unique UNIQUE (user_id, period_type, period_start)
);

CREATE INDEX ai_insights_user_created_idx ON public.ai_insights (user_id, created_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_insights_owner_read
  ON public.ai_insights FOR SELECT
  USING (auth.uid() = user_id);
-- Escrita só via service-role (worker); sem policy de INSERT/UPDATE p/ authenticated.

-- ── Targets ────────────────────────────────────────────────────────────────
-- Retorna (user_id, period_start, payload) para os usuários cujo período
-- recém-fechado é elegível. Idempotência fica a cargo do worker (source_hash).
--   day   : sempre, para ontem (period_start = today-1), se ontem teve refeição.
--   week  : só quando ISODOW(today)=1; janela [today-7, today-1];
--           elegível se >=3 dias com refeição.
--   month : só quando DAY(today)=1; mês anterior; elegível se >=3 dias com refeição.
CREATE OR REPLACE FUNCTION public.fitbrother_insight_targets(p_period text)
RETURNS TABLE (user_id uuid, period_start date, payload jsonb)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH u AS (
    SELECT p.user_id AS uid, public.fitbrother_today(p.user_id) AS today
    FROM public.profiles p
  ),
  win AS (
    SELECT uid, today,
      CASE p_period
        WHEN 'day'   THEN today - 1
        WHEN 'week'  THEN today - 7
        WHEN 'month' THEN (date_trunc('month', (today - 1))::date)
      END AS w_from,
      today - 1 AS w_to
    FROM u
    WHERE CASE p_period
      WHEN 'day'   THEN true
      WHEN 'week'  THEN EXTRACT(ISODOW FROM today) = 1
      WHEN 'month' THEN EXTRACT(DAY FROM today) = 1
      ELSE false
    END
  ),
  agg AS (
    SELECT w.uid, w.w_from AS p_start,
      count(*) FILTER (WHERE ds.meals_count > 0) AS days_with_meals,
      jsonb_agg(jsonb_build_object(
        'day', ds.day, 'kcal', ds.kcal, 'protein_g', ds.protein_g,
        'carbs_g', ds.carbs_g, 'fat_g', ds.fat_g, 'goal_hit', ds.goal_hit,
        'goal_kcal', ds.goal_kcal, 'meals_count', ds.meals_count
      ) ORDER BY ds.day) AS days
    FROM win w
    JOIN public.daily_summaries ds
      ON ds.user_id = w.uid AND ds.day BETWEEN w.w_from AND w.w_to
    GROUP BY w.uid, w.w_from
  )
  SELECT a.uid, a.p_start,
         jsonb_build_object(
           'period', p_period,
           'period_start', a.p_start,
           'days', a.days,
           'streak', COALESCE((SELECT s.current_streak FROM public.streaks s WHERE s.user_id = a.uid), 0)
         )
  FROM agg a
  WHERE (p_period = 'day' AND a.days_with_meals >= 1)
     OR (p_period IN ('week','month') AND a.days_with_meals >= 3);
END;
$$;
