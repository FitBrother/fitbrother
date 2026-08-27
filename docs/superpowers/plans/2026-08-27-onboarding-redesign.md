# Redesign do onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (execução inline, decisão do usuário). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reordenar o onboarding pra anamnese → preview de metas (motivação) → criação de conta, cortar a triagem de TCA e as 4 telas de "Rotina" (treino/hábitos/barreiras/dieta), e trocar o visual de `OnboardingStepShell` pelo shell de capítulos (painel lateral no desktop, card com progresso segmentado, nav com botão circular + CTA full-width) do template `templates/onboarding/Onboarding.dc.html`.

**Architecture:** Sessão anônima do Supabase (`signInAnonymously`) criada ao entrar no onboarding, promovida a conta real (`updateUser`) num novo bloco `signup` no fim da anamnese — mesmo `auth.uid()`, mesmo mecanismo de resume via `onboarding_progress` que já existe. `calculating`/`reveal` (capítulo 3) viram preview 100% local (`computeTargets`/`evaluateSafetyGates`, já client-side hoje); a persistência real (`postOnboarding`) migra pra um novo bloco `submitting`, depois do `consent`. `ONBOARDING_BLOCKS` ganha um campo `chapter` opcional que o novo `OnboardingChapterShell` usa pra decidir se mostra painel lateral + progresso segmentado (Fase A) ou só card+nav (Fase B/C).

**Tech Stack:** Expo Router (`(onboarding)/[block].tsx`, já existe), Zustand (`useOnboardingStore`), NativeWind v4 (`md:`/`lg:` — reaproveita os breakpoints padrão já usados no resto do app, não os valores exatos de px do template CSS), Supabase Auth (`signInAnonymously`/`updateUser`), `@fitbrother/shared` (`computeTargets`/`evaluateSafetyGates`, já puros/client-safe).

Referência: `docs/superpowers/specs/2026-08-27-onboarding-redesign-design.md` (spec completa). Este plano reabre partes do M16 (`docs/superpowers/plans/2026-07-14-m16-onboarding-state-machine.md`) — a arquitetura de resume/engine declarativo do M16 continua valendo, só a ordem/conteúdo dos blocos muda.

## Global Constraints

- Tipografia: `font-sans`/`font-sans-medium`/`font-sans-semibold`/`font-sans-bold`/`font-sans-extrabold` — nunca `font-medium`/`font-semibold`/`font-bold`.
- Números (kcal, gramas) sempre com `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores só via `@/lib/colors` ou classes Tailwind — nunca hex inline em JSX.
- Hit target mínimo 44×44 pt em todo `Pressable` (botão circular de voltar usa 52×52, já acima do mínimo).
- `accessibilityLabel` obrigatório em botões só-ícone; `accessibilityRole` em todo interativo.
- Sem `dark:` em código novo. Ícones só `lucide-react-native`. Sem `<div>`/`<h1>` — só `View`/`Text`/`Pressable`.
- Sombra: `Platform.select({ ios: {...}, android: { elevation }, default: {} })`, igual `Card.tsx` — nunca `boxShadow` CSS.
- Breakpoints reaproveitam os padrões do Tailwind já usados no resto do app (`sm`=640, `md`=768, `lg`=1024) — o painel lateral do template (que usa 1000px) aparece em `lg:` (1024px), não num breakpoint customizado novo.
- Migrations são imutáveis depois de merged — não se aplica aqui (nenhuma migration SQL neste plano).
- `apps/server` não tem Vitest — verificação de rota é smoke test manual (mesmo padrão do M16).

---

## Task 1: Remover `tca_screening_positive` de `packages/shared`

**Files:**
- Modify: `packages/shared/src/schemas.ts:311`
- Modify: `packages/shared/src/targets/types.ts:20`
- Modify: `packages/shared/src/targets/gates.ts:60-66`
- Modify: `packages/shared/src/targets/gates.test.ts:62-65`
- Modify: `packages/shared/src/targets/compute-targets.test.ts:127`

**Interfaces:**
- Produces: `OnboardingPayload` e `TargetsInput` deixam de ter `tca_screening_positive`. `evaluateSafetyGates` nunca mais retorna `severity: "SOFT_MODE"` (o type `GateSeverity` continua incluindo `"SOFT_MODE"` — não removido, só inatingível).

- [ ] **Step 1: Remover do schema**

Em `packages/shared/src/schemas.ts`, remova a linha 311 inteira:

```ts
  tca_screening_positive: z.boolean().optional(),
```

- [ ] **Step 2: Remover de `TargetsInput`**

Em `packages/shared/src/targets/types.ts`, remova a linha 20 (`tca_screening_positive?: boolean;`) e ajuste o comentário da linha 12, que ficou impreciso:

```ts
export type TargetsInput = {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  // Opcionais — ausentes = gate correspondente não dispara.
  target_weight_kg?: number;
  rate_kg_per_week?: number;
  strength_training?: boolean;
  is_pregnant_or_lactating?: boolean;
  has_kidney_disease?: boolean;
  has_type1_diabetes?: boolean;
  uses_glp1?: boolean;
};
```

- [ ] **Step 3: Remover o gate**

Em `packages/shared/src/targets/gates.ts`, remova o bloco inteiro (linhas 60-66):

```ts
  if (input.tca_screening_positive === true) {
    gates.push({
      condition: "tca_screening_positive",
      severity: "SOFT_MODE",
      message: "Triagem de TCA positiva — modo suave ativado.",
    });
  }

```

- [ ] **Step 4: Atualizar `gates.test.ts`**

Remova o teste das linhas 62-65 (`"SOFT_MODE quando triagem de TCA é positiva"`):

```ts
  it("SOFT_MODE quando triagem de TCA é positiva", () => {
    const gates = evaluateSafetyGates({ ...BASE, tca_screening_positive: true });
    expect(gates.some((g) => g.severity === "SOFT_MODE")).toBe(true);
  });

```

- [ ] **Step 5: Atualizar `compute-targets.test.ts`**

Leia `packages/shared/src/targets/compute-targets.test.ts` ao redor da linha 127 e remova a linha `tca_screening_positive: true,` do objeto de input do teste ali (o teste em si continua, só perde esse campo do payload de entrada — se o teste dependia de `soft_mode`/comportamento causado por esse campo, ajuste a asserção pra não depender mais dele; se era só um campo extra no objeto de teste sem asserção própria, é só remover a linha).

- [ ] **Step 6: Rodar os testes**

Run: `npm run test --workspace packages/shared`
Expected: todos os testes passam, nenhum menciona mais `tca_screening_positive`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck --workspace packages/shared`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/targets/types.ts packages/shared/src/targets/gates.ts packages/shared/src/targets/gates.test.ts packages/shared/src/targets/compute-targets.test.ts
git commit -m "refactor(shared): remove tca_screening_positive — triagem de TCA sai do onboarding"
```

---

## Task 2: Remover `tca_screening_positive` do servidor

**Files:**
- Modify: `apps/server/src/services/targets.ts:36`

**Interfaces:**
- Consumes: `OnboardingPayload`/`TargetsInput` sem o campo (Task 1).

- [ ] **Step 1: Remover a linha do mapeamento**

Em `apps/server/src/services/targets.ts`, dentro de `buildTargetsInput`, remova a linha:

```ts
    tca_screening_positive: payload.tca_screening_positive,
```

- [ ] **Step 2: Build do shared + typecheck do server**

Run: `npm run build --workspace packages/shared && npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/targets.ts
git commit -m "refactor(server): buildTargetsInput não mapeia mais tca_screening_positive"
```

---

## Task 3: Tipos do engine — campo `chapter`

**Files:**
- Modify: `apps/mobile/lib/onboarding/types.ts`

**Interfaces:**
- Produces: `OnboardingBlockProps` ganha `chapter?: { num: 1 | 2 | 3; name: string }`. `OnboardingBlockDef` ganha `chapter?: 1 | 2 | 3`. Novo `CHAPTER_NAMES`/`CHAPTER_TOTAL` — consumidos por `blocks.ts` (Task 17), `[block].tsx` (Task 18) e `OnboardingChapterShell` (Task 4). Ficam em `types.ts` (não em `blocks.ts`) porque `blocks.ts` importa todos os componentes de bloco, que por sua vez importam o shell — colocar as constantes em `blocks.ts` criaria import circular com o shell.

- [ ] **Step 1: Reescrever o arquivo**

```ts
import type { ComponentType } from "react";

export type OnboardingBlockProps = {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  /** Presente só nos blocos da Fase A (capítulos 1-3) — dirige o painel
   * lateral e a barra de progresso segmentada do OnboardingChapterShell. */
  chapter?: { num: 1 | 2 | 3; name: string };
};

export type OnboardingBlockDef = {
  id: string;
  Component: ComponentType<OnboardingBlockProps>;
  skippable?: boolean;
  /** undefined = bloco de Fase B/C: sem painel lateral, sem progresso segmentado. */
  chapter?: 1 | 2 | 3;
};

export const CHAPTER_NAMES: Record<1 | 2 | 3, string> = {
  1: "Você",
  2: "Objetivo",
  3: "Metas",
};

export const CHAPTER_TOTAL = 3;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: falha esperada aqui — nada mais no repo usa `chapter` ainda, mas o arquivo em si compila sozinho. Confirme rodando só a checagem de sintaxe: `npx tsc --noEmit apps/mobile/lib/onboarding/types.ts --jsx react-native --esModuleInterop` não é necessário; o `typecheck` do workspace inteiro pode reportar erros nos blocos existentes até a Task 17 religar tudo — isso é esperado neste ponto do plano (tasks intermediárias deixam o typecheck do workspace quebrado; só volta a passar limpo depois da Task 19). Não trate isso como falha desta task.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/onboarding/types.ts
git commit -m "feat(mobile): OnboardingBlockProps/Def ganham chapter, CHAPTER_NAMES/TOTAL novos"
```

---

## Task 4: `OnboardingChapterShell` — novo componente

**Files:**
- Create: `apps/mobile/components/onboarding/OnboardingChapterShell.tsx`

**Interfaces:**
- Consumes: `CHAPTER_NAMES`, `CHAPTER_TOTAL` (Task 3), `colors` (`@/lib/colors`), `Button` (`@/components/Button`).
- Produces: `OnboardingChapterShell` — usado por todo bloco de `name` até `first_meal` a partir da Task 5 em diante, substituindo `OnboardingStepShell`.

- [ ] **Step 1: Escrever o componente**

```tsx
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import { CHAPTER_NAMES, CHAPTER_TOTAL } from "@/lib/onboarding/types";

const shadowStyleElevated = Platform.select({
  ios: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

interface OnboardingChapterShellProps {
  /** Presente só na Fase A (capítulos 1-3) — liga o painel lateral (desktop)
   * e a barra de progresso segmentada. Ausente = Fase B/C: só card + nav. */
  chapter?: { num: 1 | 2 | 3; name: string };
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  onSkip?: () => void;
  /** false pros blocos de payoff (calculating/reveal) — sem botão voltar/continuar. */
  showNav?: boolean;
  /** false quando o conteúdo é um WheelPicker (mesma ressalva do OnboardingStepShell
   * original: FlatList dentro de ScrollView quebra o windowing no RN). */
  scrollable?: boolean;
}

export function OnboardingChapterShell({
  chapter,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextDisabled,
  onSkip,
  showNav = true,
  scrollable = true,
}: OnboardingChapterShellProps) {
  const card = (
    <View
      className="mx-auto w-full max-w-[560px] flex-1 px-5 py-6 sm:my-8 sm:flex-none sm:rounded-2xl sm:bg-white sm:p-10"
      style={shadowStyleElevated}
    >
      {chapter && (
        <>
          <View className="mb-3 flex-row gap-2.5">
            {[1, 2, 3].map((n) => (
              <View key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100">
                {n <= chapter.num && <View className="h-full w-full bg-primary-400" />}
              </View>
            ))}
          </View>
          <Text className="text-xs font-sans-medium text-neutral-500">
            Capítulo {chapter.num} de {CHAPTER_TOTAL} · {chapter.name}
          </Text>
        </>
      )}

      <View className="mt-7">
        <Text className="mb-2 text-3xl font-display-bold text-neutral-800">{title}</Text>
        {subtitle && <Text className="text-base font-sans text-neutral-600">{subtitle}</Text>}
      </View>

      <View className="mt-7 flex-1">{children}</View>

      {showNav && (
        <View className="mt-8 flex-row items-center gap-4">
          <Pressable
            onPress={onBack}
            disabled={!onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white active:bg-neutral-50"
            style={shadowStyleElevated}
          >
            <ChevronLeft size={20} color={colors.neutral[800]} />
          </Pressable>
          <View className="flex-1">
            <Button
              label="Continuar"
              variant="primary"
              size="lg"
              disabled={nextDisabled || !onNext}
              onPress={onNext}
            />
          </View>
        </View>
      )}

      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular esse passo
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 flex-row">
        {chapter && (
          <View
            className="hidden w-[300px] justify-between bg-white px-6 py-10 lg:flex"
            style={shadowStyleElevated}
          >
            <View className="gap-8">
              <Text className="text-xl font-display-bold text-primary-400">Fitbrother</Text>
              <View>
                <Text className="font-display-bold text-2xl leading-tight text-neutral-800">
                  Vamos montar suas metas.
                </Text>
                <Text className="mt-2.5 text-sm text-neutral-600">
                  Três capítulos curtos. Nada aqui é definitivo — você ajusta tudo depois, quando
                  quiser.
                </Text>
              </View>
              <View className="gap-1">
                {([1, 2, 3] as const).map((n) => {
                  const done = n < chapter.num;
                  const active = n === chapter.num;
                  return (
                    <View
                      key={n}
                      className={`flex-row items-center gap-3 rounded-xl px-3 py-2 ${
                        active ? "bg-primary-50" : ""
                      }`}
                    >
                      <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-neutral-100">
                        {done && <View className="h-2 w-2 rounded-full bg-primary-400" />}
                        {active && <View className="h-2 w-2 rounded-full bg-primary-400" />}
                      </View>
                      <Text className="font-sans-medium text-base text-neutral-700">
                        {CHAPTER_NAMES[n]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <Text className="text-xs text-neutral-500">
              Seus dados servem só para calcular suas metas. Você pode exportar ou apagar tudo a
              qualquer momento.
            </Text>
          </View>
        )}

        <View className="flex-1">
          {!chapter && (
            <View className="items-center px-5 pb-2 pt-4 lg:hidden">
              <Text className="text-lg font-display-bold text-neutral-800">Fitbrother</Text>
            </View>
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            {scrollable ? (
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
              >
                {card}
              </ScrollView>
            ) : (
              card
            )}
          </KeyboardAvoidingView>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: este arquivo novo compila (mesma ressalva da Task 3 — o resto do onboarding ainda não foi migrado, então o workspace como um todo pode ter erros noutros arquivos até a Task 19; confira especificamente que não há erro apontando pra `OnboardingChapterShell.tsx`).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/OnboardingChapterShell.tsx
git commit -m "feat(mobile): novo OnboardingChapterShell (painel de capítulos + card + nav)"
```

---

## Task 5: `HealthBlock` — remove TCA, vira pulável, troca shell

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/HealthBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingChapterShell` (Task 4).
- Produces: `HealthBlock` sem `tca_screening_positive`, aceita `onSkip`/`chapter` (repassados pelo container na Task 18).

- [ ] **Step 1: Reescrever o arquivo**

```tsx
import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const CONDITIONS = [
  {
    key: "is_pregnant_or_lactating" as const,
    label: "Estou grávida ou amamentando",
    femaleOnly: true,
  },
  { key: "has_kidney_disease" as const, label: "Tenho doença renal diagnosticada" },
  { key: "has_type1_diabetes" as const, label: "Tenho diabetes tipo 1" },
  {
    key: "uses_glp1" as const,
    label: "Uso medicação para emagrecimento (ex: Ozempic, Mounjaro)",
  },
];

export function HealthBlock({ step, total, onNext, onBack, onSkip, chapter }: OnboardingBlockProps) {
  const sex = useOnboardingStore((s) => s.sex);
  const is_pregnant_or_lactating = useOnboardingStore((s) => s.is_pregnant_or_lactating);
  const has_kidney_disease = useOnboardingStore((s) => s.has_kidney_disease);
  const has_type1_diabetes = useOnboardingStore((s) => s.has_type1_diabetes);
  const uses_glp1 = useOnboardingStore((s) => s.uses_glp1);
  const setField = useOnboardingStore((s) => s.setField);

  type ConditionKey =
    | "is_pregnant_or_lactating"
    | "has_kidney_disease"
    | "has_type1_diabetes"
    | "uses_glp1";

  const conditionValues: Record<ConditionKey, boolean> = {
    is_pregnant_or_lactating,
    has_kidney_disease,
    has_type1_diabetes,
    uses_glp1,
  };

  function toggleCondition(key: ConditionKey) {
    setField(key, !conditionValues[key]);
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Sua saúde, com cuidado"
      subtitle="Leva 10 segundos, e só pra manter suas metas seguras — pode pular."
      onBack={onBack}
      onNext={onNext}
      onSkip={onSkip}
    >
      <View className="gap-3">
        {CONDITIONS.filter((c) => !c.femaleOnly || sex === "female").map((c) => {
          const checked = conditionValues[c.key];
          return (
            <Pressable
              key={c.key}
              onPress={() => toggleCondition(c.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-md border ${
                  checked ? "border-primary-400 bg-primary-400" : "border-neutral-300 bg-white"
                }`}
              >
                {checked && <Check size={16} color={colors.white} />}
              </View>
              <Text className="flex-1 text-sm font-sans text-neutral-800">{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingChapterShell>
  );
}
```

(Removidos: `TCA_QUESTIONS`, `TCA_OPTIONS`, o `useState` de `tcaAnswers`, a função `answerTca`, o bloco de renderização das 3 perguntas, e o comentário `PENDENTE DE REVISÃO PROFISSIONAL` do topo do arquivo original — não sobra triagem de TCA nenhuma.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erro apontando pra `HealthBlock.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/HealthBlock.tsx
git commit -m "refactor(mobile): HealthBlock sem TCA, pulável, usa OnboardingChapterShell"
```

---

## Task 6: Capítulo 1 — `NameBlock`, `BasicsBlock`, `HeightBlock`, `WeightBlock`, `ActivityBlock`

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/NameBlock.tsx`
- Modify: `apps/mobile/components/onboarding/blocks/BasicsBlock.tsx`
- Modify: `apps/mobile/components/onboarding/blocks/HeightBlock.tsx`
- Modify: `apps/mobile/components/onboarding/blocks/WeightBlock.tsx`
- Modify: `apps/mobile/components/onboarding/blocks/ActivityBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingChapterShell` (Task 4).

Migração mecânica idêntica nos 5 arquivos: troca o import e a tag `OnboardingStepShell` por `OnboardingChapterShell`, e repassa `chapter` (novo prop recebido de `OnboardingBlockProps`) pro shell. Nenhuma outra linha muda.

- [ ] **Step 1: `NameBlock.tsx`**

Troque a linha do import:
```ts
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
```
por:
```ts
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
```

Troque a assinatura da função (adiciona `chapter`):
```tsx
export function NameBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura/fechamento `<OnboardingStepShell ...>`/`</OnboardingStepShell>` por `<OnboardingChapterShell chapter={chapter} ...>`/`</OnboardingChapterShell>`, mantendo `title`/`subtitle`/`onBack`/`onNext`/`nextDisabled` como estão hoje (remove `step`/`total`, que o novo shell não usa).

- [ ] **Step 2: `BasicsBlock.tsx`**

Troque o import:
```ts
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
```
por:
```ts
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
```

Troque a assinatura:
```tsx
export function BasicsBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
```
por:
```tsx
export function BasicsBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura:
```tsx
    <OnboardingStepShell
      step={step}
      total={total}
      title="Conta um pouco sobre você"
      subtitle="Sexo biológico e data de nascimento — calculamos o gasto calórico com eles."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!sex || !dateValid}
    >
```
por:
```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="Conta um pouco sobre você"
      subtitle="Sexo biológico e data de nascimento — calculamos o gasto calórico com eles."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!sex || !dateValid}
    >
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`.

- [ ] **Step 3: `HeightBlock.tsx`**

Troque o import (mesma linha de/pra do Step 2). Troque a assinatura:
```tsx
export function HeightBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
```
por:
```tsx
export function HeightBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura (mantendo `scrollable={false}`):
```tsx
    <OnboardingStepShell
      step={step}
      total={total}
      title="Qual sua altura?"
      subtitle="Em centímetros."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
```
por:
```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual sua altura?"
      subtitle="Em centímetros."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`.

- [ ] **Step 4: `WeightBlock.tsx`**

Troque o import (mesma linha de/pra do Step 2). Troque a assinatura:
```tsx
export function WeightBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
```
por:
```tsx
export function WeightBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura (mantendo `scrollable={false}`):
```tsx
    <OnboardingStepShell
      step={step}
      total={total}
      title="E seu peso atual?"
      subtitle="Em quilos. Você pode atualizar isso a qualquer momento."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
```
por:
```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="E seu peso atual?"
      subtitle="Em quilos. Você pode atualizar isso a qualquer momento."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`.

- [ ] **Step 5: `ActivityBlock.tsx`**

Troque o import (mesma linha de/pra do Step 2). Troque a assinatura:
```tsx
export function ActivityBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
```
por:
```tsx
export function ActivityBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura:
```tsx
    <OnboardingStepShell
      step={step}
      total={total}
      title="Qual seu nível de atividade?"
      subtitle="Isso ajusta o gasto calórico diário (TDEE)."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!activity_level}
    >
```
por:
```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual seu nível de atividade?"
      subtitle="Isso ajusta o gasto calórico diário (TDEE)."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!activity_level}
    >
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erro nos 5 arquivos.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/NameBlock.tsx apps/mobile/components/onboarding/blocks/BasicsBlock.tsx apps/mobile/components/onboarding/blocks/HeightBlock.tsx apps/mobile/components/onboarding/blocks/WeightBlock.tsx apps/mobile/components/onboarding/blocks/ActivityBlock.tsx
git commit -m "refactor(mobile): capítulo 1 (name/basics/height/weight/activity) usa OnboardingChapterShell"
```

---

## Task 7: Capítulo 2 — `GoalBlock`

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/GoalBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingChapterShell` (Task 4).

- [ ] **Step 1: Trocar shell**

Troque o import:
```ts
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
```
por:
```ts
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
```

Troque a assinatura:
```tsx
export function GoalBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
```
por:
```tsx
export function GoalBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura:
```tsx
    <OnboardingStepShell
      step={step}
      total={total}
      title="Qual seu objetivo?"
      subtitle="Define as metas iniciais de calorias e macros."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!goal}
    >
```
por:
```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual seu objetivo?"
      subtitle="Define as metas iniciais de calorias e macros."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!goal}
    >
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`. Nenhuma outra lógica do arquivo (radio de goal, WheelPickers condicionais, `computeTargets` local pro preview de data) muda.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erro em `GoalBlock.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/GoalBlock.tsx
git commit -m "refactor(mobile): GoalBlock usa OnboardingChapterShell"
```

---

## Task 8: `useOnboardingStore` — remove `tca_screening_positive`

**Files:**
- Modify: `apps/mobile/lib/stores/onboardingStore.ts`

**Interfaces:**
- Produces: `OnboardingState` sem `tca_screening_positive` em nenhum lugar (state, `INITIAL`, `toAnswers`, `toPayload`).

- [ ] **Step 1: Remover do type `OnboardingState`**

Remova a linha:
```ts
  tca_screening_positive: boolean;
```

- [ ] **Step 2: Remover de `INITIAL`**

Remova a linha:
```ts
  tca_screening_positive: false,
```

- [ ] **Step 3: Remover de `toAnswers()`**

Remova a linha:
```ts
      tca_screening_positive: s.tca_screening_positive,
```

- [ ] **Step 4: Remover de `toPayload()`**

Remova a linha:
```ts
      tca_screening_positive: s.tca_screening_positive,
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erro em `onboardingStore.ts` (o `OnboardingPayload` já não tem mais esse campo desde a Task 1, então `toPayload()` continua batendo com o tipo).

- [ ] **Step 6: Rodar o teste do store**

Run: `npm run test --workspace apps/mobile -- onboardingStore`
Expected: `apps/mobile/lib/onboardingStore.test.ts` passa. Se algum teste ali referenciar `tca_screening_positive`, remova a referência (mesmo tratamento da Task 1/Step 5 — ajuste a asserção sem mudar o que o teste verifica de fato).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/stores/onboardingStore.ts apps/mobile/lib/onboardingStore.test.ts
git commit -m "refactor(mobile): onboardingStore sem tca_screening_positive"
```

---

## Task 9: `Welcome.tsx` — sessão anônima em vez de ir pro sign-up

**Files:**
- Modify: `apps/mobile/app/(auth)/welcome.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInAnonymously()` (`@/lib/supabase`, client já existe e é usado em todo o app).
- Produces: botão "Criar conta" agora entra direto no onboarding com uma sessão válida.

- [ ] **Step 1: Reescrever o arquivo**

```tsx
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { supabase } from "@/lib/supabase";

export default function Welcome() {
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      router.push("/(onboarding)");
    } catch {
      setStarting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-1 justify-between p-12">
        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-5xl font-display-bold text-primary-400">Fitbrother</Text>
          <Text className="text-center text-base font-sans text-neutral-600">
            Nutrição com IA. Registre suas refeições em linguagem natural — texto ou áudio.
          </Text>
        </View>

        <View className="gap-3">
          <Button
            label="Criar conta"
            variant="primary"
            rightIcon={<ArrowRight size={18} color="#fff" />}
            loading={starting}
            onPress={handleStart}
          />
          <Button
            label="Já tenho conta"
            variant="outline"
            onPress={() => router.push("/(auth)/sign-in")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
```

Nota: se `signInAnonymously()` falhar (ex.: rede fora do ar), o botão só volta ao estado normal sem navegar — sem toast dedicado aqui porque não há `ToastProvider` fora do layout autenticado neste ponto da árvore; o usuário só tenta de novo. Isso é aceitável pra esse caso raro (falha de rede logo na primeira tela).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/welcome.tsx
git commit -m "feat(mobile): Welcome cria sessão anônima e vai direto pro onboarding"
```

---

## Task 10: `SignupBlock` — novo bloco (promove sessão anônima)

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/SignupBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingChapterShell` (Task 4), `Input`/`PasswordInput`/`passwordStrength` (`@/components/Input`, `@/components/PasswordInput`), `supabase.auth.updateUser` (`@/lib/supabase`).
- Produces: `SignupBlock`, referenciado pelo array na Task 17.

- [ ] **Step 1: Escrever o componente**

```tsx
import { useRef, useState } from "react";
import { type TextInput, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { PasswordInput, passwordStrength } from "@/components/PasswordInput";
import { supabase } from "@/lib/supabase";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

// Cheap RFC-5322-adjacent check — a confirmação por e-mail é o validador de verdade.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalizedEmail);
  const passwordValid = passwordStrength(password) >= 2;
  const canSubmit = emailValid && passwordValid && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      onNext();
    } catch {
      setError("Não foi possível criar a conta. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Crie sua conta"
      subtitle="Pra salvar as metas que você acabou de ver e continuar de onde parou."
      onBack={onBack}
      onNext={handleSubmit}
      nextDisabled={!canSubmit}
    >
      <View className="gap-3">
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="email-address"
          inputMode="email"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="voce@exemplo.com"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          error={emailTouched && !emailValid && email.length > 0 ? "E-mail inválido" : undefined}
        />
        <PasswordInput
          ref={passwordRef}
          label="Senha"
          value={password}
          onChangeText={setPassword}
          showStrength
          autoComplete="password-new"
          textContentType="newPassword"
          passwordRules="minlength: 8;"
          placeholder="Crie uma senha segura"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        {error && (
          <View className="rounded-xl border border-danger-600 bg-danger-50 p-3">
            <Text className="text-sm font-sans text-danger-600">{error}</Text>
          </View>
        )}
      </View>
    </OnboardingChapterShell>
  );
}
```

(Mesmo padrão de mensagem de erro do `sign-up.tsx` original, que está sendo removido na Task 11 — reaproveitado aqui ao pé da letra.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros em `SignupBlock.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/SignupBlock.tsx
git commit -m "feat(mobile): novo SignupBlock — promove sessão anônima pra conta real"
```

---

## Task 11: Remover `(auth)/sign-up.tsx`

**Files:**
- Delete: `apps/mobile/app/(auth)/sign-up.tsx`

**Interfaces:**
- Nenhuma — confirmado por busca no repo (`grep -rn "(auth)/sign-up"`) que a única referência era `welcome.tsx`, já trocada na Task 9.

- [ ] **Step 1: Apagar o arquivo**

```bash
rm apps/mobile/app/\(auth\)/sign-up.tsx
```

- [ ] **Step 2: Confirmar que não sobrou referência**

Run: `grep -rn "(auth)/sign-up\"" apps/mobile --include="*.tsx"`
Expected: nenhum resultado.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros (Expo Router não referencia rotas por import estático, então apagar o arquivo não quebra nada em compile-time além de rotas mortas).

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile/app/\(auth\)/sign-up.tsx
git commit -m "refactor(mobile): remove (auth)/sign-up — vira SignupBlock dentro do onboarding"
```

---

## Task 12: `IdentityBlock` e `ConsentBlock` — troca de shell

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/IdentityBlock.tsx`
- Modify: `apps/mobile/components/onboarding/blocks/ConsentBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingChapterShell` (Task 4).

- [ ] **Step 1: `IdentityBlock.tsx`**

Troque o import:
```ts
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
```
por:
```ts
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
```

Troque a assinatura:
```tsx
export function IdentityBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
```
por:
```tsx
export function IdentityBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura:
```tsx
    <OnboardingStepShell
      step={step}
      total={total}
      title="Escolha seu @username"
      subtitle="É assim que outras pessoas vão te encontrar no Fitbrother."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!canContinue}
    >
```
por:
```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="Escolha seu @username"
      subtitle="É assim que outras pessoas vão te encontrar no Fitbrother."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!canContinue}
    >
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`. Como este bloco não tem `chapter` definido no array (Task 17), `chapter` sempre chega `undefined` aqui — o shell automaticamente não mostra painel nem progresso segmentado.

- [ ] **Step 2: `ConsentBlock.tsx`**

Troque o import (mesma linha de/pra do Step 1). Troque a assinatura:
```tsx
export function ConsentBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
```
por:
```tsx
export function ConsentBlock({ step, total, onNext, onBack, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura:
```tsx
    <OnboardingStepShell
      step={step}
      total={total}
      title="Antes de continuar"
      subtitle="Precisamos do seu consentimento para guardar e processar seus dados."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!allConsents}
    >
```
por:
```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="Antes de continuar"
      subtitle="Precisamos do seu consentimento para guardar e processar seus dados."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!allConsents}
    >
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`. Nenhuma mudança na lógica de consentimento (`consents.terms && consents.privacy && consents.ai_processing`).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/IdentityBlock.tsx apps/mobile/components/onboarding/blocks/ConsentBlock.tsx
git commit -m "refactor(mobile): IdentityBlock/ConsentBlock usam OnboardingChapterShell"
```

---

## Task 13: `SubmittingBlock` — novo bloco (persistência real)

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/SubmittingBlock.tsx`

**Interfaces:**
- Consumes: `postOnboarding` (`@/lib/api`, já existe — Task 14 não muda essa função), `useOnboardingStore.getState().toPayload()`.
- Produces: `SubmittingBlock` — é quem agora chama `POST /onboarding/complete` de fato (job que `CalculatingBlock` fazia antes da Task 14).

- [ ] **Step 1: Escrever o componente**

Conteúdo idêntico ao `CalculatingBlock.tsx` **atual** (antes da Task 14 reescrevê-lo) — é a mesma responsabilidade, só que reposicionada no fluxo:

```tsx
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { postOnboarding } from "@/lib/api";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const MIN_DURATION_MS = 1500;

export function SubmittingBlock({ onNext }: OnboardingBlockProps) {
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const setResult = useOnboardingResultStore((s) => s.setResult);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      const payload = useOnboardingStore.getState().toPayload();
      if (!payload) {
        setError("Faltam informações de um dos passos anteriores.");
        return;
      }
      try {
        const [response] = await Promise.all([
          postOnboarding(payload),
          new Promise((resolve) => setTimeout(resolve, MIN_DURATION_MS)),
        ]);
        if (cancelled) return;
        const body = response as {
          kcal: string;
          protein_g: string;
          carbs_g: string;
          fat_g: string;
          blocked: string | boolean;
          block_reason: string | null;
          soft_mode: boolean;
        };
        setResult({
          kcal: Number(body.kcal),
          protein_g: Number(body.protein_g),
          carbs_g: Number(body.carbs_g),
          fat_g: Number(body.fat_g),
          blocked: body.blocked === "true" || body.blocked === true,
          block_reason: body.block_reason,
          soft_mode: body.soft_mode,
        });
        onNext();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryKey, onNext, setResult]);

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-neutral-50 px-8">
      {error ? (
        <>
          <Text className="text-center text-sm font-sans text-danger-600">{error}</Text>
          <Button
            label="Tentar de novo"
            variant="primary"
            onPress={() => setRetryKey((k) => k + 1)}
          />
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text className="text-center text-base font-sans text-neutral-600">
            Criando sua conta...
          </Text>
        </>
      )}
    </View>
  );
}
```

Diferenças do `CalculatingBlock` original: `MIN_DURATION_MS` cai de 3000 pra 1500 (aqui é rede de verdade, não precisa de um delay artificial tão longo pra dar peso — o preview visual "de peso" já aconteceu antes, no `calculating` local, Task 14) e o texto muda de "Calculando suas metas..." pra "Criando sua conta...".

`setResult` aqui **sobrescreve** o resultado que o preview local (Task 14) já tinha colocado no `onboardingResultStore` — correto, porque o `reveal` de payoff (capítulo 3) já foi mostrado e não é revisitado; esse resultado final serve só de estado interno, não é mais lido por nenhuma tela depois de `submitting` avançar pro `permissions`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/SubmittingBlock.tsx
git commit -m "feat(mobile): novo SubmittingBlock — persiste a conta de verdade, depois do consent"
```

---

## Task 14: `CalculatingBlock` — vira preview local

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx`

**Interfaces:**
- Consumes: `computeTargets`, `evaluateSafetyGates` (`@fitbrother/shared`, já exportados e usados client-side hoje no `GoalBlock`), `OnboardingChapterShell` (Task 4).
- Produces: `CalculatingBlock` não chama mais `postOnboarding` — só computa localmente e navega. `onboardingResultStore.setResult` (já existe, inalterado).

- [ ] **Step 1: Reescrever o arquivo**

```tsx
import { computeTargets, evaluateSafetyGates } from "@fitbrother/shared";
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const PREVIEW_DELAY_MS = 2600;

function ageYearsFromBirthDate(birthDateIso: string): number {
  const birth = new Date(birthDateIso);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function CalculatingBlock({ onNext, chapter }: OnboardingBlockProps) {
  const setResult = useOnboardingResultStore((s) => s.setResult);

  useEffect(() => {
    const s = useOnboardingStore.getState();
    if (!s.sex || !s.birth_date || s.weight_kg === undefined || s.height_cm === undefined || !s.activity_level || !s.goal) {
      // Faltou algo obrigatório de um bloco anterior — não deveria acontecer
      // (todos são required antes do goal), mas evita crash silencioso.
      onNext();
      return;
    }

    const targetsInput = {
      sex: s.sex,
      age_years: ageYearsFromBirthDate(s.birth_date),
      weight_kg: s.weight_kg,
      height_cm: s.height_cm,
      activity_level: s.activity_level,
      goal: s.goal,
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      is_pregnant_or_lactating: s.is_pregnant_or_lactating,
      has_kidney_disease: s.has_kidney_disease,
      has_type1_diabetes: s.has_type1_diabetes,
      uses_glp1: s.uses_glp1,
    };

    const targets = computeTargets(targetsInput);
    const gates = evaluateSafetyGates(targetsInput);
    const soft_mode = gates.some((g) => g.severity === "SOFT_MODE");

    setResult({
      kcal: targets.kcal,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      blocked: targets.blocked,
      block_reason: targets.block_reason,
      soft_mode,
    });

    const timer = setTimeout(onNext, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onNext, setResult]);

  return (
    <OnboardingChapterShell chapter={chapter} title="Calculando suas metas..." showNav={false}>
      <View className="flex-1 items-center justify-center gap-3 py-12">
        <View className="flex-row gap-2.5">
          {[0, 1, 2].map((i) => (
            <View key={i} className="h-3 w-3 rounded-full bg-primary-400" style={{ opacity: 0.4 + i * 0.3 }} />
          ))}
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
```

Nota sobre `ageYearsFromBirthDate`: o servidor já tem uma função equivalente (usada por `buildTargetsInput`/`computeTargets` do lado server) — como não é exportada por `@fitbrother/shared` hoje (é local a `apps/server`), este bloco replica a mesma conta de idade em poucas linhas em vez de criar uma dependência nova cross-workspace. Se o pacote `@fitbrother/shared` já exportar uma função de idade equivalente no momento de implementar (confira `packages/shared/src/index.ts`), use-a em vez de duplicar.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Testar manualmente que o preview não bate rede**

Com o Expo rodando (`npm run dev --workspace apps/mobile`), abra as ferramentas de rede do dispositivo/simulador (ou monitore os logs do `apps/server`) e passe pelo bloco `calculating` — nenhuma requisição HTTP deve aparecer nos logs do servidor nesse momento.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx
git commit -m "refactor(mobile): CalculatingBlock vira preview 100% local (computeTargets client-side)"
```

---

## Task 15: `RevealBlock` — CTA nova, usa o shell (sem nav)

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/RevealBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingChapterShell` (Task 4), `useOnboardingResultStore` (inalterado).

- [ ] **Step 1: Reescrever o arquivo**

```tsx
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function RevealBlock({ onNext, chapter }: OnboardingBlockProps) {
  const result = useOnboardingResultStore((s) => s.result);

  if (!result) {
    router.replace("/(auth)/welcome" as never);
    return null;
  }

  if (result.blocked) {
    return (
      <OnboardingChapterShell chapter={chapter} title="Ajustamos suas metas" showNav={false}>
        <View className="flex-1 justify-between gap-8">
          <Text className="text-center text-base font-sans text-neutral-600">
            {result.block_reason}
          </Text>
          <View className="gap-4">
            <GoalsDisclaimer />
            <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
          </View>
        </View>
      </OnboardingChapterShell>
    );
  }

  return (
    <OnboardingChapterShell chapter={chapter} title="Suas metas estão prontas" showNav={false}>
      <View className="flex-1 justify-between gap-8">
        <View className="items-center gap-6">
          <Text
            className="text-5xl font-display-bold text-primary-500"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {fmtInt(result.kcal)} kcal
          </Text>
          <View className="flex-row gap-6">
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(result.protein_g)}g proteína
            </Text>
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(result.carbs_g)}g carbo
            </Text>
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(result.fat_g)}g gordura
            </Text>
          </View>
        </View>
        <View className="gap-4">
          <GoalsDisclaimer />
          <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
```

Mudanças vs. o original: (1) o branch `result.soft_mode` foi removido — depois da Task 1, `soft_mode` nunca mais vem `true` do preview local, então esse branch era código morto inatingível; removê-lo aqui é seguro e evita manter uma mensagem (com telefone do CVV) que nunca aparece. (2) o guard de `!result` redireciona pro `welcome` em vez de `(app)` — nesse ponto do fluxo novo a conta ainda não existe (é criada só no `submitting`, depois do `signup`), então cair direto em `(app)` sem conta seria um beco sem saída; mandar pro `welcome` deixa o usuário recomeçar. (3) CTA vira "Criar conta pra salvar essas metas" nos dois branches. (4) `showNav={false}` no shell (mesma razão do `calculating` — payoff, não formulário).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/RevealBlock.tsx
git commit -m "refactor(mobile): RevealBlock — CTA de conta, remove branch morto de soft_mode"
```

---

## Task 16: `PermissionsBlock` e `PaywallBlock` — troca de shell

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/PermissionsBlock.tsx`
- Modify: `apps/mobile/components/onboarding/blocks/PaywallBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingChapterShell` (Task 4).

- [ ] **Step 1: `PermissionsBlock.tsx`**

Troque o import:
```ts
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
```
por:
```ts
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
```

Troque a assinatura:
```tsx
export function PermissionsBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
```
por:
```tsx
export function PermissionsBlock({ step, total, onNext, onBack, onSkip, chapter }: OnboardingBlockProps) {
```

Troque a tag de abertura:
```tsx
    <OnboardingStepShell step={step} total={total} title="Notificações" onBack={onBack}>
```
por:
```tsx
    <OnboardingChapterShell chapter={chapter} title="Notificações" onBack={onBack}>
```
E a tag de fechamento `</OnboardingStepShell>` por `</OnboardingChapterShell>`. `chapter` chega sempre `undefined` aqui (bloco de Fase C, sem `chapter` no array — Task 17). O botão "Ativar notificações" continua como conteúdo (`children`) do shell; o "Agora não" (`onSkip`) continua igual.

- [ ] **Step 2: `PaywallBlock.tsx`**

Este arquivo hoje **não** usa `OnboardingStepShell` — é um `View` full-screen bespoke sem título/subtítulo formal. Reescreva pra usar o shell, mantendo o mesmo conteúdo (ícone, texto, botão único):

```tsx
import { Sparkles } from "lucide-react-native";
import { Text, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function PaywallBlock({ onNext, chapter }: OnboardingBlockProps) {
  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Fitbrother Premium — em breve"
      subtitle="Estamos preparando recursos extras. Por enquanto, aproveite o Fitbrother completo, de graça."
      onNext={onNext}
    >
      <View className="flex-1 items-center justify-center py-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-50">
          <Sparkles size={36} color={colors.primary[400]} />
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
```

Note que `onBack` não é passado — o botão circular de voltar do shell fica desabilitado automaticamente (`disabled={!onBack}` já está no `OnboardingChapterShell`), preservando o comportamento de hoje (paywall não tinha botão de voltar).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/PermissionsBlock.tsx apps/mobile/components/onboarding/blocks/PaywallBlock.tsx
git commit -m "refactor(mobile): PermissionsBlock/PaywallBlock usam OnboardingChapterShell"
```

---

**Nota — `FirstMealBlock` fica de fora deste plano de propósito:** a spec (§5) descreve todo bloco sem `chapter` usando "o mesmo card centralizado... título, conteúdo e nav", mas `FirstMealBlock` não segue o padrão pergunta-com-botão-Continuar — a ação de avançar é o próprio `MealComposer` enviando texto/áudio, não um `onNext` solto. Forçá-lo no `OnboardingChapterShell` pediria redesenhar a interação do composer, fora do pedido original (redesenhar a anamnese). `FirstMealBlock.tsx` não é tocado em nenhuma task deste plano — continua com seu layout bespoke atual, só muda de posição no array (Task 17).

---

## Task 17: `lib/onboarding/blocks.ts` — reordena o array

**Files:**
- Modify: `apps/mobile/lib/onboarding/blocks.ts`

**Interfaces:**
- Consumes: todos os blocos das Tasks 5-16, `CHAPTER_NAMES`/`CHAPTER_TOTAL` (Task 3, só pra referência — não usados diretamente aqui).
- Produces: `ONBOARDING_BLOCKS` novo, `DATA_BLOCK_COUNT = 13`. Consumido por `[block].tsx` (Task 18).

- [ ] **Step 1: Reescrever o arquivo**

```ts
import { ActivityBlock } from "@/components/onboarding/blocks/ActivityBlock";
import { BasicsBlock } from "@/components/onboarding/blocks/BasicsBlock";
import { CalculatingBlock } from "@/components/onboarding/blocks/CalculatingBlock";
import { ConsentBlock } from "@/components/onboarding/blocks/ConsentBlock";
import { FirstMealBlock } from "@/components/onboarding/blocks/FirstMealBlock";
import { GoalBlock } from "@/components/onboarding/blocks/GoalBlock";
import { HealthBlock } from "@/components/onboarding/blocks/HealthBlock";
import { HeightBlock } from "@/components/onboarding/blocks/HeightBlock";
import { IdentityBlock } from "@/components/onboarding/blocks/IdentityBlock";
import { NameBlock } from "@/components/onboarding/blocks/NameBlock";
import { PaywallBlock } from "@/components/onboarding/blocks/PaywallBlock";
import { PermissionsBlock } from "@/components/onboarding/blocks/PermissionsBlock";
import { RevealBlock } from "@/components/onboarding/blocks/RevealBlock";
import { SignupBlock } from "@/components/onboarding/blocks/SignupBlock";
import { SubmittingBlock } from "@/components/onboarding/blocks/SubmittingBlock";
import { WeightBlock } from "@/components/onboarding/blocks/WeightBlock";
import type { OnboardingBlockDef } from "@/lib/onboarding/types";

export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  // Fase A — anamnese, sessão anônima, painel de capítulos visível
  { id: "name", Component: NameBlock, chapter: 1 },
  { id: "basics", Component: BasicsBlock, chapter: 1 },
  { id: "height", Component: HeightBlock, chapter: 1 },
  { id: "weight", Component: WeightBlock, chapter: 1 },
  { id: "activity", Component: ActivityBlock, chapter: 1 },
  { id: "goal", Component: GoalBlock, chapter: 2 },
  { id: "health", Component: HealthBlock, chapter: 2, skippable: true },
  { id: "calculating", Component: CalculatingBlock, chapter: 3 },
  { id: "reveal", Component: RevealBlock, chapter: 3 },
  // Fase B — conta e legal, sem painel de capítulos
  { id: "signup", Component: SignupBlock },
  { id: "identity", Component: IdentityBlock },
  { id: "consent", Component: ConsentBlock },
  { id: "submitting", Component: SubmittingBlock },
  // Fase C — ativação, conta já existe
  { id: "permissions", Component: PermissionsBlock, skippable: true },
  { id: "paywall", Component: PaywallBlock },
  { id: "first_meal", Component: FirstMealBlock },
];

// "name" .. "submitting" — únicos blocos que autosalvam progresso via
// PATCH /onboarding/progress. A partir de "permissions" a conta já existe
// de verdade (submitting já rodou complete_onboarding com sucesso), então
// não há mais o que retomar — mesma semântica que o M16 já estabeleceu.
export const DATA_BLOCK_COUNT = 13;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros — este é o ponto em que o array volta a bater 100% com os componentes existentes.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/onboarding/blocks.ts
git commit -m "feat(mobile): ONBOARDING_BLOCKS reordenado — anamnese antes da conta"
```

---

## Task 18: `[block].tsx` — deriva e repassa `chapter`

**Files:**
- Modify: `apps/mobile/app/(onboarding)/[block].tsx`

**Interfaces:**
- Consumes: `CHAPTER_NAMES` (Task 3), `ONBOARDING_BLOCKS`/`DATA_BLOCK_COUNT` (Task 17).
- Produces: cada `Component` renderizado recebe `chapter` populado quando `block.chapter` existe.

- [ ] **Step 1: Adicionar a derivação de `chapter`**

Importe `CHAPTER_NAMES` no topo do arquivo:

```ts
import { CHAPTER_NAMES } from "@/lib/onboarding/types";
```

Logo antes do `return (`, adicione:

```ts
  const chapter = block.chapter
    ? { num: block.chapter, name: CHAPTER_NAMES[block.chapter] }
    : undefined;
```

E acrescente `chapter={chapter}` nas props passadas pro `<Component .../>`:

```tsx
  return (
    <Component
      step={index + 1}
      total={DATA_BLOCK_COUNT}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={block.skippable ? handleNext : undefined}
      chapter={chapter}
    />
  );
```

Nenhuma outra linha do arquivo muda — `handleNext`/`handleBack`/o `useEffect` de fallback continuam exatamente como estão hoje.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Teste manual do fluxo completo**

Suba a infra (Supabase local + `npm run dev:server` + `npm run dev --workspace apps/mobile`, web ou simulador). A partir de `(auth)/welcome`:
1. Toque "Criar conta" → deve cair direto no bloco `name`, com o painel lateral (desktop) mostrando "Você" ativo.
2. Preencha até `reveal` — confirme que os números aparecem sem nenhum delay de rede perceptível além dos ~2.6s decorativos, e que o painel lateral mostra "Metas" ativo com "Você"/"Objetivo" marcados como concluídos.
3. Toque "Criar conta pra salvar essas metas" → cai no `signup`, painel lateral sumiu.
4. Preencha e-mail/senha → `identity` → `consent` → `submitting` (mostra "Criando sua conta...") → `permissions` → `paywall` → `first_meal`.
5. Envie uma refeição de teste → deve cair em `(app)` com a conta funcional.
6. Feche o app no meio do passo 2 (ex. no bloco `weight`) e reabra — deve retomar exatamente ali (mesma sessão anônima).

Expected: fluxo completo sem crash, sem chamada de rede durante `calculating`, conta criada de verdade só depois do `submitting`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(onboarding\)/\[block\].tsx
git commit -m "feat(mobile): [block].tsx deriva chapter do block def e repassa pro Component"
```

---

## Task 19: Remover arquivos mortos

**Files:**
- Delete: `apps/mobile/components/onboarding/blocks/ContactBlock.tsx`
- Delete: `apps/mobile/components/onboarding/blocks/TrainingBlock.tsx`
- Delete: `apps/mobile/components/onboarding/blocks/HabitsBlock.tsx`
- Delete: `apps/mobile/components/onboarding/blocks/BarriersBlock.tsx`
- Delete: `apps/mobile/components/onboarding/blocks/DietBlock.tsx`
- Delete: `apps/mobile/components/OnboardingStepShell.tsx`
- Delete: `apps/mobile/components/OnboardingNavButtons.tsx`
- Delete: `apps/mobile/components/ProgressBar.tsx`

**Interfaces:**
- Nenhuma — todos os 8 arquivos confirmados sem consumidor depois da Task 17 (os 5 blocks não entram mais em `ONBOARDING_BLOCKS`; `OnboardingStepShell`/`OnboardingNavButtons`/`ProgressBar` não são importados por nenhum bloco depois das Tasks 5-16 migrarem todos pro `OnboardingChapterShell`).

- [ ] **Step 1: Confirmar que não sobrou import**

Run:
```bash
grep -rln "ContactBlock\|TrainingBlock\|HabitsBlock\|BarriersBlock\|DietBlock" apps/mobile --include="*.tsx" --include="*.ts" | grep -v "components/onboarding/blocks/\(Contact\|Training\|Habits\|Barriers\|Diet\)Block.tsx"
grep -rln "OnboardingStepShell\|OnboardingNavButtons\|components/ProgressBar" apps/mobile --include="*.tsx" --include="*.ts" | grep -v "components/OnboardingStepShell.tsx\|components/OnboardingNavButtons.tsx\|components/ProgressBar.tsx"
```
Expected: ambos sem resultado (nenhum arquivo fora dos próprios 8 os referencia).

- [ ] **Step 2: Apagar**

```bash
rm apps/mobile/components/onboarding/blocks/ContactBlock.tsx
rm apps/mobile/components/onboarding/blocks/TrainingBlock.tsx
rm apps/mobile/components/onboarding/blocks/HabitsBlock.tsx
rm apps/mobile/components/onboarding/blocks/BarriersBlock.tsx
rm apps/mobile/components/onboarding/blocks/DietBlock.tsx
rm apps/mobile/components/OnboardingStepShell.tsx
rm apps/mobile/components/OnboardingNavButtons.tsx
rm apps/mobile/components/ProgressBar.tsx
```

- [ ] **Step 3: Typecheck + lint do monorepo inteiro**

Run: `npm run typecheck --workspaces --if-present && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile/components/onboarding/blocks/ContactBlock.tsx apps/mobile/components/onboarding/blocks/TrainingBlock.tsx apps/mobile/components/onboarding/blocks/HabitsBlock.tsx apps/mobile/components/onboarding/blocks/BarriersBlock.tsx apps/mobile/components/onboarding/blocks/DietBlock.tsx apps/mobile/components/OnboardingStepShell.tsx apps/mobile/components/OnboardingNavButtons.tsx apps/mobile/components/ProgressBar.tsx
git commit -m "chore(mobile): remove blocos e shell antigo sem consumidor (Rotina, contato, OnboardingStepShell)"
```

---

## Feito quando

- Fluxo completo (`Welcome` → 16 blocos → `(app)`) funciona ponta a ponta com dados reais (Task 18/Step 3).
- Fechar o app em qualquer bloco de `name` até `submitting` e reabrir retoma exatamente onde parou, sob a mesma sessão (anônima ou já promovida).
- `reveal` mostra o preview correto (números normais ou `block_reason`) sem nenhuma chamada de rede (Task 14/Step 3).
- Painel lateral de capítulos aparece só em `name`..`reveal` (capítulos 1-3), com o capítulo certo destacado; some completamente a partir de `signup`.
- `npm run typecheck --workspaces --if-present && npm run lint` passam no monorepo inteiro (Task 19/Step 3).
- `npm run test --workspace packages/shared` e o teste do `onboardingStore` passam sem nenhuma referência a `tca_screening_positive`.
- Nenhum arquivo do onboarding antigo (`OnboardingStepShell`, `OnboardingNavButtons`, `ProgressBar`, os 5 blocos removidos, `(auth)/sign-up.tsx`) sobrevive no repo.
