# Supabase seed data

Dados versionados de catálogo (não de usuário). Não há script de seed: o
conteúdo entra no banco por migrations, então `supabase db reset` e o deploy
aplicam o mesmo catálogo.

| Arquivo | Conteúdo | Carregado por |
|---|---|---|
| `taco-4ed.json` | 591 alimentos da TACO 4ª ed. (NEPA/UNICAMP, 2011), Tabela 1: `taco_num`, nome, categoria e macros por 100 g. Fora: nº 516/517 (sem kcal) e nº 450, 457, 458 e 591 (marcados com `*`, "análises sendo reavaliadas"). | `migrations/0083_foods_taco_catalog.sql` (`foods`, `source='taco'`, `verified=true`) |
| `taco-aliases.json` | 45 termos de busca (`"arroz branco"` → `Arroz, tipo 1, cozido`) apontando para `taco_num`. | `migrations/0084_food_aliases.sql` (`food_aliases`) |

Os blocos `VALUES` das migrations são gerados a partir destes JSONs
(`name_normalized`/`alias_normalized`: sem acento, minúsculas, vírgula vira
espaço, espaços colapsados). Para mudar o catálogo depois do merge, crie uma
migration nova; migrations já mergeadas são imutáveis.

O antigo `foods-taco.ts` (43 itens, upsert via service role) foi removido.

Fonte: http://www.cfn.org.br/wp-content/uploads/2017/03/taco_4_edicao_ampliada_e_revisada.pdf
("É permitida a reprodução parcial ou total desta obra, desde que citada a fonte.")
