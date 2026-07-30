# M16 — Máquina de estados do onboarding + paywall placeholder

Terceira fatia da Fase 4 (Motor de Metas & Onboarding Renovado). Depende de M14
(copy legal, concluído) e M15 (motor de cálculo + gates, concluído e mergeado
em `main`). Fonte: `docs/superpowers/specs/2026-07-14-onboarding-spec-original.md`
(Fase 3) e `docs/superpowers/specs/2026-07-14-fase-4-onboarding-master-plan-design.md`
(§7).

Decisões fechadas no brainstorm (não reabrir sem motivo forte):
- Resume real no servidor (tabela `onboarding_progress`), não client-only.
- Paywall só placeholder de UI — tela "em breve" com CTA único "Continuar",
  nunca bloqueia ninguém.
- Um spec só, sem fatiar M16 em sub-milestones.
- Sem A/B, sem feature flag, sem HealthKit nesta fase.
- Conteúdo clínico (triagem de TCA, condições de saúde) escrito conforme o
  spec original, marcado `// PENDENTE DE REVISÃO PROFISSIONAL` no código.

---

## 1. Arquitetura

### 1.1 Tabela `onboarding_progress`

```sql
CREATE TABLE public.onboarding_progress (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_block text NOT NULL,
  answers       jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS: owner_all (auth.uid() = user_id), USING + WITH CHECK.
```

`answers` é um snapshot solto (sem schema fixo) de todos os campos que o
Zustand store já tiver preenchido até aquele ponto — não valida nada, só
serve pra hidratar o client de volta. Validação de verdade continua
acontecendo em `OnboardingPayloadSchema` no momento do `POST
/onboarding/complete`.

### 1.2 Endpoints novos (`apps/server/src/routes/onboarding.ts`)

```
GET   /onboarding/progress   → 200 { progress: { current_block, answers, updated_at } | null }
PATCH /onboarding/progress   body { current_block: string, answers: Record<string, unknown> }
                              → 204. Upsert por user_id (ON CONFLICT DO UPDATE).
```

Zod: `PatchOnboardingProgressRequestSchema = z.object({ current_block:
z.string().min(1).max(50), answers: z.record(z.string(), z.unknown()) })`.
Ambos atrás de `authRequired`, mesma RLS-via-`supabaseForRequest` já usada no
resto do arquivo.

`POST /onboarding/complete` mantém a mesma assinatura de entrada — só ganha
mais campos opcionais no payload (§2). Ao suceder, `complete_onboarding_impl`
apaga a linha de `onboarding_progress` do usuário (não há mais o que
retomar: a conta já existe).

### 1.3 Engine declarativo (mobile)

`apps/mobile/lib/onboarding/blocks.ts`:

```ts
export type OnboardingBlockProps = {
  step: number;      // 1-based, só usado pelos blocos 1-15 (coleta de dados)
  total: number;      // = 15, idem
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void; // só presente quando o bloco é skippable
};

export type OnboardingBlockDef = {
  id: string;
  Component: ComponentType<OnboardingBlockProps>;
  skippable?: boolean;
};

export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  { id: "name", Component: NameBlock },
  { id: "basics", Component: BasicsBlock },
  { id: "height", Component: HeightBlock },
  { id: "weight", Component: WeightBlock },
  { id: "activity", Component: ActivityBlock },
  { id: "training", Component: TrainingBlock, skippable: true },
  { id: "habits", Component: HabitsBlock, skippable: true },
  { id: "goal", Component: GoalBlock },
  { id: "barriers", Component: BarriersBlock, skippable: true },
  { id: "diet", Component: DietBlock, skippable: true },
  { id: "health", Component: HealthBlock },
  { id: "permissions", Component: PermissionsBlock, skippable: true },
  { id: "contact", Component: ContactBlock },
  { id: "identity", Component: IdentityBlock },
  { id: "consent", Component: ConsentBlock },
  { id: "calculating", Component: CalculatingBlock },
  { id: "reveal", Component: RevealBlock },
  { id: "paywall", Component: PaywallBlock },
  { id: "first_meal", Component: FirstMealBlock },
];

export const DATA_BLOCK_COUNT = 15; // "name" .. "consent"
```

`app/(onboarding)/[block].tsx` substitui os 9 arquivos `step-N.tsx` atuais:

```tsx
export default function OnboardingBlockScreen() {
  const { block: blockId } = useLocalSearchParams<{ block: string }>();
  const index = ONBOARDING_BLOCKS.findIndex((b) => b.id === blockId);

  useEffect(() => {
    if (index === -1) router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[0].id}`);
  }, [index]);
  if (index === -1) return null;

  const block = ONBOARDING_BLOCKS[index];

  function goTo(id: string) { router.push(`/(onboarding)/${id}` as never); }

  function handleNext() {
    const next = ONBOARDING_BLOCKS[index + 1];
    if (index < DATA_BLOCK_COUNT) {
      void patchOnboardingProgress({
        current_block: next?.id ?? block.id,
        answers: useOnboardingStore.getState().toAnswers(),
      }); // fire-and-forget — nunca bloqueia a navegação
    }
    if (next) goTo(next.id);
  }

  function handleBack() {
    const prev = ONBOARDING_BLOCKS[index - 1];
    if (prev) goTo(prev.id);
    else router.replace("/(auth)/welcome");
  }

  const Component = block.Component;
  return (
    <Component
      step={index + 1}
      total={DATA_BLOCK_COUNT}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={block.skippable ? handleNext : undefined}
    />
  );
}
```

`app/(onboarding)/index.tsx` vira o gate de resume (única responsabilidade —
o conteúdo do antigo "nome" virou o bloco `name`):

```tsx
export default function OnboardingGate() {
  useEffect(() => {
    (async () => {
      const progress = await getOnboardingProgress(); // GET, null se não existe
      if (progress) {
        useOnboardingStore.getState().hydrate(progress.answers);
        router.replace(`/(onboarding)/${progress.current_block}` as never);
      } else {
        router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[0].id}` as never);
      }
    })();
  }, []);
  return <FullScreenSpinner />; // reaproveita o padrão de loading já usado em (app)/_layout.tsx
}
```

Cada bloco 1-15 continua com sua própria `<OnboardingStepShell>` (reaproveita
100% — `WheelPicker`, `DateInput`, `SegmentedControl` continuam exatamente
como estão, só trocam `router.push("/(onboarding)/step-N")` pelo `onNext`
injetado). Blocos 16-19 (`calculating`/`reveal`/`paywall`/`first_meal`) NÃO
usam `OnboardingStepShell` — são uma sequência de payoff, não um formulário,
então renderizam layout próprio full-bleed sem barra de progresso.

**Skippable**: `onSkip` é literalmente o mesmo `handleNext` — os campos do
bloco simplesmente ficam com seus defaults (não preenchidos) e o usuário
segue. Não existe validação bloqueante nesses 4 blocos.

### 1.4 Store (`useOnboardingStore`)

Dois métodos novos, além dos campos novos (§2):
- `toAnswers(): Record<string, unknown>` — snapshot solto de todo o estado
  atual (sem validar nada), usado pelo `PATCH /onboarding/progress`.
- `hydrate(answers: Record<string, unknown>): void` — `set(answers)` em
  lote, usado pelo gate de resume.

`toPayload()` (já existe) continua sendo o único ponto que valida
obrigatoriedade antes do `POST /onboarding/complete`.

### 1.5 Preview em tempo real (bloco `goal`)

`computeTargets` já é TS puro em `@fitbrother/shared`, que o mobile já
importa para os *types*. O bloco `goal` passa a importar a função também e
chama `computeTargets(buildLocalTargetsInput(store))` a cada mudança do
WheelPicker de peso-alvo/ritmo, só para renderizar a data projetada
(`hoje + kg_restante / rate_kg_per_week semanas`) — cálculo local,
instantâneo, sem round-trip. O servidor recalcula do zero na submissão final
e é a única fonte de verdade persistida; o preview client-side não tem
nenhum efeito de segurança (não decide `blocked`, não é enviado ao
servidor).

---

## 2. Contrato de dados — campos novos

### 2.1 `OnboardingPayloadSchema` (`packages/shared/src/schemas.ts`)

Adiciona, todos opcionais:

```ts
target_weight_kg: z.number().positive().max(500).optional(),
rate_kg_per_week: z.number().positive().max(2).optional(),
strength_training: z.boolean().optional(),
is_pregnant_or_lactating: z.boolean().optional(),
has_kidney_disease: z.boolean().optional(),
has_type1_diabetes: z.boolean().optional(),
uses_glp1: z.boolean().optional(),
tca_screening_positive: z.boolean().optional(),
onboarding_context: z.record(z.string(), z.unknown()).default({}),
```

`onboarding_context` carrega só o que **não** afeta o motor de cálculo e
ainda não tem consumidor (o M18 vai ler isso): `main_barriers: string[]`,
`dietary_restrictions: string[]`, `disliked_foods: string`, `budget:
string`, `meal_times: string`, `cooks_own_food: string`,
`eats_out_frequency: string`. Fica solto (não tipado campo-a-campo) porque
nenhuma dessas chaves precisa ser filtrável em SQL — só lida de volta como
blob pelo prompt de contexto da IA.

### 2.2 `buildTargetsInput` (`apps/server/src/services/targets.ts`)

Mapeia os 7 campos de cálculo (tudo exceto `onboarding_context`) do payload
pro `TargetsInput`, que já os aceita desde o M15 — só faltava alguém
preenchê-los.

### 2.3 Ligar `soft_mode` a uma experiência real

`evaluateSafetyGates` já é exportado por `apps/server/src/services/targets.ts`
mas hoje ninguém olha pro resultado além do gate `BLOCK` (interno ao
`computeTargets`). A rota `POST /onboarding/complete` passa a chamar
`evaluateSafetyGates` também, separadamente, e computar:

```ts
const gates = evaluateSafetyGates(targetsInput);
const soft_mode = gates.some((g) => g.severity === "SOFT_MODE");
```

`soft_mode` entra no payload da RPC. `complete_onboarding_impl` grava esse
valor em `profiles.soft_mode` no INSERT (hoje o default é sempre `false`,
ninguém escreve nele) e o devolve no `jsonb_build_object` de retorno. A rota
`POST /onboarding/complete` repassa esse `soft_mode` no corpo da resposta
HTTP (junto com `kcal`/`protein_g`/etc., que já são devolvidos hoje) — é
assim que o bloco `reveal` (§4) sabe, sem nenhuma chamada extra, se deve
esconder os números. Essa é a única gravação de `soft_mode` que existe no
sistema até este milestone — dali em diante, mudar de `true` pra `false` só
acontece manualmente pelo usuário (configurações, fora de escopo aqui).

### 2.4 Migrations novas (0061-0064)

- `0061_onboarding_progress.sql` — tabela + RLS (§1.1).
- `0062_anthropometrics_health_flags.sql` — `ALTER TABLE anthropometrics ADD
  COLUMN strength_training boolean, ADD COLUMN is_pregnant_or_lactating
  boolean, ADD COLUMN has_kidney_disease boolean, ADD COLUMN
  has_type1_diabetes boolean, ADD COLUMN uses_glp1 boolean, ADD COLUMN
  tca_screening_positive boolean` — todas nullable. `anthropometrics` já é a
  tabela versionada de "insumos do cálculo" (ganhou `target_weight_kg`/
  `rate_kg_per_week` no M15); essas 6 colunas completam o `TargetsInput` ali,
  prontas pra um recálculo futuro (M17) reler sem re-perguntar.
- `0063_profiles_onboarding_context.sql` — `ALTER TABLE profiles ADD COLUMN
  onboarding_context jsonb NOT NULL DEFAULT '{}'`.
- `0064_complete_onboarding_v3.sql` — reescreve `complete_onboarding_impl`
  (mesma função, `CREATE OR REPLACE`) pra: (a) inserir as 6 colunas novas de
  `anthropometrics` a partir do payload, (b) inserir `onboarding_context` em
  `profiles`, (c) inserir `soft_mode` em `profiles` a partir de
  `payload->>'soft_mode'`, (d) `DELETE FROM public.onboarding_progress WHERE
  user_id = uid;` no final, depois do `RETURN` ser montado (antes do
  `RETURN`, já que plpgsql executa em ordem).

---

## 3. Blocos existentes → novo formato

Migração 1:1, sem reescrever lógica de input — só a casca de navegação:

| Bloco novo | Arquivo atual | Mudança |
|---|---|---|
| `name` | `index.tsx` | Vira `NameBlock`, recebe `onNext/onBack` em vez de `router.push` fixo |
| `basics` | `step-2.tsx` | Idem (sexo + nascimento, `SegmentedControl` + `DateInput`) |
| `height` | `step-3.tsx` | Idem (`WheelPicker`) |
| `weight` | `step-4.tsx` | Idem (`WheelPicker`) |
| `activity` | `step-5.tsx` | Idem (cards de opção) |
| `goal` | `step-6.tsx` | Idem + extensão (§4) |
| `contact` | `step-7.tsx` | Idem (telefone/timezone/day_start_hour) |
| `identity` | `step-9.tsx` | Idem (username/avatar) |
| `consent` | `step-8.tsx` | Deixa de chamar `postOnboarding` direto — vira só os checkboxes; `onNext` (sempre habilitado quando os 3 consentimentos estão marcados) navega pro bloco `calculating`, que é quem chama `postOnboarding` de fato |

`ONBOARDING_STEPS` (constants.ts) é removido — `step`/`total` agora vêm do
engine (`DATA_BLOCK_COUNT = 15`).

---

## 4. Blocos novos — conteúdo

**`training`** (skippable) — "Sua rotina de treino". `WheelPicker` min=0
max=7 step=1 unit="treinos/semana" (default 0) + `SegmentedControl` com
Nenhum/Cardio/Força/Misto (default Nenhum). `strength_training = tipo ===
"Força" || tipo === "Misto"`.

**`habits`** (skippable) — "Seus hábitos alimentares". `SegmentedControl`
"Quem cozinha suas refeições?" (Eu mesmo/Outra pessoa/Varia) +
`SegmentedControl` "Come fora ou pede delivery?" (Raramente/Às
vezes/Frequentemente) + `Input` livre opcional "Horários que costuma comer"
(placeholder "ex: café 7h, almoço 12h, jantar 20h"). Tudo vai pra
`onboarding_context`, nada afeta o cálculo.

**`goal`** (extensão do `step-6.tsx` existente) — depois de escolher
lose/gain (não aparece para maintain/recomp, que não têm peso-alvo/ritmo no
motor de cálculo), revela inline: `WheelPicker` peso-alvo (min/max ± 100kg
do peso atual, default = peso atual) + `WheelPicker` ritmo min=0.1 max=1.0
step=0.1 unit="kg/semana" (default: 0.625% do peso pra lose, 0.375% pra
gain, igual ao `RATE_DEFAULT_PCT` do motor) + texto "Nesse ritmo, você
chega no peso-alvo em ~N semanas (DD/MM/AAAA)" recalculado a cada mudança
via `computeTargets` local (§1.5).

**`barriers`** (skippable) — "O que já te atrapalhou antes?". Chips
multi-select (reaproveita o padrão visual `Pressable` com borda
ativa/inativa dos cards de `step-5`/`step-6`, sem componente novo), máximo 3
selecionados: Falta de tempo, Fins de semana, Ansiedade/comer emocional,
Desisto rápido, Não sei o que comer, Comer fora com frequência. Vai pra
`onboarding_context.main_barriers`, não afeta cálculo.

**`diet`** (skippable) — "Sua alimentação". Chips multi-select "Restrições"
(Sem lactose, Sem glúten, Vegetariano, Vegano, Nenhuma) → `dietary_
restrictions`; `Input` livre opcional "Tem algum alimento que você evita ou
não gosta?" → `disliked_foods`; `SegmentedControl` "Orçamento pra comida"
(Apertado/Moderado/Confortável) → `budget`. Tudo em `onboarding_context`.

**`health`** — "Sua saúde, com cuidado" (não skippable, mas cada campo é
opcional/default-off, então "Avançar" sem tocar em nada é um "pular" de
fato). Checkboxes (mesmo padrão visual do `step-8.tsx` atual): "Estou
grávida ou amamentando" (só aparece se `sex === "female"`) →
`is_pregnant_or_lactating`; "Tenho doença renal diagnosticada" →
`has_kidney_disease`; "Tenho diabetes tipo 1" → `has_type1_diabetes`; "Uso
medicação para emagrecimento (ex: Ozempic, Mounjaro)" → `uses_glp1`. Depois,
triagem de TCA — 3 perguntas, cada uma com 3 opções (Sim/Não/Prefiro não
responder), tom neutro:
1. "Você sente que perde o controle sobre quanto come, mesmo sem fome física?"
2. "A preocupação com seu peso ou corpo atrapalha sua rotina no dia a dia?"
3. "Depois de comer mais do que planejava, você já se puniu com restrição severa ou exercício em excesso?"

`tca_screening_positive = true` se **qualquer** pergunta for respondida
"Sim" ("Prefiro não responder" conta como não-positivo, consistente com "sinal
fraco, não diagnóstico"). Marcar no código:
`// PENDENTE DE REVISÃO PROFISSIONAL — perguntas próprias, não reproduz instrumento clínico protegido.`

**`permissions`** (skippable) — "Notificações". Um botão "Ativar
notificações" chama `Notifications.requestPermissionsAsync()` (pacote já
instalado, sem dependência nova); resultado (concedido ou não) não é
enviado ao backend nem bloqueia o avanço — é só a chamada do SO. Botão
secundário "Agora não" = skip.

**`calculating`** — sem `OnboardingStepShell`, tela cheia com spinner/texto
("Calculando suas metas..."). Ao montar, dispara em paralelo `postOnboarding
(payload)` e um delay mínimo de 3s (`Promise.all`), guarda a resposta
(`kcal/protein_g/carbs_g/fat_g/warnings/blocked/block_reason`) num campo
efêmero do Zustand (não é persistido em `onboarding_progress` — nesse ponto
a conta já foi criada com sucesso) e navega pro `reveal`. Em caso de erro
(rede, 4xx/5xx), mostra mensagem + botão "Tentar de novo", permanece no
bloco `calculating`.

**`reveal`** — sem `OnboardingStepShell`. Lê o resultado efêmero do
`calculating`:
- Se `soft_mode` (devolvido pela resposta de `POST /onboarding/complete`,
  §2.3): não mostra nenhum número de caloria/macro. Mensagem focada em
  regularidade + oferta única de buscar apoio profissional, com menção ao
  CVV 188.
- Se `blocked`: mostra `block_reason` em vez de metas numéricas.
- Caso normal: kcal/proteína/carboidrato/gordura (reaproveita o visual do
  `ProgressRing` em modo estático, sem animação de progresso diário).
- Em qualquer um dos 3 casos, `<GoalsDisclaimer />` (M14) aparece no rodapé.

**`paywall`** — "Fitbrother Premium — em breve." Sem preço, sem produto
IAP. Um único botão "Continuar" que sempre avança — não há bifurcação
"grátis vs. pago" nesta fase.

**`first_meal`** — reaproveita o `MealComposer` existente (M2), com um
cabeçalho "Vamos registrar sua primeira refeição" ao redor. Ao concluir (ou
pular, se o composer já suporta isso), `router.replace("/(app)")`.

---

## 5. Resume

- `GET /onboarding/progress` sem linha → gate manda pro bloco `name`
  (primeiro do array), Zustand começa vazio (estado atual, sem mudança).
- Com linha → gate faz `hydrate(answers)` e `router.replace` direto pro
  `current_block` salvo — sem re-perguntar nada já respondido.
- Ao completar `POST /onboarding/complete` com sucesso, o servidor apaga a
  linha (§2.4). Blocos 16-19 (`calculating`→`first_meal`) não têm resume
  próprio: se o app fechar ali, a conta já existe (perfil + metas já
  persistidos) e o gate de entrada do app (`(app)/_layout.tsx`, fora deste
  escopo) manda o usuário direto pro `(app)` na próxima abertura — perde só
  a cauda de celebração (reveal/paywall/first_meal), nunca dados.

---

## 6. `soft_mode` na UI — os 4 pontos mapeados

`useProfile()` já expõe `profile.soft_mode` (a rota `/me` já faz `select("*")`
em `profiles`, que já tem a coluna desde o M15 — nenhuma mudança de backend
extra além de tipar `soft_mode: boolean` em `apps/mobile/lib/profile/types.ts`).

- **`TodaySummaryHeader.tsx`** (`apps/mobile/app/(app)/index.tsx` e
  `history/[day]/index.tsx`) — novo prop `softMode?: boolean`. Quando true,
  não renderiza os 4 `ProgressRing` (kcal + 3 macros); renderiza em vez
  disso uma contagem neutra ("N refeições registradas hoje").
- **`HistoryDayCard.tsx`** — novo prop `softMode?: boolean`. Quando true,
  `heroLabel` vira `"${mealsLabel}"` sem kcal, e os 3 `MacroBar` não
  renderizam.
- **`StreakCounter.tsx`** — chamado só por `HomeHeader.tsx`; quando
  `profile.soft_mode`, `HomeHeader` simplesmente não renderiza
  `<StreakCounter/>` (sem pressão de aderência, por completo, não só o
  número).
- **`InsightCard.tsx`** — já trata `p.score !== null` condicionalmente; o
  gerador de insights (M8.2, fora de escopo aqui) é quem decide se popula
  `score` — para soft_mode, os prompts de geração de insight (fora deste
  milestone) devem passar `score: null`. **Não é alterado neste milestone**
  além de confirmar que o componente já suporta `score: null` (já suporta).

Os 3 primeiros pontos recebem `softMode={profile.soft_mode}` nos call sites
já mapeados acima (`(app)/index.tsx`, `history/index.tsx`,
`history/[day]/index.tsx`, `HomeHeader.tsx`), lendo de `useProfile()`.

---

## 7. Testes

Sem Vitest em `apps/server` ainda (só existe em `packages/shared`, decisão
do M15) — mantém o mesmo padrão de verificação do M15 pra tudo que é SQL/rota:

- **`packages/shared`**: nenhuma mudança de lógica de cálculo — só schema
  (`OnboardingPayloadSchema`), que não tem teste próprio hoje (é validado
  via `apps/server`'s smoke test). Sem teste novo aqui.
- **SQL smoke test** (transação com `ROLLBACK`, mesmo padrão do M15): chama
  `complete_onboarding` com um payload incluindo os campos novos (health
  flags, `onboarding_context`, `target_weight_kg`/`rate_kg_per_week`, um
  caso com `tca_screening_positive: true`) e confere que `anthropometrics`,
  `profiles.onboarding_context`, `profiles.soft_mode` e o `DELETE` de
  `onboarding_progress` aconteceram como esperado.
- **HTTP end-to-end real** (Supabase Auth real + JWT real, mesmo padrão do
  M15): fluxo completo `PATCH /onboarding/progress` (algumas vezes,
  simulando avanço de blocos) → `GET /onboarding/progress` (confere
  `current_block`/`answers` batendo) → `POST /onboarding/complete` →
  `GET /onboarding/progress` de novo (confere que a linha sumiu).
- **Typecheck + lint** do monorepo inteiro (inclui os arquivos novos de
  `apps/mobile`) — critério de "feito", igual M14/M15.

Não há verificação automatizada de UI neste milestone (sem Detox/Playwright
no projeto) — a verificação manual via Expo (ou `preview_start`, se
disponível) cobre o "feito quando" de navegação/resume.

---

## 8. Feito quando

- Onboarding completo ponta a ponta (blocos 1-19) usando dados reais leva a
  uma conta funcional em `(app)`.
- Fechar o app no meio de qualquer bloco 1-15 e reabrir retoma exatamente
  onde parou (mesma conta, mesmo dispositivo — múltiplos dispositivos
  também funcionam, já que o resume é 100% servidor).
- Gate `BLOCK` (ex.: idade <18 + objetivo perder) faz o `reveal` mostrar
  `block_reason` em vez de metas numéricas.
- Gate `SOFT_MODE` (triagem de TCA positiva) grava `profiles.soft_mode =
  true` e o `reveal`, `TodaySummaryHeader`, `HistoryDayCard` e
  `StreakCounter` refletem isso imediatamente após o onboarding.
- Paywall aparece sem cobrar nada, com um único CTA que sempre avança.
- Typecheck + lint do monorepo inteiro passam.

---

## 9. Fora de escopo (explicitamente adiado)

- M17 (migração de usuários existentes) — os 6 campos novos de
  `anthropometrics` ficam `NULL` pra quem já tem conta; `evaluateSafetyGates`
  rodar retroativamente sobre a base existente é tarefa do M17, não daqui.
- M18 (contexto pra IA) — `onboarding_context` só é gravado aqui; nada nesta
  fase lê ou usa esse jsonb em prompts.
- Tela de configurações para o usuário reverter `soft_mode` manualmente —
  mencionada no spec original, mas não faz parte do fluxo de onboarding.
- A/B contra o onboarding antigo — descartado no brainstorm da Fase 4.
- HealthKit — descartado no brainstorm da Fase 4.
