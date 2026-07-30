ALTER TABLE public.nutrition_goals
  ADD COLUMN fiber_g numeric(7,2),
  ADD COLUMN tdee_source text NOT NULL DEFAULT 'declared',
  ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN blocked boolean NOT NULL DEFAULT false;
