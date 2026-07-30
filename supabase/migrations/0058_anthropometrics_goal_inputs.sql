-- Nullable: sem UI própria até o M16 (peso-alvo/ritmo).
ALTER TABLE public.anthropometrics
  ADD COLUMN target_weight_kg numeric(5,2),
  ADD COLUMN rate_kg_per_week numeric(4,3);
