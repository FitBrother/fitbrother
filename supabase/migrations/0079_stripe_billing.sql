-- Stripe billing: subscriptions is read-only for clients; writes only via service_role.
ALTER TABLE public.subscriptions
  ADD COLUMN stripe_customer_id text UNIQUE;

DROP POLICY subscriptions_owner_all ON public.subscriptions;

CREATE POLICY subscriptions_owner_select
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON public.subscriptions FROM authenticated, anon;
GRANT SELECT ON public.subscriptions TO authenticated;

-- Stripe webhook idempotency; service_role only (no policy).
CREATE TABLE public.stripe_events (
  event_id     text PRIMARY KEY,
  type         text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.stripe_events FROM anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
