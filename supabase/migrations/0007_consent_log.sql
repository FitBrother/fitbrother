-- M1 §database. LGPD consent ledger.
-- Append a new row on grant; UPDATE only to set `revoked_at` (revocation flow).

CREATE TABLE public.consent_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope          consent_scope NOT NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  policy_version text NOT NULL
);

CREATE INDEX consent_log_user_scope_idx
  ON public.consent_log (user_id, scope, granted_at DESC);

-- ── RLS (owner_all) ───────────────────────────────────────────────────────
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_log_owner_all
  ON public.consent_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
