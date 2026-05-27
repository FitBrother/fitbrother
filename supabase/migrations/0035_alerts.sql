-- M5.3 — Funções de alerta (cron horário). Espelham fitbrother_streak_tick:
-- a função escolhe quem está no horário LOCAL certo; o pg-boss só agenda
-- hora-cheia UTC. Idempotentes por dia nutricional.
--
-- streak_alert (21h local): streak vivo (last_hit_day = ontem nutricional) e
-- hoje ainda sem goal_hit → push de risco. Inserindo notifications(channel=push)
-- o worker dispatch-notification já existente faz o envio.
CREATE OR REPLACE FUNCTION public.fitbrother_streak_alert()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  record;
  v_today date;
  v_hit   boolean;
  v_count int := 0;
BEGIN
  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE EXTRACT(HOUR FROM now() AT TIME ZONE p.timezone)::int = 21
  LOOP
    v_today := public.fitbrother_today(v_user.user_id);

    -- streak vivo terminando ontem?
    IF NOT EXISTS (
      SELECT 1 FROM public.streaks s
      WHERE s.user_id = v_user.user_id
        AND s.current_streak > 0
        AND s.last_hit_day = v_today - 1
    ) THEN
      CONTINUE;
    END IF;

    -- já bateu hoje? então não há risco.
    SELECT ds.goal_hit INTO v_hit FROM public.daily_summaries ds
    WHERE ds.user_id = v_user.user_id AND ds.day = v_today;
    IF COALESCE(v_hit, false) THEN
      CONTINUE;
    END IF;

    -- dedupe: 1 streak_alert por dia (cron pode reexecutar na mesma hora).
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

-- goal_reminder (19h local): kcal < 70% da meta E janela WA aberta.
-- WA-gated → dormente enquanto M4 (WhatsApp) está pausado: insere
-- channel='wa', que o dispatch atual ignora. Idempotente por dia.
CREATE OR REPLACE FUNCTION public.fitbrother_goal_reminder()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  record;
  v_today date;
  v_sum   record;
  v_count int := 0;
BEGIN
  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE EXTRACT(HOUR FROM now() AT TIME ZONE p.timezone)::int = 19
      AND p.wa_window_expires_at > now()           -- janela WA aberta
  LOOP
    v_today := public.fitbrother_today(v_user.user_id);

    SELECT ds.kcal, ds.goal_kcal INTO v_sum FROM public.daily_summaries ds
    WHERE ds.user_id = v_user.user_id AND ds.day = v_today;

    IF v_sum.goal_kcal IS NULL OR v_sum.goal_kcal = 0 THEN CONTINUE; END IF;
    IF v_sum.kcal >= v_sum.goal_kcal * 0.70 THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_user.user_id
        AND n.kind = 'goal_reminder'
        AND n.created_at > now() - interval '20 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, channel, kind, template, payload)
    VALUES (v_user.user_id, 'wa', 'goal_reminder', 'goal_behind',
            jsonb_build_object('kcal', v_sum.kcal, 'goal_kcal', v_sum.goal_kcal));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
