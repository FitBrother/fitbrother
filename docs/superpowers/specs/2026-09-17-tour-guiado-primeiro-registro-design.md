# Tour guiado após o primeiro registro — design

**Data:** 2026-09-17
**Status:** aprovado para implementação

## Contexto e objetivo

Hoje o onboarding (`app/(onboarding)/`) termina em `complete_onboarding` e larga o
usuário na Home, onde o `EmptyMealsState` convida a fazer o primeiro registro —
mas nada guia o usuário depois disso pelas abas do app nem mostra a opção de
instalar o Fitbrother na tela inicial.

Objetivo: assim que o usuário completa o **primeiro registro de refeição feito
no app**, disparar um tour guiado (spotlight sobre a UI real) que passa pelas
abas Home/Social/Análises, leva o usuário até o Perfil e termina destacando o
cartão de "Adicionar à Tela de Início" que já existe em `profile.tsx`
(`InstallPrompt`).

Fora de escopo: registro de refeição por WhatsApp ainda não existe no produto
(promessa futura) — o gatilho do tour não precisa considerar esse canal.

## Arquitetura

Um `TourProvider` (contexto React, no mesmo nível do `ProfileProvider`) monta
em `app/(app)/_layout.tsx` (`GuardedStack`) e vive durante toda a sessão
logada. Ele guarda:

- `active: boolean`
- `currentStep: number`
- um registro de alvos medidos em tela (`Record<TourStepId, Rect | null>`)

Um único `TourOverlay` é renderizado uma vez na raiz (dentro do `GuardedStack`,
abaixo do `Stack` de rotas) e lê o alvo do passo atual para desenhar o véu
escurecido com recorte no retângulo do alvo, mais um balão de texto com
"Pular" / "Próximo".

As três primeiras "abas" (Home/Social/Análises) são hoje troca de estado local
(`activeTab` em `index.tsx`, não navegação — ver `HomeHeader.tsx`), então o
tour avança entre elas sem trocar de tela. Só o passo de Perfil exige
navegação real (`router.push("/(app)/profile")`), disparada pelo próprio tour.

## Componentes novos

`apps/mobile/components/tour/`:

- **`TourProvider.tsx` / `useTour.ts`** — contexto:
  `{ active, currentStep, targets, startTour(), next(), skip(), registerTarget(id, rect) }`.
- **`TourTarget.tsx`** — wrapper fino (`<TourTarget id="home-tab">...</TourTarget>`)
  que mede `onLayout` e publica o retângulo no contexto quando montado, e
  remove o registro ao desmontar. Só envolve o conteúdo quando `active === true`
  (custo zero fora do tour).
- **`TourOverlay.tsx`** — portal fixo com o véu/recorte/balão.

### Passos (fixos, nessa ordem)

| # | Alvo (`TourStepId`) | Ação antes de focar | Copy |
|---|---|---|---|
| 1 | `home-tab` | — | "Aqui você vê seu resumo do dia." |
| 2 | `social-tab` | `onChangeTab("feed")` | "Veja o progresso dos seus amigos." |
| 3 | `analises-tab` | `onChangeTab("analises")` | "Gráficos da sua evolução." |
| 4 | `profile-avatar` | `router.push("/(app)/profile")` | "Seu perfil e configurações ficam aqui." |
| 5 | `profile-shortcut-card` | — | "Adicione o Fitbrother à tela inicial." |

O passo 5 só entra na sequência se `useInstallPrompt().status` **não** for
`"native"`, `"installed"` ou `"unsupported"`; nesses casos o tour encerra no
passo 4.

`TourTarget` envolve: os 3 botões de aba em `HomeHeader.tsx`, o avatar em
`profile.tsx` e o `InstallPrompt` em `profile.tsx`. O avatar do `HomeHeader`
(gateway pra Perfil no uso normal) não precisa de `TourTarget` — a navegação
do passo 3→4 é disparada pelo próprio tour via `router.push`, sem depender do
usuário tocar nesse botão.

## Gatilho e persistência

Nova migration `0079_profiles_tutorial_completed.sql`:

```sql
alter table profiles add column tutorial_completed_at timestamptz;
update profiles set tutorial_completed_at = now() where tutorial_completed_at is null;
```

O backfill acontece **dentro da própria migration**: todo profile já
existente recebe `now()` no momento do deploy, então só contas criadas depois
do deploy nascem com `tutorial_completed_at = NULL`. Isso evita que usuários
antigos (com dezenas/centenas de refeições já registradas) sejam tratados
como novos e vejam o tour reaparecer sem motivo.

Gatilho: no `onSuccess` de qualquer modalidade de criação de refeição feita no
app — texto/áudio/foto em `index.tsx` (composer da Home) e barcode/fallback-IA
em `scan-confirm.tsx` — se `profile.tutorial_completed_at === null`,
`TourProvider.notifyMealCreated()` chama `startTour()`. Como a coluna só é
`NULL` para contas novas, essa é necessariamente a primeira refeição do
usuário — não precisa contar histórico de `meals`.

Fora de escopo: `history/[day]/new.tsx` (lançar refeição num dia passado) não
dispara o tour — é uma tela de backfill alcançada a partir do Histórico, não
faz sentido como "primeiro registro" de um usuário novo (que ainda não tem
histórico pra fazer backfill).

Ao terminar (todos os passos concluídos ou "Pular" em qualquer passo), o app
faz `PATCH /account/settings` com `{ tutorial_completed: true }` — o servidor
traduz para `tutorial_completed_at = now()`. Reaproveita a rota existente de
`account.ts` (hoje só aceita `timezone`/`day_start_hour`), em vez de criar um
endpoint novo ou usar `PATCH /account/profile`, que é exclusiva de
`avatar_url` (recorta o path, valida ownership, faz cleanup no Storage — não
serve pra um campo genérico).

Replay manual: novo item "Rever tutorial" na tela de Configurações
(`app/(app)/settings.tsx`) chama `startTour()` direto — não depende de
`tutorial_completed_at` e não o reseta.

## Fluxo de dados e coordenação com navegação

Ao avançar do passo 3 pro 4 (troca de tela Home → Perfil), o `TourProvider`
marca o passo como "aguardando alvo" e dispara o `router.push`. Os
`TourTarget` da Home desmontam e saem do registro; o `TourOverlay` fica sem
retângulo por um instante — mostra só o véu escurecido, sem recorte, até o
`profile-avatar` da nova tela montar e chamar `registerTarget`.

Também vale pra abertura manual ("Rever tutorial" em Configurações): se o
usuário estiver em qualquer tela que não seja a Home, `startTour()` primeiro
navega pra `/(app)/` antes de armar o passo 1.

O tour só dispara no layout compacto (`width < 1024`, o mesmo corte de
`lg` usado por `HomeHeader`/`Sidebar` no resto do app) — é nele que moram os 3
`TourTarget` de aba; no layout desktop a navegação principal é a `Sidebar`,
fora do escopo deste tour (pedido explicitamente como guia "para mobile").

## Tratamento de erros

- **Alvo nunca aparece** (ex.: `InstallPrompt` vira `null` no meio do tour
  porque o usuário instalou por conta própria): a condição de pulo do passo 5
  cobre o caso comum de entrada; como rede de segurança adicional, se um alvo
  não registrar em ~2s o tour avança pro próximo passo (ou encerra, se for o
  último) em vez de travar com véu sem recorte.
- **`PATCH tutorial_completed_at` falha:** best-effort, sem retry bloqueante —
  mesmo padrão de outras mutações de profile no app (loga erro, segue). Uma
  flag em memória no `TourProvider` evita reabrir o tour na mesma sessão
  mesmo se o PATCH falhar; na pior hipótese (falha + reload antes de
  persistir) o tour dispararia de novo no próximo primeiro-registro-do-app,
  o que é aceitável.

## Testes

Sem infra de screenshot/E2E visual no projeto hoje (mesmo padrão de outras
entregas no `docs/PLAN.md`). Verificação prevista:

- `npm run typecheck` e `npm run lint`.
- Testes unitários da lógica pura de sequenciamento (`next`/`skip`/condição
  de pulo do passo 5 quando `useInstallPrompt` já está `installed`/`native`).
- Checklist manual: Expo web (Chrome Android + Safari iOS) cobrindo o passo 5
  visível, e app nativo (iOS/Android) confirmando que o passo 5 não aparece.

## Decisões registradas (perguntas respondidas durante o brainstorm)

- Gatilho: fim do onboarding + primeiro registro feito no app (não "a
  qualquer momento futuro").
- Mecanismo visual: spotlight/coachmark sobre a UI real, não carrossel de
  telas estáticas.
- Persistência: servidor (`profiles.tutorial_completed_at`), não
  `AsyncStorage` local.
- Replay manual disponível em Configurações.
- Registro por WhatsApp ainda não existe no produto — fora de escopo do
  gatilho.
- Tour roda só no layout compacto (mobile/tablet, `width < 1024`) — no
  desktop a navegação é a `Sidebar`, fora de escopo.
- `history/[day]/new.tsx` (backfill de dia passado) não dispara o tour.
