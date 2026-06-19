-- M8.2 — Kind de notificação para insight pronto (push). Enum value novo em
-- migration isolada (não pode ser usado na mesma transação em que é criado).
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'insight_ready';
