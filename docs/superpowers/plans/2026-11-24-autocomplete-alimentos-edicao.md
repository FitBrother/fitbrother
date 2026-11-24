# Autocomplete de alimentos na edição de refeição — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao editar um item de refeição, sugerir alimentos (catálogo TACO + recentes do usuário), preencher os macros e recalculá-los quando a quantidade muda, sem tirar o texto livre.

**Architecture:** Migration cria `food_aliases` e a RPC `fitbrother_foods_autocomplete` (SECURITY INVOKER). O servidor Fastify expõe `GET /foods/search` chamando a RPC com o cliente Supabase do usuário (RLS vale), como o app já faz com `/users/search`. O app ganha um hook, um reducer puro para o estado do item (vínculo, recálculo, "ajustado") e o componente `FoodAutocomplete`. A conversão quantidade→gramas sai do servidor para `packages/shared` e é usada pelos dois lados.

**Tech Stack:** Postgres (pg_trgm, unaccent), Fastify, Zod, React Native/Expo, NativeWind, TanStack Query; testes com vitest (server/shared) e jest-expo (mobile); smoke SQL em `supabase/tests/`.

**Spec:** `docs/superpowers/specs/2026-11-24-autocomplete-alimentos-edicao-design.md`. A entrega 1 (catálogo TACO, migration `0083`) já está commitada. Este plano cobre `food_aliases` (resto da entrega 1), entrega 2 e entrega 3.

**Decisão do plano (diverge de um detalhe do spec):** o spec falava em o cliente chamar `supabase.rpc` direto; o plano usa uma rota do servidor (`/foods/search`), porque é o padrão do app (`/users/search`) e mantém o normalizador num lugar só.

## Global Constraints

- Migrations imutáveis; próximas numerações: `0084`, `0085`.
- RLS sempre; `foods`/`food_aliases` só `service_role` escreve; leitura só de `verified = true`.
- Normalização de nome: minúsculas, sem acento, sem vírgula, espaços colapsados (igual a `normalize()` em `apps/server/src/services/foods.ts`). O chamador normaliza antes de enviar à RPC.
- Autocomplete: debounce 250 ms; 0 caracteres → só recentes; 1 caractere → vazio; 2 → só prefixo; 3+ → prefixo e depois `similarity` ≥ 0.3; `p_limit` padrão 8; recentes = últimos 90 dias, `deleted_at IS NULL` em `meals` e `meal_items`.
- Conversão em gramas (`quantityInGrams`): `g` e `ml` = quantidade; `unit` = quantidade × `serving_grams` (nulo se não houver); `slice/cup/tbsp/tsp` = nulo.
- UI (CLAUDE.md): famílias de fonte (`font-sans-*`), `tabular-nums` em números, tokens de cor, hit target 44×44, `accessibilityLabel`/`accessibilityRole`, ícones `lucide-react-native`, loading de lista = skeleton (`SkeletonBlock`), nunca `ActivityIndicator` solto. Comentários só se necessário, em inglês, 1 linha.
- Commits: Conventional Commits, sem trailer de agente (regra do usuário no CLAUDE.md global).
- Não rodar migrations em produção sem ambiente de teste e revisão de outra pessoa.

## Review Focus

- Termo digitado com `%`, `_` ou `\` (ex.: "100%") não pode virar curinga no `LIKE`; deve buscar o texto literal. Teste na Task 2.
- Texto livre sem escolher sugestão salva com `food_id = null` e macros digitados intactos. Teste na Task 5.
- Item já salvo com `food_id` não pode perder o vínculo ao editar só a quantidade (hoje o PATCH reinsere itens sem `food_id`). Teste na Task 4 e Task 5.
- Usuário digita um macro e depois muda a quantidade: o macro digitado não pode ser sobrescrito. Teste na Task 5.
- Busca com acento, maiúsculas e espaços extras ("  FEIJÃO  ") acha o mesmo que "feijao". Teste na Task 2 e Task 4.

---

### Task 1: Tabela `food_aliases` + aliases iniciais

**Files:**
- Create: `supabase/migrations/0084_food_aliases.sql`
- Create: `supabase/seed/taco-aliases.json`
- Test: `supabase/tests/0084_food_aliases.sql`

**Interfaces:**
- Produces: tabela `public.food_aliases(id uuid PK, food_id uuid NOT NULL → foods ON DELETE CASCADE, alias text NOT NULL, alias_normalized text NOT NULL, UNIQUE(food_id, alias_normalized))`; índice GIN `gin_trgm_ops` em `alias_normalized`; RLS: SELECT para `authenticated, anon` quando o `food_id` aponta para `foods.verified = true`; sem policy de escrita.

- [ ] **Step 1: Escrever o smoke test** em `supabase/tests/0084_food_aliases.sql` (mesmo estilo de `0080_stripe_billing.sql`: `BEGIN` … `ROLLBACK`, `RAISE NOTICE 'PASS …'`). Casos: (a) cada alias do JSON resolveu para um alimento (contagem de `food_aliases` = total de aliases do JSON); (b) `authenticated` lê `food_aliases`; (c) `authenticated` não consegue `INSERT` (erro de RLS); (d) alias de alimento `verified=false` inserido via `service_role` não aparece para `authenticated`; (e) apagar o alimento apaga seus aliases.
- [ ] **Step 2: Rodar e ver falhar.** Run: `psql "$DB_URL" -f supabase/tests/0084_food_aliases.sql` num banco com migrations até `0083`. Expected: erro `relation "public.food_aliases" does not exist`.
- [ ] **Step 3: Criar `supabase/seed/taco-aliases.json`** no formato `[{ "taco_num": 410, "aliases": ["frango grelhado", "peito de frango grelhado"] }]`, com os aliases abaixo (nomes conferidos contra `taco-4ed.json`) e outros comuns que o executor conferir no mesmo arquivo: 410 frango grelhado/peito de frango grelhado; 3 arroz branco/arroz; 561 feijão/feijao carioca; 488 ovo cozido; 490 ovo frito; 182 banana/banana prata; 179 banana nanica; 458 leite/leite integral; 471 café/cafe preto; 377 patinho grelhado/bife de patinho; 109 cenoura; 100 brócolis/brocolis; 7 aveia; 163 abacate/avocado; 260 azeite. Regra: cada alias é texto de busca, não dado nutricional.
- [ ] **Step 4: Escrever `0084_food_aliases.sql`**: criar tabela, índices e RLS conforme Interfaces; carregar os aliases com um `INSERT … SELECT` que junta uma lista `VALUES (taco_name, alias)` com `foods` por `source = 'taco' AND name` (gerada a partir do JSON + `taco-4ed.json`; normalizar `alias_normalized` como em Global Constraints); terminar com um `DO $$` que lança exceção se o número de linhas inseridas for diferente do total de aliases do JSON (pega nome de TACO errado).
- [ ] **Step 5: Rodar o smoke test.** Expected: todas as linhas `PASS`.
- [ ] **Step 6: Commit** — `feat(foods): tabela food_aliases com aliases iniciais da TACO`.

---

### Task 2: RPC `fitbrother_foods_autocomplete`

**Files:**
- Create: `supabase/migrations/0085_foods_autocomplete.sql`
- Test: `supabase/tests/0085_foods_autocomplete.sql`

**Interfaces:**
- Consumes: `foods`, `food_aliases` (Task 1), `meal_items`, `meals`.
- Produces: `public.fitbrother_foods_autocomplete(p_query text, p_limit int DEFAULT 8)` `SECURITY INVOKER`, `STABLE`, `GRANT EXECUTE TO authenticated`. `p_query` já normalizado. Retorna `(kind text, food_id uuid, name text, serving_label text, serving_grams numeric, kcal_per_100g numeric, protein_per_100g numeric, carbs_per_100g numeric, fat_per_100g numeric, quantity numeric, unit unit, kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, score numeric)`. `kind = 'catalog'`: campos de último uso (`quantity`…`fat_g`) nulos. `kind = 'recent'`: `quantity/unit/kcal/protein_g/carbs_g/fat_g` do último uso do grupo; campos `*_per_100g`, `serving_*` preenchidos só se `food_id` não é nulo.

Regras de comportamento (decididas no spec): `''` → só recentes; 1 caractere → vazio; 2 → só prefixo (início do nome/alias ou início de qualquer palavra); 3+ → prefixo primeiro, depois `similarity ≥ 0.3`; `score` = 3 início do nome, 2 início de palavra, `similarity` caso contrário, +0.5 para recente; desempate por nome mais curto; recente com `food_id` suprime a linha de catálogo do mesmo `food_id`; recentes agrupados por `food_id` (ou, sem `food_id`, por descrição normalizada + `unit`), pegando o uso mais recente de cada grupo; `%`, `_`, `\` do termo são escapados no `LIKE`.

- [ ] **Step 1: Escrever o smoke test** `0085_foods_autocomplete.sql`, criando dois usuários e refeições/itens de teste (ver como `0080` cria usuários e usa `set_config('request.jwt.claims', …)` + `SET LOCAL ROLE authenticated`). Casos, cada um com `PASS`: (a) `'a'` retorna 0 linhas; (b) `''` retorna só `kind='recent'`; (c) `'ar'` retorna só prefixo (inclui "Arroz, tipo 1, cozido", não inclui nome só similar); (d) `'arroz branco'` acha "Arroz, tipo 1, cozido" via alias; (e) `'feijao'` acha "Feijão, carioca, cozido" (acento); (f) item recente com `food_id` aparece como `recent` e a linha `catalog` do mesmo alimento não aparece; (g) item de outro usuário não aparece (isolamento); (h) item com `deleted_at` preenchido não aparece; (i) `'100%'` não retorna todo o catálogo (curinga escapado); (j) `'ovo'` retorna nome curto antes de nome longo; (k) mesmo `food_id` usado duas vezes → um só recente, com a quantidade do uso mais novo.
- [ ] **Step 2: Rodar e ver falhar.** Run: `psql "$DB_URL" -f supabase/tests/0085_foods_autocomplete.sql`. Expected: `function public.fitbrother_foods_autocomplete(text, integer) does not exist`.
- [ ] **Step 3: Implementar `0085_foods_autocomplete.sql`** conforme Interfaces e regras acima. Abordagem: CTE `catalog_hits` (nome e alias, `max(score)` por `food_id`), CTE `recent_groups` (`DISTINCT ON` do grupo ordenado por `consumed_at DESC`), `UNION ALL`, `ORDER BY score DESC, length(name) ASC`, `LIMIT p_limit`. Escape do termo: `replace(replace(replace(p, '\', '\\'), '%', '\%'), '_', '\_')` com `LIKE … ESCAPE '\'`. Descrição normalizada de `meal_items` com `lower(unaccent(...))` removendo vírgulas e colapsando espaços.
- [ ] **Step 4: Rodar o smoke test.** Expected: todas as linhas `PASS`.
- [ ] **Step 5: Medir.** Com o catálogo completo, `EXPLAIN ANALYZE SELECT * FROM fitbrother_foods_autocomplete('arr')` e com `'arroz branco cozido'`. Registrar o tempo no corpo do commit; se passar de ~50 ms, trocar o subselect de RLS de `food_aliases` conforme a decisão 5 do spec.
- [ ] **Step 6: Commit** — `feat(foods): RPC de autocomplete com catálogo, aliases e recentes`.

---

### Task 3: `quantityInGrams` e escala de macros em `packages/shared`

**Files:**
- Create: `packages/shared/src/food-macros.ts`
- Modify: `packages/shared/src/index.ts` (export)
- Modify: `apps/server/src/services/meals.ts:147-163` (usar a função compartilhada)
- Test: `packages/shared/src/food-macros.test.ts`

**Interfaces:**
- Produces:
  - `type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number }`
  - `type FoodPer100g = { kcal_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; serving_grams: number | null }`
  - `quantityInGrams(quantity: number, unit: Unit, servingGrams: number | null): number | null`
  - `macrosForQuantity(food: FoodPer100g, quantity: number, unit: Unit): Macros | null` (nulo quando `quantityInGrams` é nulo; arredonda a 2 casas)
  - `scaleMacros(anchor: Macros, fromQuantity: number, toQuantity: number): Macros` (proporcional, 2 casas; `fromQuantity <= 0` devolve `anchor`)

- [ ] **Step 1: Escrever `food-macros.test.ts`** (vitest) com estes casos: `quantityInGrams(150, "g", null) === 150`; `quantityInGrams(200, "ml", null) === 200`; `quantityInGrams(2, "unit", 50) === 100`; `quantityInGrams(2, "unit", null) === null`; `quantityInGrams(1, "cup", 100) === null` (e o mesmo para `slice`, `tbsp`, `tsp`); `macrosForQuantity` de arroz (128 kcal, 2.5 P, 28.1 C, 0.2 G por 100 g) com 150 g → `{ kcal: 192, protein_g: 3.75, carbs_g: 42.15, fat_g: 0.3 }`; `macrosForQuantity(…, 1, "cup")` → `null`; `scaleMacros({kcal:100,…}, 1, 2.5).kcal === 250`; `scaleMacros(a, 0, 3)` devolve `a`.
- [ ] **Step 2: Rodar.** Run: `npm test -w @fitbrother/shared -- food-macros`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar `food-macros.ts`** com as assinaturas de Interfaces; exportar em `index.ts`.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Trocar a função privada `quantityInGrams` de `apps/server/src/services/meals.ts`** pela compartilhada (mesmo comportamento; o resto do arquivo não muda). Run: `npm test -w @fitbrother/server` e `npm run typecheck`. Expected: PASS, sem erros de tipo.
- [ ] **Step 6: Commit** — `refactor(shared): move quantityInGrams para packages/shared e adiciona escala de macros`.

---

### Task 4: Servidor — `GET /foods/search` e `food_id` no PATCH

**Files:**
- Modify: `packages/shared/src/schemas.ts` (adicionar `FoodSuggestionSchema`, `FoodSearchResponseSchema`; `food_id` em `PatchMealItemSchema`)
- Create: `apps/server/src/routes/foods.ts`
- Create: `apps/server/src/services/food-search.ts`
- Modify: `apps/server/src/app.ts` (registrar `foodsRoutes` junto de `usersRoutes`)
- Modify: `apps/server/src/routes/meals.ts:624-634` (gravar `food_id` no insert de itens do PATCH)
- Test: `apps/server/src/services/food-search.test.ts`, `apps/server/src/routes/meals.test.ts`

**Interfaces:**
- Produces (shared): `FoodSuggestionSchema` = `{ kind: 'catalog'|'recent', food_id: uuid|null, name, serving_label: string|null, serving_grams: number|null, kcal_per_100g|protein_per_100g|carbs_per_100g|fat_per_100g: number|null, quantity: number|null, unit: Unit|null, kcal|protein_g|carbs_g|fat_g: number|null }`; `FoodSearchResponseSchema = { suggestions: FoodSuggestion[] }`; `PatchMealItemSchema.food_id: UuidSchema.nullable().optional()`.
- Produces (server): `normalizeFoodQuery(input: string): string` e `searchFoods(client: SupabaseClient, rawQuery: string, limit?: number): Promise<FoodSuggestion[]>` em `services/food-search.ts`; rota `GET /foods/search?q=` (`authRequired`, `q` opcional, `trim`, máx. 60 caracteres; ausente/vazio vale como `''`), resposta `{ suggestions }`.
- Produces (PATCH): `buildPatchItemRows(mealId: string, items: PatchMealRequest["items"]): Array<…>` extraída do insert atual em `routes/meals.ts`, incluindo `food_id: it.food_id ?? null`.

- [ ] **Step 1: Escrever os testes (vitest).** `food-search.test.ts`: `normalizeFoodQuery("  FEIJÃO  ") === "feijao"`; `normalizeFoodQuery("Arroz, Branco") === "arroz branco"`; `searchFoods` com cliente fake chama `rpc("fitbrother_foods_autocomplete", { p_query: "feijao", p_limit: 8 })` e devolve as linhas já validadas pelo schema; erro da RPC vira `throw new Error("foods_autocomplete_failed: …")`. `meals.test.ts`: `buildPatchItemRows("m1", [{ id: "…", description: "arroz", quantity: 1, unit: "unit", kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, food_id: "f1" }])[0].food_id === "f1"` e, sem `food_id`, `=== null`.
- [ ] **Step 2: Rodar.** Run: `npm test -w @fitbrother/server -- food-search meals`. Expected: FAIL.
- [ ] **Step 3: Implementar** schemas, `services/food-search.ts`, rota e `buildPatchItemRows` (exportada de `routes/meals.ts`, ao lado de `buildMealPatch`), usando-a no PATCH. A rota usa `supabaseForRequest(req)` para que `auth.uid()` na RPC seja o usuário.
- [ ] **Step 4: Rodar.** Expected: PASS; `npm run typecheck` sem erros.
- [ ] **Step 5: Commit** — `feat(server): rota /foods/search e food_id nos itens do PATCH de refeição`.

---

### Task 5: Mobile — API, hook e reducer do item

**Files:**
- Create: `apps/mobile/lib/api/foods.ts`
- Create: `apps/mobile/lib/hooks/useFoodSuggestions.ts`
- Create: `apps/mobile/lib/meal-item-draft.ts`
- Test: `apps/mobile/lib/meal-item-draft.test.ts`

**Interfaces:**
- Consumes: `FoodSearchResponseSchema`, `FoodSuggestion` (Task 4); `macrosForQuantity`, `scaleMacros`, `Macros`, `FoodPer100g` (Task 3); `authedFetch`.
- Produces:
  - `searchFoods(q: string): Promise<FoodSuggestion[]>` em `lib/api/foods.ts` (`GET /foods/search?q=`).
  - `useFoodSuggestions(q: string, enabled: boolean)`: debounce 250 ms via `useDebouncedValue`, `queryKey: ["food-suggestions", trimmed]`, `staleTime: 30_000`, habilitado quando `enabled` e (`trimmed === ""` ou `trimmed.length >= 2`).
  - Em `meal-item-draft.ts`: `type ItemDraft = { id?: string; description: string; quantity: number; unit: Unit; kcal; protein_g; carbs_g; fat_g: number; food_id: string | null; link: ItemLink; adjusted: boolean }` com `type ItemLink = { mode: "none" } | { mode: "food"; food: FoodPer100g } | { mode: "anchor"; quantity: number; unit: Unit; macros: Macros }`; funções puras `applySuggestion(draft: ItemDraft, s: FoodSuggestion): ItemDraft`, `changeQuantity(draft: ItemDraft, quantity: number): ItemDraft`, `changeUnit(draft: ItemDraft, unit: Unit): ItemDraft`, `changeMacro(draft: ItemDraft, patch: Partial<Macros>): ItemDraft`, `changeDescription(draft: ItemDraft, description: string): ItemDraft`, `resetToCatalog(draft: ItemDraft): ItemDraft`, `draftFromSavedItem(it: MealResponse["items"][number]): ItemDraft`, `toPatchItem(d: ItemDraft): PatchMealRequest["items"][number]`.

Regras (spec): item salvo abre com `link: none`, `food_id` preservado, `adjusted: false`; `applySuggestion` de catálogo usa `1 unit` se `serving_grams`, senão `100 g`, e calcula macros; de recente com `food_id` usa modo `food` mantendo quantidade/unidade do último uso (macros recalculados se a unidade converte, senão os do último uso); de recente sem `food_id` usa modo `anchor`; `changeQuantity`: modo `food` e `!adjusted` → `macrosForQuantity` (se nulo mantém macros); modo `anchor` e `!adjusted` → `scaleMacros` só se a unidade é a da âncora; `changeUnit`: modo `food` e `!adjusted` → recalcula se converte; modo `anchor` → mantém macros; `changeMacro` → `adjusted = true`; `changeDescription` → `link: none` e `food_id: null`, macros mantidos; `resetToCatalog` → recalcula e `adjusted = false` (só em modo `food`).

- [ ] **Step 1: Escrever `meal-item-draft.test.ts` (jest)** com estes casos: `draftFromSavedItem` preserva `food_id` e deixa `link.mode === "none"`; `toPatchItem(draftFromSavedItem(x)).food_id === x.food_id` (editar só a quantidade de item salvo não perde o vínculo); `applySuggestion` de catálogo de arroz (serving 25 g) → `quantity 1`, `unit "unit"`, `kcal 32`; sem `serving_grams` → `100 g` e `kcal 128`; `changeQuantity` de 1 para 4 em modo `food` → `kcal 128`; digitar `kcal` e depois `changeQuantity` mantém o `kcal` digitado (`adjusted`); `resetToCatalog` volta a calcular; `changeDescription` zera `food_id` e preserva macros; recente sem `food_id` (2 un = 300 kcal) → `changeQuantity(…, 4)` dá 600 e `changeUnit(…, "g")` mantém 300; unidade sem conversão (`cup`) em modo `food` mantém macros; texto livre (nenhuma sugestão escolhida) → `toPatchItem(...).food_id === null` com macros digitados intactos.
- [ ] **Step 2: Rodar.** Run: `npm test -w @fitbrother/mobile -- meal-item-draft`. Expected: FAIL.
- [ ] **Step 3: Implementar** `lib/api/foods.ts`, `useFoodSuggestions.ts` (padrão de `useUserSearch.ts`) e `meal-item-draft.ts` com as assinaturas acima. `toPatchItem` omite campos só-cliente (`link`, `adjusted`).
- [ ] **Step 4: Rodar.** Expected: PASS; `npm run typecheck` sem erros.
- [ ] **Step 5: Commit** — `feat(mobile): estado puro do item de refeição e hook de sugestões de alimentos`.

---

### Task 6: Mobile — `FoodAutocomplete` na edição

**Files:**
- Create: `apps/mobile/components/domain/FoodAutocomplete.tsx`
- Create: `apps/mobile/components/domain/FoodSuggestionsSkeleton.tsx`
- Modify: `apps/mobile/components/domain/EditMealModal.tsx` (tipo `ItemDraft` e reducer passam a vir de `lib/meal-item-draft.ts`; `ItemEditor` troca o `TextInput` de descrição por `FoodAutocomplete`; `handleSave` usa `toPatchItem`; chip "Ajustado")
- Test: `apps/mobile/components/domain/FoodAutocomplete.test.tsx`

**Interfaces:**
- Consumes: `ItemDraft`, `applySuggestion`, `changeQuantity`, `changeUnit`, `changeMacro`, `changeDescription`, `resetToCatalog`, `draftFromSavedItem`, `toPatchItem` (Task 5); `useFoodSuggestions`.
- Produces: `FoodAutocomplete` com props `{ value: string; onChangeText: (t: string) => void; onSelect: (s: FoodSuggestion) => void }`. Lista aparece com campo focado; linhas mostram nome, porção e kcal (recentes com marcador "Recente" e ícone `History` de `lucide-react-native`); loading = `FoodSuggestionsSkeleton` (3 linhas); sem resultado → lista some; cada linha com `accessibilityRole="button"`, `accessibilityLabel` com o nome e hit target 44×44; números com `tabular-nums`; `maxLength={60}` mantido.

Em `EditMealModal`: `reducer` passa a aplicar as funções puras da Task 5 (ações `select_suggestion`, `change_quantity`, `change_unit`, `change_macro`, `change_description`, `reset_catalog` além das existentes); `NumberInput` de macros chama `change_macro`; chip "Ajustado" (`font-sans-medium`, token `warning`) com botão "Voltar ao catálogo" visível só quando `adjusted && link.mode === "food"`; dica curta "Sem conversão para esta unidade" quando `link.mode !== "none"` e a unidade não converte.

- [ ] **Step 1: Escrever `FoodAutocomplete.test.tsx` (jest-expo + Testing Library, estilo de `MealComposer.test.tsx`)**, mockando `@/lib/hooks/useFoodSuggestions`: (a) campo focado e vazio mostra recentes; (b) digitar "arr" mostra "Arroz, tipo 1, cozido"; (c) tocar numa sugestão chama `onSelect` com ela; (d) sem sugestões a lista não aparece e o texto digitado permanece; (e) enquanto carrega aparece o skeleton e não há `ActivityIndicator`.
- [ ] **Step 2: Rodar.** Run: `npm test -w @fitbrother/mobile -- FoodAutocomplete`. Expected: FAIL.
- [ ] **Step 3: Implementar** `FoodSuggestionsSkeleton.tsx` (composto de `SkeletonBlock`, espelhando o shape de 3 linhas) e `FoodAutocomplete.tsx`.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Integrar em `EditMealModal.tsx`** conforme "Em `EditMealModal`" acima. Garantir que `PatchMealItemSchema.safeParse` continua rodando sobre `toPatchItem(it)`.
- [ ] **Step 6: Verificar tudo.** Run: `npm run typecheck && npm run lint && npm test`. Expected: tudo passa. Abrir a tela de edição no app (iOS e web) e conferir à mão: digitar "arroz", escolher, mudar quantidade (macros mudam), editar um macro (aparece "Ajustado"), "Voltar ao catálogo", salvar e reabrir (o item continua com `food_id`).
- [ ] **Step 7: Commit** — `feat(mobile): autocomplete de alimentos com recálculo de macros na edição de refeição`.

---

### Task 7: Documentação

**Files:**
- Modify: `FEATURES.md` (§3: tabela `food_aliases`; RPC de autocomplete; rota `GET /foods/search`)
- Modify: `docs/PLAN.md` (status do autocomplete)

- [ ] **Step 1: Atualizar `FEATURES.md` e `docs/PLAN.md`** com o que foi entregue (nomes exatos das migrations `0084`/`0085`, rota e componente). CLAUDE.md não muda (só a pedido).
- [ ] **Step 2: Commit** — `docs: registra autocomplete de alimentos em FEATURES e PLAN`.
