-- M15: motor de cálculo migra pra TS puro (packages/shared/src/targets). O
-- trigger anterior computava BMR/TDEE em SQL a cada INSERT em anthropometrics;
-- agora esses valores chegam prontos do backend, computados por computeTargets.
-- Único inserter de anthropometrics hoje é a RPC complete_onboarding
-- (auditado em docs/superpowers/specs/2026-07-14-m15-motor-calculo-design.md).
DROP TRIGGER IF EXISTS anthropometrics_calculate_bmr_tdee ON public.anthropometrics;
DROP FUNCTION IF EXISTS public.calculate_bmr_tdee();
