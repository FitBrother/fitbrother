-- M5.2 — Achievements (conquistas estilo Duolingo) (FEATURES §3.3).
--
-- `achievements` é um catálogo global; `user_achievements` registra o desbloqueio
-- por usuário (PK composta = idempotente por natureza). O critério de cada
-- conquista vive em `criteria_json` (DSL pequena), então adicionar conquista =
-- INSERT no catálogo, sem código novo.
--
-- DSL de critério: { "type": <tipo>, "value": N }
--   streak         → streaks.current_streak >= N
--   meals_total    → nº de refeições válidas >= N
--   wa_meals_total → nº de refeições via WhatsApp >= N   (sem dados até M4)
--   weekly_hits    → dias com goal_hit nos últimos 7 dias nutricionais >= N
--   days_active    → nº de dias distintos com ≥1 refeição >= N
--   friends_total  → nº de amigos aceitos >= N           (sempre 0 até M5.3)

-- ── achievements (catálogo) ──────────────────────────────────────────────
CREATE TABLE public.achievements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  title         text NOT NULL,
  description   text NOT NULL,
  icon          text NOT NULL,          -- nome do ícone lucide (mapeado no app)
  criteria_json jsonb NOT NULL,
  sort_order    int NOT NULL DEFAULT 0
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Catálogo é público pra usuários logados (read-only). Escrita só via migration.
CREATE POLICY achievements_read
  ON public.achievements
  FOR SELECT
  USING (true);

GRANT SELECT ON public.achievements TO anon, authenticated;

-- ── user_achievements (desbloqueios) ─────────────────────────────────────
CREATE TABLE public.user_achievements (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_achievements_owner_read
  ON public.user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);
-- Escrita só via SECURITY DEFINER (fitbrother_evaluate_achievements).

-- ── Seed: 10 conquistas do MVP (PLAN.md §M5) ─────────────────────────────
INSERT INTO public.achievements (code, title, description, icon, criteria_json, sort_order) VALUES
  ('first_meal',   'Primeiro registro',     'Você registrou sua primeira refeição.',          'utensils',      '{"type":"meals_total","value":1}',   10),
  ('streak_3',     'Ofensiva de 3',         '3 dias seguidos batendo a meta.',                'flame',         '{"type":"streak","value":3}',        20),
  ('streak_7',     'Ofensiva de 7',         'Uma semana inteira na meta.',                    'flame',         '{"type":"streak","value":7}',        30),
  ('streak_14',    'Ofensiva de 14',        'Duas semanas de ofensiva.',                      'flame',         '{"type":"streak","value":14}',       40),
  ('streak_30',    'Ofensiva de 30',        'Um mês inteiro de constância.',                  'trophy',        '{"type":"streak","value":30}',       50),
  ('weekly_7',     'Semana perfeita',       '7 dias com a meta batida em uma semana.',        'calendar-check','{"type":"weekly_hits","value":7}',   60),
  ('first_week',   'Primeira semana',       '7 dias diferentes com refeição registrada.',     'calendar-days', '{"type":"days_active","value":7}',   70),
  ('meals_50',     '50 refeições',          'Você já registrou 50 refeições.',                'medal',         '{"type":"meals_total","value":50}',  80),
  ('first_friend', 'Primeiro amigo',        'Você adicionou seu primeiro amigo.',             'users',         '{"type":"friends_total","value":1}', 90),
  ('first_wa_meal','Registro pelo WhatsApp','Sua primeira refeição registrada pelo WhatsApp.','message-circle','{"type":"wa_meals_total","value":1}',100);

-- ── Avaliação ────────────────────────────────────────────────────────────
-- Recalcula as conquistas de UM usuário. Desbloqueia o que cruzou o limiar e
-- ainda não foi desbloqueado, e enfileira uma notificação push por desbloqueio.
-- Idempotente (ON CONFLICT DO NOTHING) — só notifica o que de fato entrou agora.
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
      0::bigint AS friends_total  -- M5.3 troca por count de friendships aceitas
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
    p_user_id,
    'push',
    'achievement',
    'achievement_unlocked',
    jsonb_build_object('code', a.code, 'title', a.title, 'icon', a.icon)
  FROM unlocked u
  JOIN public.achievements a ON a.id = u.achievement_id;
END;
$$;

-- ── Triggers ──────────────────────────────────────────────────────────────
-- Reavalia após cada mudança em daily_summaries ou streaks (FEATURES §3.3).
-- AFTER ROW; só insere em user_achievements/notifications, então não recursa
-- de volta nessas tabelas.
CREATE OR REPLACE FUNCTION public.fitbrother_achievements_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fitbrother_evaluate_achievements(NEW.user_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_eval_achievements_daily
  AFTER INSERT OR UPDATE ON public.daily_summaries
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_achievements_trigger();

CREATE TRIGGER trg_eval_achievements_streak
  AFTER INSERT OR UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_achievements_trigger();
