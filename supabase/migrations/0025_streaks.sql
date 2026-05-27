-- M5.1 — Streaks (ofensiva diária estilo Duolingo).
--
-- O streak conta dias nutricionais CONSECUTIVOS com goal_hit=true terminando
-- no último dia que fechou. "Dia" respeita o boundary timezone+day_start_hour
-- via fitbrother_nutritional_day (0014) — nunca current_date.
--
-- Por que derivar em vez de incrementar
-- ─────────────────────────────────────
-- A abordagem ingênua ("se goal_hit, current_streak++") é frágil: o cron pode
-- rodar 2x na mesma hora, ou um dia passado pode ganhar/perder goal_hit depois
-- (edição inline / backfill do M3 recomputa daily_summaries → trigger M5.2).
-- Recontar o run consecutivo a partir de daily_summaries é a fonte de verdade:
-- idempotente, e auto-corrige se o histórico mudar. Streaks são curtos (dias),
-- então o walk recursivo custa pouco.

-- ── streaks ────────────────────────────────────────────────────────────────
CREATE TABLE public.streaks (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak    int NOT NULL DEFAULT 0,
  longest_streak    int NOT NULL DEFAULT 0,
  last_hit_day      date,                       -- último dia com goal_hit=true
  freezes_available int NOT NULL DEFAULT 0,      -- "streak freeze" — v2
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY streaks_owner_read
  ON public.streaks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sem policy de INSERT/UPDATE/DELETE: escrita só via SECURITY DEFINER abaixo
-- ou service_role. Mesmo padrão de daily_summaries (0014).

-- ── Apply: recalcula o streak de UM usuário para o dia que fechou ────────────
-- p_day = o dia nutricional já encerrado a ser avaliado.
-- Idempotente: pode rodar N vezes pro mesmo (user, day) sem efeito colateral.
CREATE OR REPLACE FUNCTION public.fitbrother_apply_streak(
  p_user_id uuid,
  p_day     date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key    bigint;
  v_current     int := 0;
  v_last_hit    date;
BEGIN
  IF p_user_id IS NULL OR p_day IS NULL THEN
    RETURN;
  END IF;

  -- Serializa contra recompute concorrente do mesmo usuário (mesmo esquema
  -- de chave do recompute de daily_summaries em 0014, namespace distinto).
  v_lock_key := hashtextextended('streak|' || p_user_id::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Run consecutivo de goal_hit terminando em p_day. Um dia sem row em
  -- daily_summaries (sem refeições) quebra o run: não há linha em d-1, a
  -- recursão para. current_streak = 0 se p_day não bateu a meta.
  WITH RECURSIVE walk AS (
    SELECT ds.day
    FROM public.daily_summaries ds
    WHERE ds.user_id = p_user_id AND ds.day = p_day AND ds.goal_hit
    UNION ALL
    SELECT ds.day
    FROM walk w
    JOIN public.daily_summaries ds
      ON ds.user_id = p_user_id
     AND ds.day = w.day - 1
     AND ds.goal_hit
  )
  SELECT count(*) INTO v_current FROM walk;

  -- Dia mais recente (<= p_day) com goal_hit, pra alimentar alertas do M5.3.
  SELECT max(ds.day) INTO v_last_hit
  FROM public.daily_summaries ds
  WHERE ds.user_id = p_user_id AND ds.day <= p_day AND ds.goal_hit;

  INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_hit_day, updated_at)
  VALUES (p_user_id, v_current, v_current, v_last_hit, now())
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = GREATEST(public.streaks.longest_streak, EXCLUDED.current_streak),
    last_hit_day   = EXCLUDED.last_hit_day,
    updated_at     = now();
END;
$$;

-- ── Tick: cron horário. Avalia usuários cujo novo dia começou nesta hora ─────
-- O job (pg-boss) chama isto de hora em hora. Para cada usuário cujo
-- day_start_hour bate com a hora atual no seu timezone, avalia o dia que
-- acabou de fechar (fitbrother_today - 1).
CREATE OR REPLACE FUNCTION public.fitbrother_streak_tick()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   record;
  v_count  int := 0;
BEGIN
  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE EXTRACT(HOUR FROM now() AT TIME ZONE p.timezone)::int = p.day_start_hour
  LOOP
    PERFORM public.fitbrother_apply_streak(
      v_user.user_id,
      public.fitbrother_today(v_user.user_id) - 1
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;  -- nº de usuários avaliados nesta passada (observabilidade)
END;
$$;
