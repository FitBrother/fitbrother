-- M18: frequência de treino, coletada no bloco `training` do onboarding (M16)
-- mas nunca persistida — ficava só no estado local do app, sem consumidor.
-- Agora alimenta buildCoachContext (packages/shared/src/coach).
ALTER TABLE public.anthropometrics
  ADD COLUMN training_days_per_week smallint;
