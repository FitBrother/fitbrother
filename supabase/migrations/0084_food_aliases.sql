-- Aliases de busca para o autocomplete de alimentos (RPC em 0085).
--
-- Mapeia termos que o usuário digita ("arroz branco", "frango grelhado") para o
-- alimento canônico da TACO. É só texto de busca: macros vêm sempre de `foods`.
-- Dados versionados em supabase/seed/taco-aliases.json.
--
-- Global catalog: anon/authenticated só leem aliases de alimentos verified;
-- escrita só via service_role (sem policy de escrita).

CREATE TABLE public.food_aliases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id           uuid NOT NULL REFERENCES public.foods (id) ON DELETE CASCADE,
  alias             text NOT NULL,
  alias_normalized  text NOT NULL,
  UNIQUE (food_id, alias_normalized)
);

CREATE INDEX food_aliases_alias_normalized_trgm
  ON public.food_aliases USING GIN (alias_normalized gin_trgm_ops);

REVOKE ALL ON public.food_aliases FROM anon, authenticated;
GRANT SELECT ON public.food_aliases TO anon, authenticated;

ALTER TABLE public.food_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY food_aliases_read_verified
  ON public.food_aliases
  FOR SELECT
  TO authenticated, anon
  USING (EXISTS (
    SELECT 1 FROM public.foods f
     WHERE f.id = food_aliases.food_id AND f.verified = true
  ));

CREATE TEMP TABLE alias_import (
  taco_name         text NOT NULL,
  alias             text NOT NULL,
  alias_normalized  text NOT NULL
);

INSERT INTO alias_import (taco_name, alias, alias_normalized) VALUES
  ('Frango, peito, sem pele, grelhado', 'frango grelhado', 'frango grelhado'),
  ('Frango, peito, sem pele, grelhado', 'peito de frango grelhado', 'peito de frango grelhado'),
  ('Arroz, tipo 1, cozido', 'arroz branco', 'arroz branco'),
  ('Arroz, tipo 1, cozido', 'arroz', 'arroz'),
  ('Arroz, integral, cozido', 'arroz integral', 'arroz integral'),
  ('Feijão, carioca, cozido', 'feijão', 'feijao'),
  ('Feijão, carioca, cozido', 'feijao carioca', 'feijao carioca'),
  ('Feijão, preto, cozido', 'feijão preto', 'feijao preto'),
  ('Ovo, de galinha, inteiro, cozido/10minutos', 'ovo cozido', 'ovo cozido'),
  ('Ovo, de galinha, inteiro, frito', 'ovo frito', 'ovo frito'),
  ('Banana, prata, crua', 'banana', 'banana'),
  ('Banana, prata, crua', 'banana prata', 'banana prata'),
  ('Banana, nanica, crua', 'banana nanica', 'banana nanica'),
  ('Café, infusão 10%', 'café', 'cafe'),
  ('Café, infusão 10%', 'cafe preto', 'cafe preto'),
  ('Carne, bovina, patinho, sem gordura, grelhado', 'patinho grelhado', 'patinho grelhado'),
  ('Carne, bovina, patinho, sem gordura, grelhado', 'bife de patinho', 'bife de patinho'),
  ('Cenoura, cozida', 'cenoura', 'cenoura'),
  ('Brócolis, cozido', 'brócolis', 'brocolis'),
  ('Aveia, flocos, crua', 'aveia', 'aveia'),
  ('Abacate, cru', 'abacate', 'abacate'),
  ('Abacate, cru', 'avocado', 'avocado'),
  ('Azeite, de oliva, extra virgem', 'azeite', 'azeite'),
  ('Pão, trigo, francês', 'pão francês', 'pao frances'),
  ('Pão, trigo, francês', 'pãozinho', 'paozinho'),
  ('Pão, trigo, francês', 'pão de sal', 'pao de sal'),
  ('Batata, doce, cozida', 'batata doce', 'batata doce'),
  ('Batata, inglesa, cozida', 'batata cozida', 'batata cozida'),
  ('Mandioca, cozida', 'mandioca', 'mandioca'),
  ('Mandioca, cozida', 'aipim', 'aipim'),
  ('Mandioca, cozida', 'macaxeira', 'macaxeira'),
  ('Iogurte, natural', 'iogurte', 'iogurte'),
  ('Maçã, Fuji, com casca, crua', 'maçã', 'maca'),
  ('Laranja, pêra, crua', 'laranja', 'laranja'),
  ('Mamão, Papaia, cru', 'mamão', 'mamao'),
  ('Mamão, Papaia, cru', 'papaia', 'papaia'),
  ('Melancia, crua', 'melancia', 'melancia'),
  ('Abacaxi, cru', 'abacaxi', 'abacaxi'),
  ('Morango, cru', 'morango', 'morango'),
  ('Cuscuz, de milho, cozido com sal', 'cuscuz', 'cuscuz'),
  ('Mel, de abelha', 'mel', 'mel'),
  ('Manteiga, com sal', 'manteiga', 'manteiga'),
  ('Refrigerante, tipo cola', 'refrigerante', 'refrigerante'),
  ('Refrigerante, tipo cola', 'coca cola', 'coca cola'),
  ('Leite, condensado', 'leite condensado', 'leite condensado');

DO $$
DECLARE
  expected int;
  inserted int;
BEGIN
  SELECT count(*) INTO expected FROM alias_import;

  INSERT INTO public.food_aliases (food_id, alias, alias_normalized)
  SELECT f.id, a.alias, a.alias_normalized
    FROM alias_import a
    JOIN public.foods f ON f.source = 'taco' AND f.name = a.taco_name;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted <> expected THEN
    RAISE EXCEPTION 'food_aliases seed: inserted % of % aliases (nome TACO não encontrado em foods)', inserted, expected;
  END IF;
END $$;

DROP TABLE alias_import;
