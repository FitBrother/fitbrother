-- M1 §database. Subscription placeholder. MVP: every user is `free / active`.
-- Schema is ready for Stripe / RevenueCat integration post-MVP.

CREATE TABLE public.subscriptions (
  user_id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                     subscription_plan   NOT NULL DEFAULT 'free',
  status                   subscription_status NOT NULL DEFAULT 'active',
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  provider                 text,
  provider_subscription_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (owner_all) ───────────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_owner_all
  ON public.subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
