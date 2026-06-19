-- M7.3 — Kinds de notificação social (like/comentário em post).
-- Enum value novo não pode ser usado na mesma transação em que é adicionado,
-- por isso fica numa migration isolada (consumido pelo backend depois).
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'post_like';
ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'post_comment';
