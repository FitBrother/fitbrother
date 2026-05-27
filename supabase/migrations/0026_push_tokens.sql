-- M5.2 — Expo push device tokens (FEATURES §3.3).
--
-- Um usuário pode ter vários tokens (múltiplos devices). `token` é UNIQUE
-- global: o mesmo device reinstalado/reatribuído reaponta pro dono atual via
-- upsert no POST /push-tokens. Soft-revoke (`revoked_at`) em vez de delete pra
-- manter histórico e permitir dedupe.

CREATE TABLE public.push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  platform   device_platform NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- Fila de envio: tokens ativos de um usuário.
CREATE INDEX push_tokens_active_idx
  ON public.push_tokens (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- O usuário gerencia os próprios tokens (registra no login, revoga no logout).
CREATE POLICY push_tokens_owner_all
  ON public.push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
