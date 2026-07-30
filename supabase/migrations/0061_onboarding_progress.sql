-- M16: persistência de progresso do onboarding, pra resume real no servidor
-- (fechar o app e reabrir retoma exatamente no bloco em que parou).
CREATE TABLE public.onboarding_progress (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_block text NOT NULL,
  answers       jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON public.onboarding_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
