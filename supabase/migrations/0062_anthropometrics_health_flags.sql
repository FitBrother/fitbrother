-- M16: condições de saúde que já são input do motor de cálculo desde o M15
-- (TargetsInput) mas não tinham onde persistir. anthropometrics já é a
-- tabela versionada de "insumos do cálculo" (ganhou target_weight_kg/
-- rate_kg_per_week no M15) — essas colunas completam o TargetsInput ali,
-- prontas pra um recálculo futuro (M17) reler sem re-perguntar.
ALTER TABLE public.anthropometrics
  ADD COLUMN strength_training         boolean,
  ADD COLUMN is_pregnant_or_lactating  boolean,
  ADD COLUMN has_kidney_disease        boolean,
  ADD COLUMN has_type1_diabetes        boolean,
  ADD COLUMN uses_glp1                 boolean,
  ADD COLUMN tca_screening_positive    boolean;
