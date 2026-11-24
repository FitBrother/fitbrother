# Autocomplete de alimentos na edição de refeição — Design

Data: 2026-11-24 · Status: rascunho aguardando aprovação · Tamanho: projeto (3 entregas em sequência)

## Intenção e porquê

Na edição de refeição (`EditMealModal.tsx` → `ItemEditor`), o nome do alimento é um `TextInput` livre e os macros (kcal/P/C/G) são digitados à mão. O usuário não recebe sugestão nem preenchimento automático, então editar é lento e impreciso, e o dado perde a âncora no catálogo `foods` que o pipeline de IA já usa.

Objetivo: ao digitar o nome, sugerir alimentos (catálogo verificado + itens que o próprio usuário já registrou), preencher os macros a partir da escolha e recalculá-los quando a quantidade mudar — sem tirar a liberdade de texto livre.

## Estado atual (verificado no código)

- `foods` (`0010_foods.sql`): macros por 100 g, `serving_label`/`serving_grams`, `verified`, índice GIN trigram em `name_normalized`. Leitura pública só de `verified = true`; escrita só `service_role`.
- RPC `fitbrother_foods_fuzzy_match` (`0020`): top 5, threshold 0.4, só verificados. Usada pelo pipeline de IA (`apps/server/src/services/foods.ts`).
- Seed `supabase/seed/foods-taco.ts` (até 2026-11-24): 43 alimentos. O próprio arquivo e o PLAN.md (M2.1) listam a expansão para ~600 como pendência pré-launch.
- Conversão de quantidade → gramas já existe no servidor (`quantityInGrams` em `apps/server/src/services/meals.ts`): `g` e `ml` (densidade 1) = quantidade; `unit` = quantidade × `serving_grams`; `slice/cup/tbsp/tsp` = sem conversão.
- `PATCH /meals/:id` faz replace total dos itens; `PatchMealItemSchema` (`packages/shared/src/schemas.ts`) **não aceita `food_id`** hoje.
- `meal_items` guarda snapshot de macros (não recalcula se `foods` mudar).
- Já existe registro por código de barras (Open Food Facts) na criação de refeição, então esse item da ideia original não entra aqui.

## Metas

1. Catálogo com cobertura suficiente pra o autocomplete parecer útil (~600 alimentos TACO) e busca que entenda como o usuário escreve (aliases).
2. Endpoint de busca de alimentos para autocomplete, mesclando catálogo e recentes do usuário.
3. Componente de autocomplete na edição, com preenchimento e recálculo de macros por quantidade e estado "ajustado".

## Não-metas

- Fallback "Estimar com IA" na edição (cap `ai_usage`, cache `ai_extractions`): spec própria depois.
- Open Food Facts / USDA no autocomplete.
- Re-vincular ao catálogo itens já salvos ao abrir a edição.
- Alterar o pipeline de IA ou a RPC `fitbrother_foods_fuzzy_match`.
- Dark mode, novas dependências pesadas.

## Anti-metas (falha mesmo que "funcione")

- Travar o usuário: texto livre sem escolha de sugestão tem que continuar salvando (`food_id = null`).
- O app sobrescrever macros que o usuário digitou manualmente.
- Sugestões com macros errados por seed digitado de memória (ver Restrições).

## Restrições

- Regras do CLAUDE.md: migrations imutáveis (nova migration, próxima numeração livre depois da `0082`), RLS sempre, `foods` só escrita via `service_role`, skeleton (nunca `ActivityIndicator` solto), `tabular-nums` em números, hit target 44×44, `accessibilityLabel`/`accessibilityRole`, tipografia por família, cores por token, ícones `lucide-react-native`.
- **Dados da TACO** devem vir do arquivo/tabela oficial (UNICAMP, 4ª ed.), importados por script e conferidos por amostragem. Não gerar valores nutricionais de memória. Aliases são texto de busca, não dado nutricional.
- Rodar o seed contra banco de produção é ação que afeta produção: executar primeiro em ambiente controlado, com revisão de outra pessoa.
- `FEATURES.md` é a fonte de verdade do schema: atualizar §3 (`food_aliases`) junto com a migration; atualizar o Status de M2.1 em `docs/PLAN.md`.

## Abordagens consideradas

| # | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| A | Só IA estimando a cada edição | Caro, lento, macros variam entre chamadas | Fica como fallback futuro |
| B | **Catálogo (TACO) + aliases + recentes do usuário + IA como fallback futuro** | Precisa expandir dados e criar RPC/UI; resultado estável e barato | **Escolhida** (já aprovada na conversa) |
| C | Open Food Facts como base | Bom para embalados, fraco para comida caseira, qualidade irregular | Complemento futuro |

## Design

### Entrega 1 — Dados: TACO completa + aliases

**Fonte (resolvida em 2026-11-24):** PDF oficial da TACO 4ª ed. ampliada e revisada (NEPA/UNICAMP, 2011), hospedado pelo CFN: `http://www.cfn.org.br/wp-content/uploads/2017/03/taco_4_edicao_ampliada_e_revisada.pdf`. A obra declara "permitida a reprodução parcial ou total, desde que citada a fonte"; citar a fonte no cabeçalho do arquivo de dados e na tela de créditos/ajuda. Extração por script (`pdftotext -layout` + parser) da Tabela 1 (colunas: energia kcal, proteína, lipídeos, carboidrato): 597 alimentos, numeração 1–597 contínua, kcal×kJ coerentes em todas as linhas.

Regras de importação definidas na extração:
- Excluir os 2 sem kcal (nº 516 e 517, sais) e os 4 marcados com `*` na TACO ("análises sendo reavaliadas", sem dados: nº 450 Iogurte sabor abacaxi, 457 Leite de vaca desnatado UHT, 458 Leite de vaca integral, 591 Coco verde cru). `*` não é `Tr`: não vira 0. Entram 591.
- `Tr` (traço) → 0. `NA` em proteína/lipídeo/carboidrato → 0 apenas quando há kcal (9 itens: óleos/azeites e cachaça), marcados no arquivo de dados.
- Nome com marca de nota de rodapé: nº 474 vira "Cerveja, pilsen" (o "2" é nota do teor alcoólico). Cerveja e cachaça fogem da regra 4P+4C+9F por causa do álcool; não é erro de extração.
- Guardar `taco_num` e categoria no arquivo de dados (útil para curadoria e aliases), mesmo que a tabela `foods` não os use na v1.

**Achado sobre o seed atual (43 itens, não 25):** 29 deles não têm nome igual ao da TACO (ex.: "Arroz, branco, cozido" é "Arroz, tipo 1, cozido" na TACO; "Banana, prata", "Queijo, mussarela" etc.) e 5 divergem do PDF em macros: "Amendoim, torrado, salgado" (seed 544 kcal/27,4 P/43,9 G; TACO 606/22,5/54,0), "Brócolis, cozido" (carbo 4,0 vs 4,4; gord. 0,4 vs 0,5), "Café, infusão 10%" (carbo 1,7 vs 1,5), "Manteiga, com sal" (carbo 0,06 vs 0,1) e "Azeite, de oliva, extra virgem" (proteína/carbo 0 vs NA). Como o upsert é por `(source, name)`, importar a TACO sem tratar isso **duplicaria** alimentos. **Decisão (usuário, 2026-11-24): só a TACO entra; o que não bate com ela sai.** A migration `0083_foods_taco_catalog.sql` faz upsert dos 591 (corrigindo as 5 divergências, preservando `serving_*` das linhas que já existiam) e remove as linhas `source='taco'` fora da TACO. `meal_items.food_id` dessas vira NULL (macros históricos ficam, por snapshot). Efeito colateral aceito: os 29 itens removidos tinham `serving_grams`; os equivalentes da TACO entram sem porção, então "2 ovos" no pipeline de IA cai nos macros do LLM até a curadoria de porções (a tratar junto dos aliases).

- Expandir `supabase/seed/foods-taco.ts` para a TACO completa, mantendo upsert idempotente por `(source, name)`. Preferir ler de um arquivo de dados versionado (JSON/CSV) em vez de um array gigante no `.ts`.
- Nova tabela global `food_aliases(id, food_id → foods ON DELETE CASCADE, alias, alias_normalized)` com índice GIN trigram em `alias_normalized`, RLS de leitura igual a `foods` (somente aliases de alimentos `verified`), escrita só `service_role`. Escolhida em vez de `text[]` na própria `foods` para poder indexar por trigram e curar sem tocar no alimento.
- Aliases iniciais: curadoria dos alimentos mais comuns (ex.: "frango grelhado" → "Frango, peito, sem pele, grelhado"; "arroz integral"; "pão de forma"; "café com leite"). Cobertura total de aliases não é requisito de v1; o conjunto cresce por curadoria. Normalização igual à de `name_normalized` (minúsculas, sem acento, sem vírgula).

### Entrega 2 — RPC de autocomplete

`fitbrother_foods_autocomplete(p_query text, p_limit int DEFAULT 8)`, `SECURITY INVOKER` (RLS de `meal_items`/`meals` resolve "recentes do usuário" via `auth.uid()`).

- Retorna linhas com `kind` (`catalog` | `recent`), `food_id` (nulo em recente sem vínculo), `name`, `serving_label`, `serving_grams`, macros por 100 g (catálogo) ou macros + `quantity`/`unit` do último uso (recente), `score`.
- `p_query` vazio → só recentes (últimos 90 dias, `deleted_at IS NULL`, agrupados por `food_id`/descrição normalizada, ordenados por frequência e recência). Serve ao campo focado sem texto.
- `p_query` com 1 caractere → vazio. 2 caracteres → só prefixo (`name_normalized`/`alias_normalized` começando com o termo). 3+ → prefixo primeiro, depois `similarity` (threshold 0.3, a calibrar), tie-break por nome mais curto. Match por alias resolve para o alimento canônico, sem duplicar linhas.
- Recentes que casam com a busca entram antes de catálogo com score equivalente; deduplicar recente × catálogo quando apontam para o mesmo `food_id`.
- Ranking (ajuste da revisão final): alias igual ao termo vale 4 e alias começando pelo termo 3,5 (nome começando pelo termo 3, início de palavra 2); nome com cru/crua/crus/cruas perde 0,5 quando o termo não tem "cru". O fuzzy match do pipeline de IA (`fitbrother_foods_fuzzy_match`, migration `0086`) passa a considerar aliases e a rebaixar o cru na ordenação (-0,2), com o mesmo limiar 0,4.
- Apenas `verified = true` no catálogo.
- Cliente: `lib/api` (ou hook `useFoodSuggestions`) chamando `supabase.rpc`, debounce ~250 ms, react-query com `staleTime`.

### Entrega 3 — UI e fluxo de edição

Componente `components/domain/FoodAutocomplete.tsx` substitui o `TextInput` de descrição no `ItemEditor`.

Estado do item (`ItemDraft`) ganha: `food` (referência com macros por 100 g e `serving_grams`, ou nulo), `adjusted: boolean`. Ambos só no cliente.

Regras de comportamento:
1. Digitar abre lista de sugestões (linhas com nome, porção e kcal; recentes com marcador). Loading = skeleton de linhas. Sem resultado → lista some e o texto livre segue valendo.
2. Escolher sugestão de catálogo: preenche `description`, `food`, define quantidade/unidade padrão (1 `unit` se houver `serving_grams`, senão 100 `g`), calcula macros, `adjusted = false`.
3. Escolher recente: preenche descrição, quantidade/unidade e macros do último uso; ao mudar a quantidade na mesma unidade, macros escalam proporcionalmente.
4. Mudar quantidade/unidade com item vinculado e `adjusted = false`: recalcular macros. Conversão por gramas igual à do servidor (`g`, `ml`, `unit`); extrair `quantityInGrams` para `packages/shared` e usar nos dois lados para não divergir. Unidades sem conversão (`slice/cup/tbsp/tsp`): não recalcula, mantém macros e mostra dica curta.
5. Editar qualquer macro à mão: `adjusted = true`, para de recalcular, mostra chip "Ajustado" com ação "Voltar ao catálogo" (recalcula e zera o flag).
6. Editar o texto da descrição depois de vincular: desvincula (`food = null`, `food_id = null`), mantém os macros atuais.
7. Itens carregados de uma refeição já salva abrem como não vinculados (sem recálculo automático) até o usuário escolher uma sugestão.

Persistência:
- `PatchMealItemSchema` ganha `food_id: UuidSchema.nullable().optional()`; `PATCH /meals/:id` grava `food_id` (RLS/FK garantem existência). Macros continuam vindo do cliente (o usuário é dono do próprio dado e pode ter ajustado). Sem recálculo no servidor.
- UI: tokens e componentes existentes, `accessibilityRole`/`accessibilityLabel` nas linhas de sugestão, hit target 44×44, números com `tabular-nums`.

## Testes

- SQL: casos da RPC (prefixo com 2 caracteres, alias, acento, vazio = só recentes, soft delete excluído, isolamento entre usuários via RLS).
- Unitário: `quantityInGrams` compartilhado (servidor e cliente), reducer do `ItemDraft` (vincular, recalcular, ajustar, desvincular).
- Componente: `FoodAutocomplete` (sugestão aparece, seleção preenche, texto livre salva sem `food_id`), seguindo o padrão de `MealComposer.test.tsx`.
- Rota: `PATCH /meals/:id` aceita e persiste `food_id`.

## Ordem de entrega

1. Dados (seed TACO completo + `food_aliases`) — migration + script + docs.
2. RPC `fitbrother_foods_autocomplete` + hook de cliente.
3. `FoodAutocomplete` + reducer + `food_id` no PATCH.
Cada entrega pode virar PR própria; a 3 depende da 2, a 2 funciona (com menos valor) mesmo antes da 1 terminar.

## Decisões do autor (a validar na revisão)

Calls minhas, tomadas após a revisão do documento; contestáveis.

1. **Recentes sem `food_id` usam "âncora de uso anterior".** O `ItemDraft` tem dois modos de vínculo: `food` (catálogo, macros por 100 g) ou `anchor` (macros + quantidade + unidade do último uso). Com `anchor`, mudar a quantidade **na mesma unidade da âncora** escala macros proporcionalmente; mudar a unidade mantém os macros e não recalcula (dica curta). Ambos os modos respeitam `adjusted`.
2. **Recente com `food_id`** é tratado como catálogo: a RPC devolve também os macros por 100 g e `serving_grams` do alimento, e o item entra no modo `food`, mas **preservando quantidade/unidade do último uso**. Se a unidade não tiver conversão (`slice/cup/tbsp/tsp`) ou faltar `serving_grams`, o item fica vinculado sem recalcular, com a dica de unidade.
3. **Agrupamento de recentes:** por `food_id` quando existe; senão por (descrição normalizada, unidade). O "último uso" é o mais recente do grupo. Recente sem `food_id` que case por nome com um alimento do catálogo continua aparecendo separado (a RPC não tenta fundi-los na v1); aceitamos a possível duplicidade visual.
4. **`food_id` no PATCH:** o servidor valida só a FK. "Vinculado com macros ajustados" é intencional: `food_id` indica a origem do item, não que os macros batem com o catálogo (snapshot, como já é em `meal_items`). `density_assumed` fica `false` no PATCH na v1 (o PATCH hoje não calcula esse campo).
5. **RLS de `food_aliases`:** leitura via subselect em `foods.verified = true`, `SECURITY INVOKER`. Medir na entrega 2 com o catálogo completo; só trocar por view ou função `SECURITY DEFINER` se o tempo de busca ficar acima do aceitável.

## Em aberto para quem constrói (decisão do construtor)

- Formato e origem exata do arquivo TACO a importar e como conferir a amostra.
- Threshold final de similaridade e pesos de ranking (calibrar com dados reais).
- Forma de exibir recentes sem `food_id` (rótulo/ícone).
- Se o servidor deve marcar `density_assumed` (`unit = ml` + `food_id`) no PATCH, como o pipeline faz na criação.
