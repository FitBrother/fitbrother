-- M10 — short-lived, one-use proof of recent authentication for account deletion.

CREATE TABLE public.account_action_authorizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action              text NOT NULL CHECK (action = 'account_delete'),
  method              text NOT NULL CHECK (method IN ('password', 'oauth_challenge', 'oauth')),
  provider            text CHECK (provider IN ('google', 'apple')),
  token_hash           text NOT NULL UNIQUE,
  original_session_id text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,
  consumed_at          timestamptz
);

CREATE INDEX account_action_authorizations_user_action_idx
  ON public.account_action_authorizations (user_id, action, expires_at DESC);

ALTER TABLE public.account_action_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_action_authorizations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.fitbrother_consume_account_action_authorization(
  p_token_hash text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.account_action_authorizations
     SET consumed_at = now()
   WHERE user_id = auth.uid()
     AND action = p_action
     AND token_hash = p_token_hash
     AND consumed_at IS NULL
     AND expires_at > now()
  RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fitbrother_consume_account_action_authorization(text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fitbrother_consume_account_action_authorization(text, text)
  TO authenticated;
