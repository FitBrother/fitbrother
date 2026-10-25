-- Stripe billing: subscriptions vira somente leitura para clientes; escrita só via service_role.
ALTER TABLE public.subscriptions
  ADD COLUMN stripe_customer_id text UNIQUE;

DROP POLICY subscriptions_owner_all ON public.subscriptions;

CREATE POLICY subscriptions_owner_select
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated, anon;

-- Idempotência de webhooks Stripe; acesso apenas service_role (sem policy).
CREATE TABLE public.stripe_events (
  event_id     text PRIMARY KEY,
  type         text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.stripe_events FROM anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
