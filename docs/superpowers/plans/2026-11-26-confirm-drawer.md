# Drawer de confirmação da refeição — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`. Passos usam checkbox (`- [ ]`).

**Goal:** Trocar a tela cheia "Confirme o que entendi" por um drawer global em três visões (compacto, ajustar, item).

**Architecture:** Um primitivo `BottomDrawer` (overlay absoluto, sem `Modal` nativo) hospedado no layout `(app)` por um contexto `ConfirmMealProvider`. O conteúdo `ConfirmMealDrawer` reaproveita o reducer de rascunho (`lib/edit-meal-reducer.ts`), o montador de patch (`lib/meal-patch.ts`), `useUpdateMeal`/`useDeleteMeal`, os seletores de tipo/horário de `MealMetaChips` e o corpo do editor de item extraído de `MealItemSheet`. O backend não muda.

**Tech Stack:** React Native + Expo Router, NativeWind v4, reanimated, TanStack Query, jest-expo + testing-library.

**Spec:** `docs/superpowers/specs/2026-11-26-confirm-drawer-design.md`

## Global Constraints

- Regras de ouro de UI do `CLAUDE.md` (fontes `font-sans-*`/`font-display-*`; números com `tabular-nums`; cores por token; alvos ≥ 44 pt; `accessibilityLabel`/`accessibilityRole`; sombras via `lib/shadows.ts`; só lucide; sem `dark:`; sem tags HTML; skeleton quando carregar tela). Raios só pelos tokens (`lib/radii.test.ts` barra `rounded-[Npx]` fora do token do card de 26 px).
- Sem dependência nova. Comentários só quando necessário, 1 linha, em inglês. Commits Conventional Commits em inglês, sem trailer de agente. UI em pt-BR.
- Sem mudança de servidor/schema/migration. A confirmação continua sendo um único `PATCH /meals/:id` com `confirm: true` (+ `items`/`meal_type`/`consumed_at` só do que mudou), com a validação cliente de hoje (limites, nomes vazios), proteção de duplo toque e a guarda "resposta ainda `review_required`" (tratada como falha).
- Textos: título/rótulos exatamente como no spec e nos artboards. "Entendi isto" até 3 itens, "Entendi N itens" acima; nomes curtos = primeiro segmento antes da primeira vírgula (`"Arroz, tipo 1, cozido"` → `"Arroz"`), sem repetir.
- O drawer nunca empilha `Modal` sobre `Modal` dele mesmo; os seletores de tipo/horário (já `Modal`) abrem por cima do overlay.

## Review Focus

- Duplo toque em Confirmar envia uma vez; confirmar com edições grava e confirma ou falha inteiro; falha mantém o drawer e o rascunho.
- Fechar (fundo, voltar do Android) mantém a refeição pendente; o rascunho não editado não pede confirmação de descarte, o editado pergunta antes de fechar.
- Remover o último item ou confirmar sem itens cai no fluxo de descartar a refeição (confirmação destrutiva).
- Item novo sem nome: ao voltar da visão de item é descartado (como o `discard_draft` do editor).
- A lista rola com 12 itens e o Confirmar fica sempre visível; com o teclado aberto na visão de item nada importante fica coberto.
- Registro por texto/áudio/foto, registro retroativo (formSheet nativo), onboarding e fallback de IA do código de barras abrem o drawer certo uma vez só; `already_existed` não abre dois drawers.
- Abrir o drawer de uma refeição que já foi confirmada (outro aparelho) fecha sozinho; refeição apagada não deixa o overlay preso.
- Tocar numa refeição pendente na Home abre o drawer; numa confirmada abre o detalhe. Deep link para `meal/[id]` pendente abre o drawer sem deixar a tela vazia no histórico.
- O drawer não aparece sobre o tour nem o tour sobre o drawer de forma que bloqueie toques; o `ConfirmDialog` (Descartar) aparece acima do drawer.

---

### Task 1: Lógica pura do resumo e das visões

**Files:**
- Create: `apps/mobile/lib/confirm-drawer.ts`, `apps/mobile/lib/confirm-drawer.test.ts`

**Interfaces:**
- Produces:
  - `shortName(description: string): string` — primeiro segmento antes da primeira vírgula, aparado; vazio → `"Item"`.
  - `summarizeItems(items: { description: string }[], max = 3): { names: string[]; extra: number }` — `names` = os primeiros `max` nomes curtos únicos, na ordem em que aparecem; `extra` = quantidade de itens cujo nome curto **não** está em `names` (itens repetidos de um nome já mostrado não contam como extra).
  - `headlineText(items): string` — `"Arroz"`, `"Arroz e feijão"`, `"Arroz, feijão e frango"`, e com `extra > 0`: `"Arroz, feijão, frango e mais 9"`.
  - `drawerLabel(count: number): string` — `count <= 3` → `"Entendi isto"`, senão `` `Entendi ${count} itens` ``.
  - `DrawerView = { name: "compact" } | { name: "adjust" } | { name: "item"; index: number }`, `drawerViewReducer(view, action)` com ações `adjust`, `back`, `edit_item` (`index`), `done_item`: `adjust` leva ao ajuste; `back` do ajuste vai ao compacto; `edit_item` abre o item; `done_item`/`back` do item volta ao ajuste; `back` no compacto não muda.

- [ ] **Step 1: testes.** `shortName("Arroz, tipo 1, cozido")==="Arroz"`, `shortName("Feijão carioca")==="Feijão carioca"`, `shortName("")==="Item"`, `shortName("  , x")==="Item"`; `headlineText` com 1, 2, 3 e 12 itens (`"Arroz, feijão, frango e mais 9"`), nomes repetidos ("Arroz, tipo 1" + "Arroz, integral" → um só "Arroz" e `extra` 0); `drawerLabel(3)==="Entendi isto"`, `drawerLabel(4)==="Entendi 4 itens"`, `drawerLabel(12)==="Entendi 12 itens"`; transições do reducer incluindo `back` no compacto e `done_item`.
- [ ] **Step 2: rodar e ver falhar.** `npm test -w apps/mobile -- confirm-drawer`.
- [ ] **Step 3: implementar.**
- [ ] **Step 4: rodar** testes + typecheck.
- [ ] **Step 5: commit** `feat(mobile): add confirm drawer summary and view helpers`.

---

### Task 2: Extrair o corpo do editor de item

**Files:**
- Create: `apps/mobile/components/domain/ItemEditorBody.tsx`
- Modify: `apps/mobile/components/domain/MealItemSheet.tsx` (+ testes existentes)

**Interfaces:**
- Produces: `ItemEditorBody(props)` com o conteúdo que hoje é o `SheetBody` interno de `MealItemSheet` (campo do alimento com `FoodAutocomplete` e selo TACO, quantidade com − / +, atalhos, unidades, bloco de macros e switch, rodapé com lixeira e "Concluir item"), com as mesmas props que o `SheetBody` usa hoje (`item`, `onClose`, `onRemove`, `onSelectSuggestion`, `onChangeDescription`, `onChangeQuantity`, `onChangeUnit`, `onChangeMacro`, `onResetCatalog`) mais `variant?: "sheet" | "drawer"` (em `"drawer"` sem o `ScrollView` externo próprio nem SafeArea de rodapé, para caber no drawer; o rótulo do botão principal continua "Concluir item"). `MealItemSheet` passa a renderizar o `Modal` + `ItemEditorBody variant="sheet"`, sem mudança de comportamento.

- [ ] **Step 1:** garantir que os testes atuais de `MealItemSheet` passam antes (linha de base) e adicionar testes de `ItemEditorBody` (render direto, sem `Modal`): mostra nome e quantidade, +/− chama `onChangeQuantity`, "Concluir item" chama `onClose`, lixeira chama `onRemove`, no `variant="drawer"` o conteúdo renderiza sem `Modal`.
- [ ] **Step 2:** rodar e ver falhar (módulo inexistente).
- [ ] **Step 3:** extrair (mover código; sem reescrever lógica) e atualizar `MealItemSheet`.
- [ ] **Step 4:** rodar `npm test -w apps/mobile -- MealItemSheet ItemEditorBody MealEditor` + typecheck. Nenhum teste existente pode mudar de comportamento.
- [ ] **Step 5: commit** `refactor(mobile): extract the item editor body from the item sheet`.

---

### Task 3: Primitivo `BottomDrawer`

**Files:**
- Create: `apps/mobile/components/BottomDrawer.tsx`, `apps/mobile/components/BottomDrawer.test.tsx`

**Interfaces:**
- Produces: `BottomDrawer({ visible, onClose, children, accessibilityLabel, maxHeightRatio = 0.88 })`: overlay absoluto (`StyleSheet.absoluteFill`, sem `Modal` nativo) com fundo `bg-black/40` que fecha ao toque (`accessibilityLabel="Fechar"`, `accessibilityRole="button"`), painel branco `rounded-t-[26px]` encostado embaixo com alça 36×4 `bg-neutral-300`, altura = a do conteúdo até `maxHeightRatio` da altura da janela (`useWindowDimensions`), animação de subir/descer com reanimated usando as constantes de `lib/motion.ts`, `KeyboardAvoidingView` (iOS `padding`, Android `height`), padding inferior pela área segura, `accessibilityViewIsModal` e `role="dialog"` com o label. Android: `BackHandler` fecha o drawer enquanto `visible` (listener removido ao fechar/desmontar). Não renderiza nada (nem o overlay) quando `visible` é falso e a animação de saída terminou. Largura máxima 640 centralizada no web (mesmo teto das telas: `md:max-w-[640px]`). Não captura gesto de arrastar.

- [ ] **Step 1: testes:** invisível não renderiza; visível renderiza filhos e o role `dialog` com o label; toque no fundo chama `onClose`; `BackHandler` (mock) chama `onClose` quando visível e não quando invisível, e o listener é removido ao fechar; o painel tem teto de altura proporcional à janela (assert pelo estilo com `useWindowDimensions` mockado a 800 de altura → `maxHeight` 704); filhos recebem toque.
- [ ] **Step 2:** rodar e ver falhar.
- [ ] **Step 3:** implementar (reanimated: seguir os mocks/convenções de `lib/reanimated-classname.test.ts` e dos componentes animados existentes do repo).
- [ ] **Step 4:** rodar testes + typecheck.
- [ ] **Step 5: commit** `feat(mobile): add the bottom drawer primitive`.

---

### Task 4: `ConfirmMealDrawer` (conteúdo)

**Files:**
- Create: `apps/mobile/components/domain/ConfirmMealDrawer.tsx` (+ partes como `ConfirmCompactView.tsx`, `ConfirmAdjustView.tsx`, `DrawerItemRow.tsx` e `MealMetaLine.tsx` se o tamanho pedir; 1 teste por componente), `apps/mobile/components/domain/ConfirmMealDrawer.test.tsx`
- Modify: `apps/mobile/components/domain/MealMetaChips.tsx` (expor o seletor de tipo e o fluxo do horário como peças reutilizáveis sem mudar o comportamento dos chips), `apps/mobile/components/domain/MealSourceCard.tsx` (exportar `MealPhotoThumb`)

**Interfaces:**
- Consumes: Task 1 (`headlineText`, `drawerLabel`, `drawerViewReducer`), Task 2 (`ItemEditorBody`), `editMealReducer`, `buildMealPatch`/`invalidItemIndexes`, `useUpdateMeal`, `useDeleteMeal`, `useDialog`, `useToast`, `draftFromSavedItem`, `stepQuantity`/`canDecreaseQuantity`, `MealPhotoThumb`.
- Produces: `ConfirmMealDrawer({ meal: MealResponse; onClose: () => void })` com as três visões do spec dentro de um `BottomDrawer` **fornecido pelo host** (o componente rende só o conteúdo; o host envolve no `BottomDrawer`). Comportamento: rascunho local iniciado da refeição; **Confirmar** (uma única `PATCH` com `confirm: true` pelo mesmo caminho de patch do editor: itens só se mudaram, meta só se mudou), validação antes de enviar com toast `Item(ns) N com campos inválidos` e marcação da linha, trava de duplo toque (ref + `loading`), edição bloqueada enquanto envia, sucesso → toast "Refeição registrada" e `onClose()`, falha → toast "Não foi possível confirmar" e drawer/rascunho mantidos, resposta com `review_required` ainda true → tratada como falha (re-inicia o rascunho com o devolvido); **Descartar** → `dialog.confirm` destrutivo (título "Descartar refeição?", descrição "Ela será excluída e não entra no seu dia.") → `useDeleteMeal` → `onClose()`; confirmar sem itens ou remover o último item → mesmo fluxo de descartar; "Ajustar" → visão de ajuste; ajuste: linhas planas com nome (abre a visão de item) e stepper, "Adicionar item" (adiciona rascunho vazio e abre a visão de item com o campo em foco), `MealMetaLine`; visão de item: `ItemEditorBody variant="drawer"` com "‹"; ao voltar de um item novo sem nome ele é descartado (`discard_draft`). Linha âmbar de confiança só com `confidence !== null && confidence < 0.6`; áudio mostra a transcrição (`raw_input`, só quando `source === "app_audio"` e não vazia, 1 linha com ícone de microfone); foto mostra `MealPhotoThumb` 72 pt (caminho por `image_path` ou fallback `raw_input` "Foto: "); texto digitado sem linha extra. Fechar com edições não confirmadas: o host chama `onRequestClose`; o conteúdo expõe `dirty` via callback `onDirtyChange(dirty: boolean)` para o host perguntar "Descartar alterações?" ao fechar.

- [ ] **Step 1: testes** (mocks como em `MealEditorPending.test.tsx`): compacto com texto (rótulo "ENTENDI ISTO" via `drawerLabel`, frase, total, "Almoço · 12:40", botões); com 12 itens (rótulo "Entendi 12 itens", frase "…e mais 9"); áudio mostra transcrição, texto não; foto mostra a miniatura/placeholder; linha âmbar só com confiança < 0,6 (0,4 / 0,59 / 0,6 / null); Ajustar mostra a lista e "‹" volta; stepper altera o total; Confirmar sem edição envia `{ confirm: true }`; com stepper envia `items` + `confirm` num único `mutate`; só tipo alterado envia `meal_type` + `confirm` sem `items`; validação bloqueia (quantidade 100000) com toast e sem `mutate`; duplo toque envia uma vez; sucesso → toast + `onClose`; falha → toast de erro e permanece; resposta ainda pendente → falha; Descartar confirma e exclui; zero itens → fluxo de descartar; item: tocar no nome abre o editor, "Concluir item" volta à lista, remover item volta; novo item sem nome é descartado ao voltar; `onDirtyChange` reflete edições; edição bloqueada durante o envio.
- [ ] **Step 2:** rodar e ver falhar.
- [ ] **Step 3:** implementar (extrair as peças de `MealMetaChips` sem alterar os testes dele).
- [ ] **Step 4:** rodar testes dos componentes tocados (`ConfirmMealDrawer MealMetaChips MealSourceCard`) + typecheck.
- [ ] **Step 5: commit** `feat(mobile): add the confirm meal drawer content`.

---

### Task 5: Host global, integração e remoção da tela cheia pendente

**Files:**
- Create: `apps/mobile/lib/confirm-meal/confirm-meal-context.tsx` (+ teste)
- Modify: `apps/mobile/app/(app)/_layout.tsx`, `apps/mobile/lib/hooks/useOpenMealAfterRegister.ts` (+ teste), `apps/mobile/lib/hooks/useRegisterMeal.ts` e `app/(app)/index.tsx` (card/banner/selo), `app/(app)/history/[day]/new.tsx`, `components/onboarding/blocks/FirstMealBlock.tsx`, `app/(app)/scan-confirm.tsx` (fallback de IA), `app/(app)/meal/[id]/index.tsx`, `components/domain/MealEditor.tsx`, `FEATURES.md`, `docs/PLAN.md` (se houver linha)
- Delete (só se nenhum importador restar, com grep): `MealPendingBar.tsx`, `MealUncertainBanner.tsx`, o `MealSourceCard` (mantém `MealPhotoThumb` exportado), `MealEditorHeader.tsx` se ficar sem uso, testes correspondentes

**Interfaces:**
- Produces: `ConfirmMealProvider` e `useConfirmMealSheet(): { open(mealId: string): void; close(): void }`. O provider guarda o `openId`; um `ConfirmMealHost` (dentro do provider) busca a refeição com `useQuery({ queryKey: mealDetailKey(id) })`, e quando carregada **e** `review_required`, renderiza `BottomDrawer` + `ConfirmMealDrawer`; se a refeição vier confirmada, ou der 404, fecha sozinho. Ao fechar com edições (`onDirtyChange`), `dialog.confirm` "Descartar alterações?"; sem edições fecha direto. Montado em `GuardedStack` como irmão do `<View className="flex-1 lg:flex-row">` (acima do Stack, abaixo do `TourOverlay`).
- Integração: `useOpenMealAfterRegister` passa a chamar `open(meal.id)` (mantendo as guardas de foco e `AppState`); no registro retroativo, depois do sucesso a tela (`formSheet` nativo) fecha com `router.back()` e então `open(meal.id)`; onboarding: `router.replace("/(app)")` e `open(meal.id)`; fallback de IA do `scan-confirm`: `router.replace("/(app)/")` e `open(meal.id)`, sem chamar `tour.notifyMealCreated()` (o gate da Home cuida). Home: card/selo/faixa de uma refeição **pendente** chamam `open(id)` (confirmada continua abrindo o detalhe). `meal/[id]/index.tsx`: se a refeição carregada estiver pendente, `open(id)` e sair da tela (`backOrHome`) em vez de mostrar o editor. `MealEditor` perde o modo pendente (título, cartão de origem, nota "ainda não conta", banner de incerteza, barra pendente, estado `confirmed`), voltando a ser só o editor da refeição confirmada; `MealSummaryCard` perde `pendingNote` se ficar sem uso.

- [ ] **Step 1: testes:** provider/host (abrir mostra o drawer quando pendente; refeição confirmada fecha sozinha; 404 fecha; fechar sem edição não pergunta; com edição pergunta e respeita cancelar); `useOpenMealAfterRegister` chama `open` e respeita foco/AppState; registro por texto/áudio/foto e `already_existed` abrem uma vez; retroativo fecha a tela e abre; onboarding e fallback de IA; Home abre o drawer para pendente e navega para confirmada; rota `meal/[id]` pendente abre o drawer e sai; `MealEditor` com `review_required` renderiza o editor normal (sem título "Confirme o que entendi").
- [ ] **Step 2:** rodar e ver falhar.
- [ ] **Step 3:** implementar e remover o que ficar sem uso (grep em `app`, `components`, `lib` e testes).
- [ ] **Step 4:** atualizar `FEATURES.md` (§4.2/§4.2.1: a confirmação é um drawer em três visões; a tela de detalhe é só para refeição confirmada) e `docs/PLAN.md`.
- [ ] **Step 5:** rodar a suíte mobile inteira + typecheck. **Conferência manual** (iOS, Android, web): registrar por texto, áudio e foto; ajustar e confirmar; fechar sem confirmar e reabrir pela Home; descartar; 12 itens com rolagem; onboarding; registro retroativo; teclado na visão de item; seletor de horário sobre o drawer.
- [ ] **Step 6: commit** `feat(mobile): replace the pending screen with a global confirm drawer`.
