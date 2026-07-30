-- M16: contexto de estilo de vida (rotina, barreiras, alimentação) coletado
-- no onboarding novo mas sem consumidor ainda — o M18 (contexto pra IA) vai
-- ler esse blob. Um jsonb só, sem colunas por campo: nenhuma dessas chaves
-- precisa ser filtrável em SQL, só lida de volta como blob pelo prompt.
ALTER TABLE public.profiles
  ADD COLUMN onboarding_context jsonb NOT NULL DEFAULT '{}';
