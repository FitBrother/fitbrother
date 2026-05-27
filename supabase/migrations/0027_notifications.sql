-- M5.2 — Notifications outbox (FEATURES §3.3).
--
-- Cada notificação a enviar vira uma row. A MESMA notificação lógica pode
-- gerar duas rows (uma por canal: push + wa) — "push sempre, WA aditivo"
-- (CLAUDE.md regra #6). No M5 o WA está pausado (M4), então só `channel='push'`
-- é produzido por enquanto.
--
-- Funciona como outbox: produtores (trigger de achievements, crons de alerta)
-- inserem com `sent_at IS NULL`; o worker dispatch-notification drena a fila,
-- envia via Expo Push e marca `sent_at` (+ `error` em falha).

CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel      notification_channel NOT NULL,
  kind         notification_kind NOT NULL,
  template     text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at      timestamptz,
  delivered_at timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Fila do dispatcher: pendentes por canal, mais antigas primeiro.
CREATE INDEX notifications_pending_idx
  ON public.notifications (channel, created_at)
  WHERE sent_at IS NULL;

-- Histórico por usuário (tela de notificações / debug).
CREATE INDEX notifications_user_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Usuário lê as próprias. Escrita só via SECURITY DEFINER (trigger/cron) ou
-- service_role (worker) — sem policy de write, RLS bloqueia o resto.
CREATE POLICY notifications_owner_read
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);
