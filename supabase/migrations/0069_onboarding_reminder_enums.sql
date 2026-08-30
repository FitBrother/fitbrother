-- M17 — novo canal/kind de notificação pro lembrete de cadastro abandonado.
-- Isolado numa migration própria: não pode ser usado na mesma transação em
-- que é criado (mesmo padrão de 0051_insight_notification_kind.sql).
ALTER TYPE public.notification_channel ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'onboarding_reminder';
