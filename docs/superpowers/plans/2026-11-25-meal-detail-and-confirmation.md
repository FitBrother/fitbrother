# Detalhe editável e confirmação ao registrar — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development`. Passos usam checkbox (`- [ ]`). Implementar **Fase 1** e **Fase 2** em branches/PRs separados (`feat/meal-detail-editable` e `feat/meal-confirmation-flow`, ambos a partir de `dev`); a Fase 2 depende da Fase 1 mergeada. **A Fase 2 só começa depois que o usuário responder as Decisões D1–D6 do spec.**

**Goal:** (Fase 1) fazer o detalhe da refeição ser a própria tela de edição; (Fase 2) toda refeição registrada por texto, áudio ou foto nasce pendente e passa por uma tela de confirmação editável antes de valer no dia.

**Architecture:** O corpo da tela de edição vira `MealEditor` (ex-`EditMealModal`), usado pela rota de detalhe. O estado "pendente" reaproveita `meals.review_required` (já exclui a refeição de `daily_summaries`, streak e conquistas); uma RPC nova passa a criar refeições de IA do app como pendentes e o `PATCH /meals/:id` ganha `confirm` para salvar edições e confirmar numa requisição só.

**Tech Stack:** React Native + Expo Router, NativeWind v4, TanStack Query, Fastify, Postgres (migration + smoke test SQL), `@fitbrother/shared`.

**Spec:** `docs/superpowers/specs/2026-11-25-meal-detail-and-confirmation-design.md`

## Global Constraints

- Regras de ouro de UI do `CLAUDE.md` (fontes `font-sans-*`/`font-display-*`; números com `tabular-nums`; cores por token; alvos ≥ 44 pt; `accessibilityLabel`/`accessibilityRole`; sombras via `lib/shadows.ts`; só `lucide-react-native`; sem `dark:`; sem tags HTML; loading = skeleton que espelha a tela). Reaproveitar `MealSummaryCard`, `MealItemRow`, `MealItemSheet`, `MealMetaChips`, `MacroSplitBar`, `Card`, `Button` já existentes.
- Comentários de código: só quando necessário, 1 linha, em inglês. Commits Conventional Commits em inglês, sem trailer de agente. UI em pt-BR. Sem dependência nova.
- Migrations são imutáveis depois do merge: mudança = migration nova (a próxima é `0088`). Mudança de schema/RPC exige revisão de outra pessoa e execução em ambiente de teste antes de produção.
- `review_required = true` mantém a semântica atual: fora de `daily_summaries`, streak, `goal_hit`, achievements, insights e ranking; entra de novo (com recálculo do dia) quando vira `false`.
- O caminho do barcode (`POST /meals/barcode`, `scan-confirm`) não muda: continua com a própria confirmação e **não** nasce pendente por esta regra.
- Pós-confirmação o app invalida `dailySummary`, `dailySummariesHistory` e `streak` (o `useConfirmMeal` atual não invalida; confiar só no Realtime é frágil).

## Review Focus

- Fase 1: voltar (botão, gesto iOS, botão Android) com alteração pendente pergunta "Descartar alterações?"; sem alteração, sai direto.
- Fase 1: Compartilhar/Novo post escondidos enquanto houver alteração pendente e enquanto `review_required`.
- Fase 1: nenhum caller restante aponta para a rota `meal/[id]/edit` apagada.
- Fase 2: confirmar duas vezes seguidas (duplo toque / reenvio) é idempotente e não duplica efeitos; o botão fica `loading`/desabilitado durante o envio.
- Fase 2: confirmar com itens editados grava os itens **e** confirma ou falha inteiro (não confirma com itens antigos se o PATCH de itens falhar).
- Fase 2: reenvio do mesmo `client_meal_id` (`already_existed`) navega para a mesma refeição, sem tela duplicada.
- Fase 2: usuário que sai da tela de confirmação (ou o app fecha) encontra a refeição pendente na Home; descartar exclui e o total do dia não muda.
- Fase 2: refeição de confiança < 0,6 mostra o banner de incerteza; as de confiança alta não.
- Fase 2: foto sem `image_path` carregável e áudio com transcrição vazia não quebram o card "o que você disse".
- Fase 2: o total do dia e o streak só mudam depois de confirmar; o onboarding (primeiro registro) e o tour usam a confirmação.

---

## FASE 1 — Detalhe editável

### Task 1: `MealEditor` com barra de salvar condicional e proteção de saída

**Files:**
- Rename/Modify: `apps/mobile/components/domain/EditMealModal.tsx` → `apps/mobile/components/domain/MealEditor.tsx` (+ `.test.tsx` renomeado)
- Modify: `apps/mobile/lib/edit-meal-reducer.ts` apenas se precisar expor "dirty" já distinto de itens/meta (hoje já é)

**Interfaces:**
- Produces: `MealEditor({ meal: MealResponse, day: string, banner?: (ctx: { dirty: boolean }) => React.ReactNode })` — a tela inteira (barra, chips, resumo fixo, lista, sheet). `banner`, quando passado, é renderizado dentro da rolagem, entre o card de resumo/feedback da IA e a lista de itens (a Task 2 usa para o aviso "Confira os itens"). Comportamento depois de **salvar com sucesso**: a tela **continua aberta** (não chama `router.back()`), mostra o toast "Alterações salvas", e reinicia o rascunho a partir da refeição devolvida pelo `PATCH` (itens, tipo, horário e linha de base do delta passam a ser os salvos; a barra de salvar some). "Excluir refeição" (barra do topo) e a exclusão em cascata (remover o último item) fazem `router.back()` ao excluir (não mais `router.replace("/(app)")`, porque agora esta é a única tela da refeição na pilha). A tela:
  - card de feedback da IA (`meal.ai_feedback`) entre o resumo e a lista (`bg-primary-50`, ícone `Sparkles`, texto `text-primary-700`);
  - bloco "Compartilhar" (`Button` primário → `/(app)/share/meal/${id}`) e "Novo post" (→ `/(app)/post/new` com `meal_id`) ao fim da rolagem, **ocultos** quando há alteração pendente ou `meal.review_required`;
  - barra inferior com "Descartar" (outline) e "Salvar alterações" (primário, `loading`), **visível só quando há alteração pendente**; "Descartar" restaura o estado inicial (re-`init` do reducer e da meta);
  - proteção de saída: com alteração pendente, voltar pelo botão da barra, pelo gesto do iOS e pelo botão do Android pergunta "Descartar alterações?" (`useDialog().confirm`, destrutivo). Usar o mecanismo do Expo Router/React Navigation disponível no projeto (`usePreventRemove` ou listener `beforeRemove` do `useNavigation`); verificar qual existe antes e seguir o padrão do repo.
  - barra do topo: botão voltar (`ChevronLeft`), título "Refeição" (`font-display-bold`), lixeira "Excluir refeição" (confirma e exclui; igual ao `deleteMeal` atual).

- [ ] **Step 1: testes** (adaptar os do `EditMealModal.test.tsx`): sem alteração não há barra de salvar nem confirmação ao voltar; com alteração (stepper) aparece a barra e `Compartilhar` some; "Descartar" volta ao estado inicial e some a barra; voltar com alteração chama `confirm` e só sai se confirmar (mock do mecanismo de saída); o feedback da IA aparece quando `ai_feedback` existe e não aparece quando é `null`; com `review_required` o bloco de compartilhar não aparece.
- [ ] **Step 2: rodar e ver falhar.** `npm test -w apps/mobile -- MealEditor`.
- [ ] **Step 3: implementar** (renomear o componente e o arquivo de teste com `git mv`; atualizar imports).
- [ ] **Step 4: rodar** testes do pacote + typecheck.
- [ ] **Step 5: commit** `refactor(mobile): turn meal edit modal into a reusable meal editor`.

### Task 2: Rota de detalhe usa o `MealEditor`; remover a rota de edição

**Files:**
- Modify: `apps/mobile/app/(app)/meal/[id]/index.tsx`
- Delete: `apps/mobile/app/(app)/meal/[id]/edit.tsx`, `apps/mobile/components/domain/MealItemRowSwipeable.tsx` (+ teste, se existir), `apps/mobile/components/domain/MealDetailSkeleton.tsx` (se nada mais usar)
- Modify: `apps/mobile/components/domain/MealEditSkeleton.tsx`; qualquer caller de `"/(app)/meal/[id]/edit"` (grep); `apps/mobile/app/(app)/_layout.tsx` se a rota estiver registrada
- Modify: `FEATURES.md` (§4.2.1: o detalhe é a edição)

**Interfaces:**
- Consumes: `MealEditor` (Task 1), `getMeal`, `mealDetailKey`, `useProfile`, `nutritionalDay`, `useConfirmMeal`.
- Produces: `MealDetailScreen` que carrega a refeição, mostra `MealEditSkeleton` enquanto carrega e "Refeição não encontrada." em erro, e renderiza `<MealEditor meal day />`. Enquanto a Fase 2 não existe, **mantém o botão "Confirmar refeição" atual para `review_required`** como banner âmbar (artboard A3: ícone de alerta, "Confira os itens", texto e o botão), passado ao `MealEditor` pela prop `banner` e usando `useConfirmMeal`; o botão fica **desabilitado enquanto `ctx.dirty`** (há alterações não salvas), com a dica "Salve as alterações para confirmar".

- [ ] **Step 1: testes** do detalhe (render com refeição normal e com `review_required`; erro; loading mostra o skeleton) e um teste/grep que garanta que não sobrou referência à rota `edit`.
- [ ] **Step 2: rodar e ver falhar.**
- [ ] **Step 3: implementar**; apagar os arquivos listados; ajustar o skeleton para o shape novo (barra, chips, resumo, cartão de feedback, 3 linhas, botões de compartilhar).
- [ ] **Step 4: atualizar `FEATURES.md` §4.2.1.**
- [ ] **Step 5: rodar** suíte mobile + typecheck. **Conferência manual no simulador** (iOS/Android/web) do gesto de voltar com alteração e do teclado no sheet, como já listado no PR #44.
- [ ] **Step 6: commit** `feat(mobile): make the meal detail screen the editing screen`.

---

## FASE 2 — Confirmação ao registrar (depende das decisões D1–D6)

### Task 3: Backend — refeição de IA do app nasce pendente; `PATCH` com `confirm`

**Files:**
- Create: `supabase/migrations/0088_meals_pending_confirmation.sql`, `supabase/tests/0088_meals_pending_confirmation.sql`
- Modify: `packages/shared/src/schemas.ts` (`PatchMealRequestSchema`), `apps/server/src/routes/meals.ts` (`buildMealPatch` e o handler do `PATCH`), testes de servidor e de schema, `FEATURES.md` (§3/§4.2)

**Interfaces:**
- Produces:
  - Migration que faz `CREATE OR REPLACE FUNCTION public.create_meal_with_items(payload jsonb)` copiando o corpo vigente (`0049_meals_ai_feedback.sql`) e trocando **apenas** `v_review_required` para `COALESCE(v_confidence < 0.6, false) OR v_source IN ('app_text', 'app_audio', 'app_photo')`. Mesma assinatura, mesmo retorno, mesmos `GRANT`s da versão anterior.
  - `PatchMealRequestSchema` ganha `confirm: z.boolean().optional()`.
  - `PATCH /meals/:id`: quando `confirm === true`, depois de aplicar `items`/`meal_type`/`consumed_at` com sucesso, define `review_required = false` e responde com a refeição carregada. Se qualquer etapa anterior falhar, **não** confirma. `confirm: false`/omitido não altera `review_required` (comportamento atual).

- [ ] **Step 1: teste SQL** (`supabase/tests/0088_*.sql`, no padrão dos smoke tests existentes, num Postgres descartável): refeição `app_text` com confiança 0.9 nasce com `review_required = true` e **não** entra em `daily_summaries`; `app_barcode` com confiança 1.0 continua `false` e entra; `wa_text` e `manual` não mudam; confiança 0.5 continua pendente; reenvio com o mesmo `id` devolve `already_existed` sem alterar o flag.
- [ ] **Step 2: testes do servidor/shared:** schema aceita `confirm`; `PATCH` com `confirm: true` e itens válidos deixa `review_required = false`; `PATCH` com itens inválidos (por exemplo fora dos limites) responde 400 e a refeição continua pendente; `PATCH` sem `confirm` numa refeição pendente não a confirma.
- [ ] **Step 3: implementar** a migration, o schema e o handler.
- [ ] **Step 4: rodar** `npm test -w @fitbrother/shared`, `npm test -w apps/server`, o smoke test SQL e os typechecks.
- [ ] **Step 5: commit** `feat(server): create AI meals pending and confirm via patch`. **A migration precisa de revisão de outra pessoa e execução em ambiente de teste antes de produção.**

### Task 4: Navegar para a confirmação depois de registrar

**Files:**
- Modify: `apps/mobile/app/(app)/index.tsx` (`handleSend`, `handleAudioReady`, `handlePhotoPress` e `aoRegistrar`), `apps/mobile/app/(app)/history/[day]/new.tsx` (D4), `apps/mobile/components/onboarding/FirstMealBlock.tsx` (D3), `apps/mobile/lib/hooks/useCreateMeal{Text,Audio,Photo}.ts` se preciso expor o `meal` ao chamador
- Modify: `apps/mobile/components/domain/ShareMealPrompt.tsx` e quem o dispara

**Interfaces:**
- Produces: depois do sucesso de `createMealText/Audio/Photo`, `router.push({ pathname: "/(app)/meal/[id]", params: { id: meal.id } })` (mesmo `id` quando `already_existed`). Durante o processamento continua o card otimista na Home. Se o usuário já saiu da Home ou o app foi para segundo plano, **não** força navegação (a refeição pendente aparece na Home). O `ShareMealPrompt` deixa de ser disparado no registro (a refeição nasce pendente) e passa a ser mostrado depois da confirmação (Task 5). `tour.notifyMealCreated()` passa a ser chamado ao **confirmar** (não ao criar).

- [ ] **Step 1: testes:** sucesso de texto/áudio/foto navega para o detalhe com o `id` retornado; `already_existed` navega para o mesmo `id`; erro de quota/rede não navega e mantém os banners atuais; o registro retroativo e o do onboarding também navegam.
- [ ] **Step 2: rodar e ver falhar.**
- [ ] **Step 3: implementar.**
- [ ] **Step 4: rodar** a suíte mobile + typecheck.
- [ ] **Step 5: commit** `feat(mobile): open the confirmation screen after registering a meal`.

### Task 5: Modo "Confirme o que entendi" no `MealEditor`

**Files:**
- Modify: `apps/mobile/components/domain/MealEditor.tsx` (+ teste), `apps/mobile/app/(app)/meal/[id]/index.tsx`, `apps/mobile/lib/hooks/useConfirmMeal.ts`
- Create (se fizer sentido separar): `apps/mobile/components/domain/MealSourceCard.tsx` (+ teste)

**Interfaces:**
- Consumes: `meal.review_required`, `meal.confidence`, `meal.source`, `meal.raw_input`, `meal.image_path`, `PatchMealRequest.confirm` (Task 3).
- Produces: com `meal.review_required`, o `MealEditor` entra em **modo pendente**:
  - título "Confirme o que entendi";
  - `MealSourceCard`: texto/áudio mostram `raw_input` ("Você escreveu"/"Você disse"), foto mostra a miniatura carregada de `image_path` com o rótulo "Foto do prato"; sem `raw_input`/imagem o card não aparece;
  - dentro do card de total, o aviso "ainda não conta no seu dia" no lugar do delta;
  - com `meal.confidence !== null && meal.confidence < 0.6`, banner âmbar "Não tive certeza de alguns itens. Confira as quantidades.";
  - botão primário fixo "Confirmar refeição" (sempre visível no modo pendente, mesmo sem edição) e link "Descartar refeição" (confirma e exclui); ao tocar em confirmar envia **um** `PATCH` com `confirm: true` mais `items`/`meal_type`/`consumed_at` só do que mudou; sem alteração, `PATCH { confirm: true }` ou `POST /meals/:id/confirm` (o que já existir);
  - após sucesso: invalida `dailySummary`, `dailySummariesHistory`, `streak`, `mealsForDay` e `mealDetail`; mostra o `ShareMealPrompt`/toast "Refeição registrada" e notifica o tour; sai do modo pendente;
  - sair sem confirmar não exclui nada; com alteração pendente ainda pergunta "Descartar alterações?" (a refeição continua pendente).
  - O botão de confirmar usa `loading` e fica desabilitado durante o envio (duplo toque não envia duas vezes).

- [ ] **Step 1: testes:** modo pendente mostra título, aviso e botão; texto/áudio mostram o `raw_input`; foto mostra a miniatura; banner só com `confidence < 0.6`; confirmar sem edição chama a confirmação e invalida as queries esperadas; confirmar com edição de quantidade envia o patch com `items` + `confirm: true` num único `mutate`; falha do envio mantém a tela pendente e mostra toast; duplo toque envia uma vez; descartar confirma e exclui; refeição já confirmada não mostra nada disso.
- [ ] **Step 2: rodar e ver falhar.**
- [ ] **Step 3: implementar** (incluindo a atualização do `useConfirmMeal` para invalidar `dailySummary`/`streak` e aceitar `items` quando houver edição).
- [ ] **Step 4: rodar** suíte mobile + typecheck. **Conferência manual:** registrar por texto, áudio e foto, editar e confirmar; sair e voltar pela Home.
- [ ] **Step 5: commit** `feat(mobile): add confirm-what-I-understood mode to the meal screen`.

### Task 6: Home mostra refeições pendentes

**Files:**
- Modify: `apps/mobile/components/domain/MealCard.tsx` (+ teste), `apps/mobile/app/(app)/index.tsx`, `apps/mobile/components/domain/TodaySummaryHeader.tsx` (+ teste)
- Create: `apps/mobile/components/domain/PendingMealsBanner.tsx` (+ teste)

**Interfaces:**
- Produces:
  - `MealCard`: o selo da refeição pendente passa de "Revisar" para "Confirmar" (mesmo estilo `warning`); tocar no card abre a tela de confirmação (já abre o detalhe).
  - `PendingMealsBanner({ meals: MealResponse[], onOpen: (id: string) => void })`: faixa âmbar no topo da lista com "N refeição(ões) aguardando confirmação" e botão "Confirmar" que abre a mais antiga; some quando não há pendentes.
  - `TodaySummaryHeader`: quando há pendentes, uma linha discreta "+<kcal> kcal ao confirmar" com a soma das pendentes do dia.

- [ ] **Step 1: testes:** banner com 1 e com 2 pendentes (singular/plural); some com 0; abre a mais antiga; o cabeçalho mostra a soma das pendentes; o selo diz "Confirmar".
- [ ] **Step 2: rodar e ver falhar.**
- [ ] **Step 3: implementar.**
- [ ] **Step 4: rodar** suíte mobile + typecheck; atualizar `FEATURES.md` (§4.2 passo 7 e §5.1) e `docs/PLAN.md` se houver linha da entrega.
- [ ] **Step 5: commit** `feat(mobile): show pending meals on the home screen`.

## Notas

- **Revisão da migration (Task 3):** é troca de corpo de função (`CREATE OR REPLACE`), sem DDL de tabela e sem alterar dados existentes; ainda assim segue a regra do projeto de revisão por outra pessoa e execução em ambiente de teste antes de produção. Refeições já salvas não mudam.
- **Risco de produto (D2):** sem confirmação automática, quem registra e não confirma não soma o dia nem o streak. Medir a taxa de refeições pendentes depois do lançamento antes de decidir o push/auto-confirmação.
- **Fora do plano (D5):** "Corrigir texto" (artboard G4) precisaria de um endpoint de reinterpretação e consumiria cota de IA; fica para uma parte seguinte.
