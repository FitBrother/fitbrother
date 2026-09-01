-- M5.4 — streak passa a contar "registrou pelo menos 1 refeição no dia" em
-- vez de goal_hit (bater kcal 90-110% + proteína >=85%).
--
-- Por quê: goal_hit é uma régua correta pra saber se o dia nutricional foi
-- bem-sucedido (e continua sendo usado assim no ranking semanal, achievements
-- e insights — nenhum desses muda aqui), mas é dura demais pra ser a barra do
-- streak: um dia registrado direitinho, só um pouco acima da meta, quebrava a
-- ofensiva inteira. O streak (o "flame", estilo Duolingo) devia recompensar o
-- HÁBITO de registrar, não a precisão da meta — goal_hit continua visível à
-- parte (o ícone de chama por dia em HistoryDayCard já lê goal_hit direto de
-- daily_summaries, sem passar pela tabela streaks).
--
-- Bônus: como "registrou uma refeição hoje" é sabido no instante em que a
-- refeição é salva (diferente de goal_hit, que só fecha no fim do dia), o
-- trigger de sync deixa de ignorar o dia aberto — o streak agora atualiza na
-- hora, não só no dia seguinte via tick horário.

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

  v_lock_key := hashtextextended('streak|' || p_user_id::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Run consecutivo de dias com pelo menos 1 refeição registrada, terminando
  -- em p_day. Um dia sem row em daily_summaries (nenhuma refeição) quebra o
  -- run: não há linha em d-1, a recursão para.
  WITH RECURSIVE walk AS (
    SELECT ds.day
    FROM public.daily_summaries ds
    WHERE ds.user_id = p_user_id AND ds.day = p_day AND ds.meals_count > 0
    UNION ALL
    SELECT ds.day
    FROM walk w
    JOIN public.daily_summaries ds
      ON ds.user_id = p_user_id
     AND ds.day = w.day - 1
     AND ds.meals_count > 0
  )
  SELECT count(*) INTO v_current FROM walk;

  -- Dia mais recente (<= p_day) com refeição registrada, pra alimentar os
  -- alertas de risco (M5.3).
  SELECT max(ds.day) INTO v_last_hit
  FROM public.daily_summaries ds
  WHERE ds.user_id = p_user_id AND ds.day <= p_day AND ds.meals_count > 0;

  INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_hit_day, updated_at)
  VALUES (p_user_id, v_current, v_current, v_last_hit, now())
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = GREATEST(public.streaks.longest_streak, EXCLUDED.current_streak),
    last_hit_day   = EXCLUDED.last_hit_day,
    updated_at     = now();
END;
$$;

-- Trigger de sync: antes só recomputava pra dias já fechados (goal_hit só
-- fecha no fim do dia). Agora "registrou uma refeição" já é definitivo no
-- instante do INSERT, então recomputa sempre o dia atual do usuário — dá o
-- feedback imediato que o streak-baseado-em-goal_hit nunca deu.
CREATE OR REPLACE FUNCTION public.fitbrother_sync_streak_on_daily_summary_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.fitbrother_apply_streak(v_user_id, public.fitbrother_today(v_user_id));

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- "Em risco" (§12.4): streak vivo, hoje ainda sem refeição registrada, e
-- dentro de 4h do próximo boundary. Só troca o critério de "já bateu hoje".
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
  v_logged    boolean;
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
  SELECT ds.meals_count > 0 INTO v_logged FROM public.daily_summaries ds
  WHERE ds.user_id = p_user_id AND ds.day = v_today;
  IF COALESCE(v_logged, false) THEN RETURN false; END IF;  -- já registrou hoje

  v_now_local := now() AT TIME ZONE v_tz;
  v_boundary  := date_trunc('day', v_now_local) + make_interval(hours => v_dsh);
  IF v_now_local >= v_boundary THEN
    v_boundary := v_boundary + interval '1 day';
  END IF;

  RETURN (v_boundary - v_now_local) <= interval '4 hours';
END;
$$;

-- streak_alert (21h local): mesmo critério de "já registrou hoje" do risco
-- acima, só que via daily_summaries direto (função já existente, só troca a
-- condição — mesma estrutura de 0035_alerts.sql).
CREATE OR REPLACE FUNCTION public.fitbrother_streak_alert()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    record;
  v_today   date;
  v_logged  boolean;
  v_count   int := 0;
BEGIN
  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE EXTRACT(HOUR FROM now() AT TIME ZONE p.timezone)::int = 21
  LOOP
    v_today := public.fitbrother_today(v_user.user_id);

    IF NOT EXISTS (
      SELECT 1 FROM public.streaks s
      WHERE s.user_id = v_user.user_id
        AND s.current_streak > 0
        AND s.last_hit_day = v_today - 1
    ) THEN
      CONTINUE;
    END IF;

    SELECT ds.meals_count > 0 INTO v_logged FROM public.daily_summaries ds
    WHERE ds.user_id = v_user.user_id AND ds.day = v_today;
    IF COALESCE(v_logged, false) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_user.user_id
        AND n.kind = 'streak_alert'
        AND n.created_at > now() - interval '20 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, channel, kind, template, payload)
    VALUES (v_user.user_id, 'push', 'streak_alert', 'streak_at_risk',
            jsonb_build_object('current_streak',
              (SELECT current_streak FROM public.streaks WHERE user_id = v_user.user_id)));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Recalcula de uma vez o streak de todo mundo sob a regra nova — sem isso,
-- current_streak fica com o valor antigo (derivado de goal_hit) até a
-- próxima refeição/tick de cada usuário.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN SELECT p.user_id FROM public.profiles p
  LOOP
    PERFORM public.fitbrother_apply_streak(v_user_id, public.fitbrother_today(v_user_id));
  END LOOP;
END;
$$;
