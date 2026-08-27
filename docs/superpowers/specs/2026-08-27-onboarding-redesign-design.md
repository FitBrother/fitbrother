# Redesign do onboarding — anamnese antes da conta, menos perguntas, visual novo

Reabre parte do que o M16 (`docs/superpowers/specs/2026-07-14-m16-onboarding-state-machine-design.md`)
tinha marcado como "decisão fechada", por pedido explícito do usuário nesta sessão:
a ordem conta→anamnese vira anamnese→conta, a triagem de TCA sai do fluxo, e o
conteúdo de "Rotina" (treino/hábitos/barreiras/dieta) sai do onboarding inteiro.
O resto da arquitetura do M16 (engine declarativo `ONBOARDING_BLOCKS`, resume via
`onboarding_progress`, `OnboardingPayloadSchema`) continua valendo — este spec
descreve só o que muda.

Gatilho: o usuário criou um template de onboarding no Claude Design
(`templates/onboarding/Onboarding.dc.html`, projeto "Fitbrother Design System")
com um visual de capítulos (painel lateral no desktop, card com progresso
segmentado, nav fixa no mobile) — e junto com o pedido visual, trouxe duas
mudanças de produto: motivar antes de pedir conta, e reduzir perguntas de saúde.

---

## 1. Novo fluxo — visão geral

```
FASE A — Anamnese (sessão anônima do Supabase, sem conta real ainda)
  Capítulo 1 · Você:      name → basics → height → weight → activity
  Capítulo 2 · Objetivo:  goal → health (agora pulável)
  Capítulo 3 · Metas:     calculating (preview local) → reveal (preview local)
                          CTA do reveal: "Criar conta pra salvar essas metas"

FASE B — Conta e legal (mesma sessão é promovida a conta real aqui)
  signup (NOVO) → identity → consent → submitting (NOVO)

FASE C — Ativação (conta real já existe)
  permissions → paywall → first_meal
```

16 blocos (era 19). Removidos do onboarding: `contact` (telefone), `training`,
`habits`, `barriers`, `diet` (as 4 telas de "Rotina") e as 3 perguntas de TCA
dentro de `health`. Adicionados: `signup`, `submitting`.

### O que sai e pra onde vai

| Removido | Motivo | Destino |
|---|---|---|
| `contact` (telefone) | Não afeta cálculo de metas, serve só pra achar amigos | Backlog — prompt de telefone na tela Amigos, fora deste spec |
| `training`/`habits`/`barriers`/`diet` | Auditoria encontrou 3 campos nunca lidos em lugar nenhum do código (`cooks_own_food`, `meal_times`, `budget`) e 2 de 3 seleções de `main_barriers` são ignoradas (só a 1ª é usada); o resto (`dietary_restrictions`, `disliked_foods`, `eats_out_frequency`, `training_days_per_week`, `strength_training`) alimenta `build-coach-context.ts` mas não o cálculo de metas | Backlog — tela futura "melhorar recomendações" nas configurações, opcional, pós-conta. Fora deste spec |
| 3 perguntas de TCA em `health` | Pedido explícito: reduzir fricção de saúde | Nenhum — removidas sem substituto. `tca_screening_positive` deixa de existir |

**Consequência aceita:** até a tela de "melhorar recomendações" existir, o
coach de IA perde a personalização de tom (barreira principal, restrição
alimentar, frequência de comer fora, rotina de treino) pra usuários novos.
Ele continua funcionando, só mais genérico no dia 1.

**Consequência técnica (não é bug, é dead code aceito):** com `tca_screening_positive`
removido, `evaluateSafetyGates` nunca mais retorna severidade `SOFT_MODE` — os 4
pontos de UI que reagem a `profile.soft_mode` (`TodaySummaryHeader`,
`HistoryDayCard`, `StreakCounter`, `reveal`) e a branch "Vamos com calma" do
`RevealBlock` ficam órfãos, mas **não são removidos** neste spec (risco/escopo
maior que o pedido original — fica pra uma limpeza futura, se algum dia
alguém reintroduzir um gatilho de soft_mode).

---

## 2. Sessão anônima → conta real

Hoje `(auth)/sign-up.tsx` cria a conta (`supabase.auth.signUp`) *antes* de
entrar em `(onboarding)`. Isso inverte:

- **`Welcome.tsx`**: o botão "Criar conta" passa a chamar
  `supabase.auth.signInAnonymously()` e ir direto pra `/(onboarding)`, sem
  passar por `(auth)/sign-up`. "Já tenho conta" continua indo pro `sign-in.tsx`
  normal (inalterado — é pra quem já tem cadastro completo).
- **`(auth)/sign-up.tsx`** é removido — sua função (tela de e-mail+senha) vira
  o bloco `SignupBlock`, dentro de `(onboarding)`.
- **`SignupBlock`** (novo, mesma UI/validação do `sign-up.tsx` atual — e-mail,
  `PasswordInput` com força mínima "Razoável") chama
  `supabase.auth.updateUser({ email, password })` em vez de `signUp`. Isso
  promove a sessão anônima pra uma conta permanente **mantendo o mesmo
  `auth.uid()`** — nenhum dado precisa ser migrado, `onboarding_progress` e
  tudo que já foi salvo continuam válidos sob o mesmo usuário.
- Erros de `updateUser` (e-mail já em uso, etc.) tratados igual ao
  `sign-up.tsx` atual (mensagem inline, sem bloquear o resto do app).

**Por que isso não pede mudança no guard de rotas nem no backend:** uma sessão
anônima do Supabase já é uma sessão autenticada de verdade (`auth.uid()` real,
`is_anonymous: true` no JWT). `app/index.tsx` já redireciona qualquer sessão
sem linha em `profiles` pra `/(onboarding)` — uma conta anônima sem perfil
cai exatamente no mesmo caminho que uma conta recém-criada sem perfil cai
hoje. `authRequired` e as policies de RLS (`auth.uid() = user_id`) não
diferenciam anônimo de permanente. Zero mudança necessária ali.

**Se o app fechar no meio da Fase A ou B:** a sessão anônima persiste (mesmo
armazenamento seguro que qualquer sessão Supabase), então o resume via
`GET /onboarding/progress` continua funcionando normalmente do bloco 1 até o
fim da Fase B — cobertura de resume igual ou melhor que hoje.

---

## 3. Calculating/Reveal viram preview local (mudança arquitetural chave)

Hoje `CalculatingBlock` chama `postOnboarding()` (→ `POST /onboarding/complete`
→ RPC `complete_onboarding`) e é isso que cria `profiles`/`anthropometrics`/
`nutrition_goals`/`subscriptions`. Isso só pode acontecer depois do `consent`
(a função exige os 3 consentimentos) — mas no novo fluxo, `calculating`/`reveal`
(Capítulo 3 "Metas") acontecem **antes** de `signup`/`identity`/`consent`.

Resolução: `calculating`/`reveal` na Fase A passam a ser um **preview
100% local**, sem chamada de rede — reaproveitando exatamente o padrão que
o M16 já estabeleceu pro preview de data projetada no `GoalBlock` (§1.5
daquele spec): `computeTargets()` e `evaluateSafetyGates()` já são funções
puras de `@fitbrother/shared`, já importadas no client.

- **`calculating`** (local): dispara `computeTargets(buildLocalTargetsInput(store))`
  + `evaluateSafetyGates(...)` de uma vez (síncrono, instantâneo), guarda o
  resultado no `onboardingResultStore` efêmero (já existe) e, depois de um
  delay decorativo (~2.6s, mesma constante `calcDurationMs` do template —
  é só pra dar peso ao momento, não porque o cálculo demora), avança pro
  `reveal`. Sem `postOnboarding`, sem `Promise.all` de rede.
- **`reveal`** (local): mesmo visual de hoje (kcal em destaque, 3 chips de
  macro, `GoalsDisclaimer`), lendo o resultado local. Mantém as 3
  ramificações — `blocked` (gate `BLOCK`, ex. idade<18+perder, gravidez+perder,
  IMC-alvo<18.5) mostra `block_reason` em vez de números; caso normal mostra
  os números. A ramificação `soft_mode` fica no código mas nunca mais
  dispara (§1). CTA: **"Criar conta pra salvar essas metas"** → avança pro
  `signup`.

A submissão real (persistência de verdade) muda de lugar, não desaparece:

- **`submitting`** (novo bloco, fim da Fase B, depois de `consent`): mesmo
  visual de "calculando" (3 pontos pulsantes), mas agora É a chamada real —
  `postOnboarding(payload)` de fato, com `toPayload()` já validando os 3
  consentimentos (que agora existem). Sucesso → RPC `complete_onboarding`
  roda como hoje (cria `profiles`/`anthropometrics`/`nutrition_goals`/
  `subscriptions`, apaga a linha de `onboarding_progress`) → avança pro
  `permissions`. Erro → mensagem + "Tentar de novo", mesmo padrão do
  `CalculatingBlock` atual.

O servidor recalcula tudo do zero em `submitting` (fonte de verdade
persistida) — o preview local da Fase A nunca é enviado, é só pra mostrar o
número ao usuário antes de pedir a conta. Mesma garantia que o M16 já
documentou pro preview do `GoalBlock`: "o preview client-side não tem nenhum
efeito de segurança, não decide `blocked`, não é enviado ao servidor."

---

## 4. Saúde — o que muda em `HealthBlock`

- Remove as 3 perguntas de TCA (`TCA_QUESTIONS`, `TCA_OPTIONS`) e o comentário
  `PENDENTE DE REVISÃO PROFISSIONAL` associado a elas.
- Remove o campo `tca_screening_positive` de: `useOnboardingStore` (state,
  `INITIAL`, `toAnswers`, `toPayload`), `OnboardingPayloadSchema`
  (`packages/shared/src/schemas.ts`), `TargetsInput`
  (`packages/shared/src/targets/types.ts`), o gate `tca_screening_positive`
  em `evaluateSafetyGates` (`packages/shared/src/targets/gates.ts`),
  `buildTargetsInput` (`apps/server/src/services/targets.ts`). A coluna
  `anthropometrics.tca_screening_positive` (migration 0062) fica no banco,
  não usada — sem migration de remoção neste spec (dropar coluna é
  destrutivo e fora do pedido original).
- Os 4 checkboxes de condição (`is_pregnant_or_lactating`, `has_kidney_disease`,
  `has_type1_diabetes`, `uses_glp1`) continuam exatamente como estão,
  alimentando os mesmos gates (`BLOCK` pra gravidez, `REFER` pra renal/diabetes,
  `WARN` pra GLP-1) — nenhuma mudança de lógica de segurança.
- `HealthBlock` vira `skippable: true` no array de blocos (hoje não é).
  Subtítulo muda pra deixar isso óbvio: "Leva 10 segundos, e só pra manter
  suas metas seguras — pode pular."

Termos de uso ganham uma cláusula geral (ex.: "o cálculo de metas não
substitui orientação médica; se você tiver uma condição de saúde não
coberta pelas perguntas, ajuste manualmente ou procure um profissional") —
**sem** tentar cobrir as 4 condições específicas por texto, já que elas
continuam sendo perguntadas ativamente. Texto exato fica pro plano
(precisa passar pela mesma revisão que o M14 — copy legal — já documentou).

---

## 5. Visual — `OnboardingChapterShell`

Novo componente compartilhado, substituindo `OnboardingStepShell` +
`OnboardingNavButtons` + `ProgressBar` pros 16 blocos do onboarding (nenhum
dos três é usado fora de `components/onboarding/blocks/`, confirmado por
busca no repo — podem ser removidos depois que a migração terminar).

Reproduz `templates/onboarding/Onboarding.dc.html`:

**Desktop (≥1000px):** `flex-row`. Painel esquerdo fixo (`w-[380px]` max,
~34% via `md:w-[34%] lg:max-w-[380px]`, `bg-white` + sombra `Card`-style),
só visível quando o bloco tem `chapter` definido (Fase A). Contém: logo
(`Logo` horizontal, tom cor, altura ~22), título "Vamos montar suas metas."
+ subtítulo, checklist dos capítulos (3 agora — Você/Objetivo/Metas — não 4;
copy do painel ajusta "Quatro capítulos curtos" → "Três capítulos curtos"),
cada item com círculo de 26px (check verde se `chapter < atual`, dot menta se
`chapter === atual`, vazio se à frente), nota de privacidade fixa no rodapé
do painel. Área principal centralizada, card branco (`rounded-2xl`, sombra
`Card`-elevated, `max-w-[560px]`, `p-10`) com: barra de progresso segmentada
(uma barrinha de 4px por capítulo, preenchida até o capítulo atual — só
quando `chapter` existe), "Capítulo N de 3 · {nome}", título/subtítulo do
bloco, conteúdo, nav (botão circular voltar 52px + CTA "Continuar" full-width),
"Pular esse passo" abaixo da nav quando `skippable`.

**Tablet (<1000px):** painel some; mini-header só com a logo (tom ink) acima
do card.

**Phone (<640px):** card fica full-bleed (sem sombra/raio/fundo próprio —
herda o fundo da tela); nav vira barra fixa no rodapé (`position` não existe
em RN — usar `View` posicionado via `absolute bottom-0` + `SafeAreaView`
`edges={["bottom"]}` pro respiro de safe-area, equivalente ao
`env(safe-area-inset-bottom)` do CSS).

Blocos sem `chapter` (Fase B/C: `signup`, `identity`, `consent`, `submitting`,
`permissions`, `paywall`, `first_meal`) usam o mesmo card centralizado, mas
**sem painel lateral em nenhum breakpoint** e sem a barra de progresso
segmentada/rótulo de capítulo — só título, conteúdo e nav. `calculating` e
`reveal` (Fase A, mas são telas de payoff, não formulário) também ficam sem
nav padrão, como já é hoje — só que agora dentro do card com painel lateral
visível (capítulo 3 ativo).

A barra segmentada + "Capítulo N de 3 · {nome}" não vêm de `step`/`total`
(que continuam sendo o índice linear 1-16, só para eventual uso futuro de
analytics — nenhum bloco usa isso hoje além de repassar pro shell) — vêm de
um `chapter` novo, derivado em `[block].tsx` a partir de `block.chapter` e
`CHAPTER_NAMES`, e repassado pro `OnboardingChapterShell` (ver §6). Quando
`chapter` é `undefined`, o shell simplesmente não renderiza o painel nem a
barra segmentada, independente do valor de `step`/`total`.

Tokens: reaproveita o que já existe em `tailwind.config.ts`/`colors.ts`
(`primary-400`, `neutral-*`, `font-display-bold`, etc.) e o padrão
`Platform.select` de sombra do `Card.tsx` — só acrescenta o que for
genuinamente novo (largura do painel, o tint de fundo do capítulo ativo no
checklist). Mapeamento exato de cada valor do template pro token/classe mais
próxima fica pro plano de implementação, não pra este spec.

---

## 6. `OnboardingBlockDef` — novo campo `chapter`

```ts
export type OnboardingBlockDef = {
  id: string;
  Component: ComponentType<OnboardingBlockProps>;
  skippable?: boolean;
  chapter?: 1 | 2 | 3; // undefined = Fase B/C, sem painel lateral nem progresso segmentado
};

export const CHAPTER_NAMES = { 1: "Você", 2: "Objetivo", 3: "Metas" } as const;
export const CHAPTER_TOTAL = 3;

// OnboardingBlockProps ganha um campo — o resto (step/total/onNext/onBack/onSkip) não muda:
export type OnboardingBlockProps = {
  // ...campos existentes...
  chapter?: { num: 1 | 2 | 3; name: string }; // presente só em blocos de Fase A
};
```

`ONBOARDING_BLOCKS` reordenado:

```ts
export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  { id: "name", Component: NameBlock, chapter: 1 },
  { id: "basics", Component: BasicsBlock, chapter: 1 },
  { id: "height", Component: HeightBlock, chapter: 1 },
  { id: "weight", Component: WeightBlock, chapter: 1 },
  { id: "activity", Component: ActivityBlock, chapter: 1 },
  { id: "goal", Component: GoalBlock, chapter: 2 },
  { id: "health", Component: HealthBlock, chapter: 2, skippable: true },
  { id: "calculating", Component: CalculatingBlock, chapter: 3 },
  { id: "reveal", Component: RevealBlock, chapter: 3 },
  { id: "signup", Component: SignupBlock },
  { id: "identity", Component: IdentityBlock },
  { id: "consent", Component: ConsentBlock },
  { id: "submitting", Component: SubmittingBlock },
  { id: "permissions", Component: PermissionsBlock, skippable: true },
  { id: "paywall", Component: PaywallBlock },
  { id: "first_meal", Component: FirstMealBlock },
];

export const DATA_BLOCK_COUNT = 13; // "name" .. "submitting" — autosalva progresso
```

`[block].tsx` e `index.tsx` (gate de resume) não mudam de lógica — já são
100% dirigidos pelo array. `step`/`total` passados pros blocos da Fase A
continuam sendo o índice geral (1-16), não um índice por capítulo — o
capítulo/progresso segmentado é derivado de `block.chapter` dentro do
`OnboardingChapterShell`, não trocado no contrato de `OnboardingBlockProps`.

---

## 7. Contrato de dados — o que muda em `packages/shared`

- `OnboardingPayloadSchema`: remove `tca_screening_positive`. Todo o resto
  (`is_pregnant_or_lactating`, `has_kidney_disease`, `has_type1_diabetes`,
  `uses_glp1`, `onboarding_context`, etc.) fica como está — os campos que
  hoje alimentam `onboarding_context` (`main_barriers`, `dietary_restrictions`,
  `disliked_foods`, `budget`, `meal_times`, `cooks_own_food`,
  `eats_out_frequency`, `training_type`/`strength_training`/
  `training_days_per_week`) simplesmente nunca são preenchidos por este
  fluxo (ficam `{}`/`undefined`) — nenhuma mudança de schema necessária pra
  removê-los da UI, já eram todos opcionais.
- `TargetsInput`/`gates.ts`: remove o campo e o gate de `tca_screening_positive`.
  `SOFT_MODE` como `severity` possível fica no type (não é mais atingível,
  mas não vale a pena remover o enum inteiro por uma limpeza que não foi
  pedida).
- `useOnboardingStore`: remove `tca_screening_positive` de tudo (state,
  `INITIAL`, `setField` type, `toAnswers`, `toPayload`). `phone_e164` e os
  campos de `onboarding_context` continuam existindo no store (só não são
  mais preenchidos por nenhum bloco ativo) — não removo esses agora porque
  tirar `contact`/`training`/`habits`/`barriers`/`diet` do array já resolve
  o problema de UI; limpar o store todo é opcional e fica pro plano decidir
  (baixo risco, mas é código morto adicional se não limpar).

Nenhuma migration SQL nova é necessária — não há coluna nova, só uma
(`tca_screening_positive`) que passa a nunca ser escrita.

---

## 8. Testes

Mesmo padrão do M16 (`packages/shared` sem teste de schema dedicado; SQL
smoke test com `ROLLBACK`; HTTP end-to-end com JWT real; typecheck+lint do
monorepo). Casos que mudam ou são novos:

- SQL smoke test do M16 que testava `tca_screening_positive: true` é
  removido/atualizado (campo não existe mais no payload).
- Novo caso HTTP end-to-end: `signInAnonymously()` → várias `PATCH
  /onboarding/progress` (simulando Fase A) → `updateUser({email,password})`
  (simulando `signup`) → confirma que `GET /onboarding/progress` ainda
  retorna a mesma linha (mesmo `auth.uid()`, progresso não se perdeu) →
  `PATCH` mais algumas vezes (Fase B) → `POST /onboarding/complete` →
  confirma que a linha de `onboarding_progress` some, igual hoje.
- Sem teste automatizado de UI (mesma limitação do M16 — sem Detox/Playwright
  no mobile). Verificação manual via Expo/`preview_start`.

---

## 9. Feito quando

- Fluxo completo (Welcome → 16 blocos → `(app)`) funciona ponta a ponta com
  dados reais, terminando numa conta funcional.
- Fechar o app em qualquer bloco de `name` até `submitting` e reabrir retoma
  exatamente onde parou, sob a mesma sessão anônima (ou já promovida).
- `reveal` (Fase A, local) mostra o preview correto — números normais, ou
  `block_reason` pro gate `BLOCK` — sem nenhuma chamada de rede.
- `submitting` persiste os dados reais e a conta criada bate com o que foi
  mostrado no preview.
- Painel lateral de capítulos aparece só em `name`..`reveal`, com o capítulo
  certo destacado; some completamente a partir de `signup`.
- Responsivo nos 3 breakpoints do template (desktop com painel, tablet com
  mini-header, phone com nav fixa no rodapé).
- Typecheck + lint do monorepo inteiro passam.

---

## 10. Fora de escopo (explicitamente adiado)

- Tela "melhorar recomendações" (destino futuro de treino/hábitos/barreiras/dieta).
- Prompt de telefone na tela Amigos (destino futuro do `contact`).
- Qualquer reintrodução de triagem de bem-estar emocional/TCA, em qualquer formato.
- Remover a coluna `anthropometrics.tca_screening_positive` do banco.
- Remover a infraestrutura de `soft_mode` (gate, coluna `profiles.soft_mode`,
  os 4 pontos de UI que reagem a ela) — fica como dead code aceito.
- Limpar do zustand store os campos de `onboarding_context` que nenhum bloco
  ativo preenche mais (opcional, baixo risco, não bloqueia "feito quando").
- Redação final do texto legal da nova cláusula de saúde nos termos de uso —
  o spec só define a intenção, o texto passa por revisão separada.
