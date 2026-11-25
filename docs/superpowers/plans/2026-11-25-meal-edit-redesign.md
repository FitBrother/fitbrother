# Edição de refeição: lista + sheet por item — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`. Passos usam checkbox (`- [ ]`).

**Goal:** Trocar a tela de edição de refeição (formulário aberto por item) por uma lista limpa com total fixo, stepper de quantidade na linha e um sheet por item.

**Architecture:** O reducer e as funções puras de `lib/meal-item-draft.ts` continuam como fonte de estado. A UI é recomposta em componentes pequenos de `components/domain/` (resumo, linha, sheet, chips de meta). O sheet é um `Modal` do RN (padrão do app: `TimePicker`, `MealComposer`), sem dependência nova.

**Tech Stack:** React Native + Expo Router, NativeWind v4, lucide-react-native, jest-expo + @testing-library/react-native, `@fitbrother/shared`.

**Spec:** `docs/superpowers/specs/2026-11-25-meal-edit-redesign-design.md`

## Global Constraints

- Regras de ouro de UI do `CLAUDE.md`: fontes só `font-sans-*`/`font-display-*` (nunca `font-medium|semibold|bold`); números com `style={{ fontVariant: ["tabular-nums"] }}`; cores só por token (`lib/colors.ts` para ícones/SVG, nunca hex em JSX); alvos de toque ≥ 44×44 pt; `accessibilityLabel` em botões só-ícone e `accessibilityRole` nos interativos; sombras via `shadows` de `lib/shadows.ts`; sem `dark:`; ícones só `lucide-react-native`; sem tags HTML; sem `ActivityIndicator` fora de botão.
- Tokens do mockup: card = `Card variant="elevated"` (`rounded-[26px]`, `shadows.card`); chip de delta `bg-primary-50` + texto `text-primary-700`; selo "Ajustado" `bg-warning-50` + `text-warning-700`; texto de ação verde = `text-primary-700` (nunca `primary-400` sobre branco); erro de linha = `border border-danger-500`.
- Sheet = DESIGN_SYSTEM §12.8: handle 36×4 `bg-neutral-300`, backdrop `bg-black/40`, container `rounded-t-[26px] bg-white`, sombra via `shadows`.
- Comentários de código: só quando estritamente necessário, 1 linha, em inglês. Commits em Conventional Commits em inglês, sem trailer de agente. Textos da UI em pt-BR.
- Sem dependência nova. Sem mudança de schema/migration/servidor (o `PATCH /meals/:id` já aceita `meal_type` e `consumed_at`).
- Passo de quantidade por unidade: `g`/`ml` 10, `cup` 0,5, `unit`/`slice`/`tbsp`/`tsp` 1.

## Review Focus

- Quantidade nunca vai a zero/negativa pelo stepper; o − desabilita em `quantidade − passo <= 0`.
- Quantidade digitada vazia ou `0` no sheet: não quebra a tela; o salvar já marca o item com erro (schema `quantity` positivo).
- Item salvo agora escala macros com a quantidade; editar um macro à mão para o escalonamento e mostra "Ajustado".
- Item vinculado ao catálogo numa unidade sem conversão (`cup`, `slice`…): quantidade muda, macros não, e o sheet avisa "Sem conversão para esta unidade".
- Fechar o sheet de item novo sem nome remove o item; remover todos os itens continua caindo no fluxo de excluir a refeição.
- Mudar o horário para antes de `day_start_hour` troca o dia nutricional: invalida também as queries do novo dia.
- Nome longo do alimento não empurra o stepper para fora da linha (ellipsis).
- Teclado aberto no sheet não cobre o campo focado (KeyboardAvoidingView dentro do Modal).

---

### Task 1: Lógica pura de quantidade e item salvo escalável

**Files:**
- Create: `apps/mobile/lib/quantity-step.ts`, `apps/mobile/lib/quantity-step.test.ts`
- Modify: `apps/mobile/lib/meal-item-draft.ts`, `apps/mobile/lib/meal-item-draft.test.ts`
- Modify: `apps/mobile/lib/hooks/useUpdateMeal.ts` (+ teste se já existir, senão `useUpdateMeal.test.ts`)

**Interfaces:**
- Produces:
  - `quantityStep(unit: Unit): number`
  - `stepQuantity(quantity: number, unit: Unit, direction: 1 | -1): number` (arredonda a 2 casas; em `-1` devolve a própria `quantity` se o resultado seria `<= 0`)
  - `canDecreaseQuantity(quantity: number, unit: Unit): boolean`
  - `quickAmounts(unit: Unit, current: number): number[]` (regras do spec: base por unidade + `current` se faltar, ordenado, máx. 5)
  - `draftFromSavedItem` passa a devolver `link: { mode: "anchor", quantity, unit, macros }` com os macros e a quantidade salvos (antes `{ mode: "none" }`).
  - `useUpdateMeal(mealId: string, day: string, newDay?: string)`: quando `newDay` existe e é diferente de `day`, também invalida `mealsForDayKey(newDay)` e `dailySummaryKey(newDay)`.

- [ ] **Step 1: testes de `quantity-step`.** `stepQuantity(150,"g",1)===160`; `stepQuantity(10,"g",-1)===10` (não vai a zero); `stepQuantity(0.5,"cup",-1)===0.5`; `stepQuantity(1,"unit",-1)===1`; `stepQuantity(1,"cup",1)===1.5`; `canDecreaseQuantity(10,"g")===false`, `canDecreaseQuantity(20,"g")===true`; `quickAmounts("g",120)` = `[50,100,120,150,200]`; `quickAmounts("g",100)` = `[50,100,150,200]`; `quickAmounts("cup",1)` = `[0.5,1,1.5,2]`; `quickAmounts("unit",2)` = `[1,2,3,4]`.
- [ ] **Step 2: rodar e ver falhar.** `npm test -w apps/mobile -- quantity-step`.
- [ ] **Step 3: implementar `lib/quantity-step.ts`** com as assinaturas acima.
- [ ] **Step 4: teste em `meal-item-draft.test.ts`:** `draftFromSavedItem` com item de 100 g/128 kcal → `changeQuantity(draft, 150)` devolve 192 kcal (escala), e `changeUnit` para `cup` mantém os macros; depois de `changeMacro` (`adjusted`), `changeQuantity` não escala mais. Ajustar qualquer teste existente que assumia `link: none` em item salvo.
- [ ] **Step 5: alterar `draftFromSavedItem`** para o link `anchor` (macros e quantidade do item salvo). Conferir que `changeDescription` continua desvinculando (`link: none`, `food_id: null`).
- [ ] **Step 6: `useUpdateMeal` com `newDay`** e teste: com `newDay` diferente invalida as chaves dos dois dias; sem `newDay` ou igual, só as do dia original.
- [ ] **Step 7: rodar** `npm test -w apps/mobile -- quantity-step meal-item-draft useUpdateMeal` e `npm run typecheck -w apps/mobile`. Tudo verde.
- [ ] **Step 8: commit** `feat(mobile): add quantity stepping and proportional saved items`.

---

### Task 2: Resumo fixo e linha de item com stepper

**Files:**
- Create: `apps/mobile/components/domain/MealSummaryCard.tsx` (+ `.test.tsx`)
- Create: `apps/mobile/components/domain/MealItemRow.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `Card` (`components/Card.tsx`), `MacroSplitBar` (`components/domain/MacroSplitBar.tsx`), `UNIT_LABEL`, `stepQuantity`, `canDecreaseQuantity`, `ItemDraft`.
- Produces:
  - `MealSummaryCard({ totals: Macros, deltaKcal: number })`: kcal grande em `font-display-bold`, chip `+32 kcal`/`−12 kcal` (sinal `−` U+2212; some quando `Math.round(deltaKcal) === 0`), `MacroSplitBar` com os gramas. `accessibilityLabel` com kcal e delta.
  - `MealItemRow({ item: ItemDraft, hasError: boolean, onOpen: () => void, onStep: (direction: 1 | -1) => void })`: card com nome + ícone lápis (botão que chama `onOpen`, `accessibilityLabel="Editar <nome>"`), linha `<kcal> kcal` + selo "Ajustado" quando `item.adjusted && item.link.mode !== "none"`, e à direita o stepper `−  150 g  +` (botões 44×44, `accessibilityLabel` "Diminuir quantidade"/"Aumentar quantidade", − `disabled` quando `!canDecreaseQuantity`). Quantidade formatada com `UNIT_LABEL` (`150 g`, `1 un`). Nome com `numberOfLines={1}`. `hasError` → `border border-danger-500`.

- [ ] **Step 1: testes de `MealSummaryCard`:** mostra `459` e `kcal`; delta 32 → texto `+32 kcal`; delta −12.4 → `−12 kcal`; delta 0 e 0.3 → sem chip.
- [ ] **Step 2: testes de `MealItemRow`:** toque no nome chama `onOpen`; toque em + chama `onStep(1)`; − chama `onStep(-1)`; com `quantity=10, unit="g"` o − está desabilitado; selo "Ajustado" aparece só com `adjusted && link.mode !== "none"`; `hasError` aplica a borda (checar via `testID="meal-item-row"` + estilo/classe, no padrão de testes do repo).
- [ ] **Step 3: rodar e ver falhar.**
- [ ] **Step 4: implementar os dois componentes** seguindo as Global Constraints.
- [ ] **Step 5: rodar** os testes dos dois + typecheck + lint do pacote.
- [ ] **Step 6: commit** `feat(mobile): add meal summary card and item row with quantity stepper`.

---

### Task 3: Sheet do item

**Files:**
- Create: `apps/mobile/components/domain/MealItemSheet.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `FoodAutocomplete` (inalterado), `ItemDraft`, `quantityStep`/`stepQuantity`/`canDecreaseQuantity`/`quickAmounts`, `UNIT_OPTIONS`/`UNIT_LABEL`, `macrosForQuantity`, `shadows`.
- Produces: `MealItemSheet(props)` com
  `visible: boolean; item: ItemDraft | null; onClose: () => void; onRemove: () => void; onSelectSuggestion: (s: FoodSuggestion) => void; onChangeDescription: (t: string) => void; onChangeQuantity: (q: number) => void; onChangeUnit: (u: Unit) => void; onChangeMacro: (patch: Partial<Macros>) => void; onResetCatalog: () => void`.
  Conteúdo: handle + `FoodAutocomplete` (com selo "TACO" ao lado quando `link.mode === "food"`); quantidade grande (`font-display-bold`, ~44 px) com botões redondos − / + (56×56) e campo numérico editável (aceita vírgula); atalhos `quickAmounts` (o atual `aria-pressed`); unidades de `UNIT_OPTIONS` como segmented control (rolável na horizontal se não couber); bloco de macros: kcal grande + P/C/G com bolinhas de cor de macro, rótulo conforme o estado (`food` → "Calculado pelo catálogo"; `anchor` não ajustado → "Proporcional ao registro original"; `adjusted` → "Ajustado manualmente"; `none` → "Informe os macros"); switch "Ajustar macros manualmente" (`accessibilityRole="switch"`) que mostra 4 campos numéricos (kcal, P, C, G) ligados a `onChangeMacro`; para `link.mode === "none"` os campos ficam sempre visíveis e o switch não aparece; botão "Voltar ao catálogo" quando `adjusted && link.mode === "food"`; aviso "Sem conversão para esta unidade" quando há link e a unidade não converte (mesma regra de `unitConverts` do `EditMealModal` atual: mover a função para um módulo compartilhado se necessário); rodapé com lixeira "Remover item" e `Button` primário "Concluir item" (`onClose`). `Modal` transparente com `animationType="slide"`, backdrop que fecha (`onClose`), `onRequestClose={onClose}` e `KeyboardAvoidingView`.

- [ ] **Step 1: testes (`render` com `visible`):** mostra nome e quantidade; toque em + chama `onChangeQuantity(item.quantity + passo)`; − desabilitado no mínimo; atalho 100 chama `onChangeQuantity(100)`; trocar unidade chama `onChangeUnit`; com `link.mode === "food"` aparece o selo TACO e "Calculado pelo catálogo"; com `adjusted` aparece "Voltar ao catálogo" e ele chama `onResetCatalog`; switch liga e mostra os 4 campos, editar kcal chama `onChangeMacro({ kcal })`; `link.mode === "none"` mostra os campos sem switch; "Concluir item" e backdrop chamam `onClose`; lixeira chama `onRemove`; quantidade vazia no campo chama `onChangeQuantity(0)` sem lançar.
- [ ] **Step 2: rodar e ver falhar.**
- [ ] **Step 3: implementar `MealItemSheet`** (e extrair `unitConverts` para `lib/meal-item-draft.ts` como export, com teste curto, se for preciso para não duplicar).
- [ ] **Step 4: rodar** testes + typecheck + lint.
- [ ] **Step 5: commit** `feat(mobile): add item edit sheet for meal editing`.

---

### Task 4: Chips de tipo e horário da refeição

**Files:**
- Create: `apps/mobile/lib/meal-meta.ts` (+ `.test.ts`)
- Create: `apps/mobile/components/domain/MealMetaChips.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `MEAL_TYPE_NAME` (exportado de `MealCard.tsx`), `TimePicker` (`components/domain/TimePicker.tsx`), `MealResponse["meal_type"]`.
- Produces:
  - `withTime(consumedAtIso: string, hour: number, minute: number): string` — ISO UTC do mesmo dia local com hora/minuto trocados (segundos e ms zerados).
  - `MEAL_TYPE_OPTIONS: MealResponse["meal_type"][]` na ordem `breakfast, lunch, snack, dinner, other`.
  - `MealMetaChips({ mealType, consumedAt, onChangeMealType, onChangeTime }: { mealType: MealResponse["meal_type"]; consumedAt: string; onChangeMealType: (t: MealResponse["meal_type"]) => void; onChangeTime: (iso: string) => void })`: dois chips (ícone `Utensils`/`Clock` + texto + `ChevronDown`, altura 44). O chip de tipo abre um `Modal` com a lista de `MEAL_TYPE_OPTIONS` (nome via `MEAL_TYPE_NAME`, item selecionado em `font-sans-semibold text-primary-700`); o de horário abre o `TimePicker` e, ao confirmar, chama `onChangeTime(withTime(consumedAt, h, m))`. Horário exibido em `HH:mm` local com tabular-nums.

- [ ] **Step 1: testes de `withTime`:** troca hora/minuto mantendo o dia local (usar `new Date(y, m, d, h, min)` para montar o esperado, sem depender do fuso da máquina); zera segundos.
- [ ] **Step 2: testes de `MealMetaChips`:** mostra "Almoço" e `12:40` para um `consumedAt` local de 12:40; escolher "Jantar" na lista chama `onChangeMealType("dinner")`; confirmar o `TimePicker` chama `onChangeTime` com a ISO esperada (mockar `TimePicker` se for mais simples, como o repo já faz em outros testes).
- [ ] **Step 3: rodar e ver falhar.**
- [ ] **Step 4: implementar.**
- [ ] **Step 5: rodar** testes + typecheck + lint.
- [ ] **Step 6: commit** `feat(mobile): add meal type and time chips for meal editing`.

---

### Task 5: Recompor `EditMealModal`, skeleton e docs

**Files:**
- Modify: `apps/mobile/components/domain/EditMealModal.tsx`, `apps/mobile/components/domain/EditMealModal.test.tsx`
- Modify: `apps/mobile/components/domain/MealEditSkeleton.tsx`
- Modify: `apps/mobile/app/(app)/meal/[id]/edit.tsx` (só se o `newDay` precisar de dados do perfil aqui)
- Modify: `FEATURES.md` (§4.2.1), `docs/PLAN.md` (se houver linha da entrega)

**Interfaces:**
- Consumes: tudo das Tasks 1–4, `useProfile`, `nutritionalDay` (`lib/time/nutritional-day`), `Button`, `useDialog`, `useToast`, `useUpdateMeal(mealId, day, newDay?)`, `useDeleteMeal`.
- Produces: `EditMealModal({ meal, day })` com a mesma assinatura de hoje.

Comportamento:
- Estado: o reducer atual (+ ação `open_item`/`close_item` não; o item aberto é `openIndex: number | null` em `useState`). Meta: `mealType` e `consumedAt` em `useState`, iniciados do `meal`.
- Estrutura: barra (X / título / lixeira "Excluir refeição" com `dialog.confirm` destrutivo → `remove.mutate`), `MealMetaChips`, `MealSummaryCard` fixo (`totals` somados dos itens; `deltaKcal = totals.kcal − soma inicial`), `ScrollView` com "Itens · N" + `MealItemRow` por item, botão tracejado "Buscar e adicionar alimento" (dispara `add_item` e abre o sheet no índice novo), barra inferior fixa com `Button` primário "Salvar alterações" (`loading` durante o salvar, desabilitado sem alterações). Aviso "Sem itens" mantido. `MealItemSheet` renderizado uma vez, ligado a `openIndex`.
- `onStep` do `MealItemRow` usa `stepQuantity` e despacha `change_quantity`.
- Fechar o sheet (`onClose`) de um item novo com `description.trim() === ""` despacha `remove_item`; `onRemove` do sheet despacha `remove_item` e fecha.
- Salvar: validação por item e toast idênticos ao atual; o patch inclui `meal_type` só se mudou, `consumed_at` só se mudou; `newDay = nutritionalDay(new Date(consumedAt), profile)` quando o horário mudou, passado ao `useUpdateMeal`. "Descartar alterações?" considera itens **ou** meta alterados.
- `MealEditSkeleton`: espelha o novo shape (barra, chips, card de resumo, 3 linhas de item, botão de adicionar, barra de salvar) com `SkeletonBlock`.
- Docs: reescrever em `FEATURES.md` §4.2.1 o parágrafo da tela (lista + sheet, stepper, escalonamento de item salvo, chips de tipo/horário) mantendo o resto da seção; mencionar o `Modal` como implementação do sheet.

- [ ] **Step 1: reescrever `EditMealModal.test.tsx`** (manter os mocks atuais e acrescentar o de `useProfile` se preciso). Testes: (a) salvar item intocado mantém `food_id`; (b) tocar em + no stepper de um item de 100 g/128 kcal sobe para 110 g e ~141 kcal e o resumo mostra o delta `+13 kcal`; (c) abrir o sheet pelo nome, digitar na descrição desvincula e mantém macros; (d) editar macro no sheet mostra "Ajustado" na linha; (e) selecionar sugestão no sheet vincula e a quantidade reescala os macros; (f) "Buscar e adicionar alimento" abre o sheet de um item novo, e fechar sem nome remove o item; (g) mudar o tipo para "Jantar" faz o patch levar `meal_type: "dinner"` e o patch **não** leva `consumed_at` quando o horário não mudou; (h) item com campo inválido (quantidade 0) mostra toast e não chama `mutate`; (i) remover todos os itens pede confirmação de excluir a refeição.
- [ ] **Step 2: rodar e ver falhar.**
- [ ] **Step 3: recompor `EditMealModal.tsx`** e **atualizar `MealEditSkeleton.tsx`**.
- [ ] **Step 4: atualizar `FEATURES.md` §4.2.1** (e `docs/PLAN.md` só se houver linha da entrega).
- [ ] **Step 5: rodar a suíte inteira** `npm test -w apps/mobile`, `npm run typecheck`, `npm run lint`. Tudo verde.
- [ ] **Step 6: commit** `feat(mobile): redesign meal edit screen as list with item sheet`.
