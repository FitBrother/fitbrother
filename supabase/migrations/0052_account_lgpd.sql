-- M6 — Backend LGPD + contratos para M10.
-- Estado de delecao de conta, auditoria operacional LGPD e retencao de audios.

CREATE TABLE public.account_deletions (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  scheduled_purge_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  reason             text,
  purged_at          timestamptz
);

CREATE INDEX account_deletions_due_idx
  ON public.account_deletions (scheduled_purge_at)
  WHERE purged_at IS NULL;

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_deletions_owner_read
  ON public.account_deletions
  FOR SELECT
  USING (auth.uid() = user_id);
-- Escrita fica restrita ao backend via service-role.

CREATE TABLE public.account_audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  status     text NOT NULL,
  request_id text,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_audit_log_action_len CHECK (length(action) BETWEEN 1 AND 80),
  CONSTRAINT account_audit_log_status_len CHECK (length(status) BETWEEN 1 AND 40)
);

CREATE INDEX account_audit_log_user_created_idx
  ON public.account_audit_log (user_id, created_at DESC);

CREATE INDEX account_audit_log_action_created_idx
  ON public.account_audit_log (action, created_at DESC);

ALTER TABLE public.account_audit_log ENABLE ROW LEVEL SECURITY;
-- Sem policy de leitura no app: /account/export inclui uma versao sanitizada.

ALTER TABLE public.meals
  ADD COLUMN audio_deleted_at timestamptz;

CREATE INDEX meals_audio_retention_idx
  ON public.meals (created_at)
  WHERE audio_path IS NOT NULL AND audio_deleted_at IS NULL;
