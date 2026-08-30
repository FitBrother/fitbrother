# Polimentos da versão web (rodada 2) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar dez polimentos de UI no layout mobile-web do Fitbrother — cores de marca, animações de loading, swipe entre abas, micro-interações, espaçamentos, nomenclatura e integração streak ⇄ histórico.

**Architecture:** Mudanças cirúrgicas em componentes existentes, mais dois componentes novos e isolados (`LoadingDots`, `SwipeableTabs`). O `SwipeableTabs` é um primitivo de layout genérico — recebe índice, callback e cenas; não sabe nada sobre nutrição. Toda a lógica de decisão do gesto fica em uma função pura exportada, testável sem renderizar nada.

**Tech Stack:** React Native · Expo Router · NativeWind v4 · react-native-reanimated 4.1 · react-native-gesture-handler 2.28 · Jest + @testing-library/react-native.

## Global Constraints

Copiadas do `CLAUDE.md` e da spec — valem para **todas** as tasks:

- **Nunca** `font-medium`/`font-semibold`/`font-bold`. Use `font-sans`, `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`, `font-sans-extrabold`.
- Todo valor numérico leva `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores sempre via token (`colors.*` ou classe Tailwind). Nunca hex inline em JSX.
- Hit target mínimo 44×44pt em qualquer `Pressable`.
- `accessibilityLabel` obrigatório em botões icon-only; `accessibilityRole` em interativos.
- Sem dark mode. Não usar `dark:` em código novo.
- Ícones apenas de `lucide-react-native`.
- Sem tags HTML (`<div>`, `<h1>`) — use `View`, `Text`, `Pressable`.
- **Nenhuma dependência nova.** O swipe usa `gesture-handler` + `reanimated`, já instalados.
- **Escopo mobile-web:** o branch `isDesktop` de `app/(app)/index.tsx` e a `Sidebar` **não** são tocados, exceto onde a task disser explicitamente.
- Baseline de testes: `npx jest` = 9 suítes / 37 testes verdes. Não pode regredir.

**Comandos de verificação** (rodar de `apps/mobile/`):
```bash
npx jest                # suíte completa
npx jest <arquivo>      # suíte única
npm run typecheck       # tsc --noEmit
```

---

## Estrutura de arquivos

**Criar:**
- `components/LoadingDots.tsx` — três pontos com bounce sequencial. Primitivo de UI reutilizável.
- `components/LoadingDots.test.tsx` — teste de render.
- `components/domain/SwipeableTabs.tsx` — pager horizontal genérico + `resolveIndex` (lógica pura).
- `components/domain/SwipeableTabs.test.tsx` — testes unitários de `resolveIndex`.
- `components/domain/HomeHeader.test.tsx` — labels das abas + navegação do streak.
- `components/domain/FeedTabContent.test.tsx` — label da sub-aba.
- `lib/activity-indicator-color.test.ts` — guard: todo `ActivityIndicator` tem `color`.

**Modificar:**
- `app/(onboarding)/index.tsx:23` — cor do loading.
- `global.css` — reset de outline (web).
- `components/onboarding/blocks/CalculatingBlock.tsx:89-98` — usar `LoadingDots`.
- `components/domain/HomeHeader.tsx` — label "Social", exportar `TABS`, avatar 44px, streak clicável, press feedback.
- `components/domain/FeedTabContent.tsx` — label "Feed", press feedback.
- `app/(app)/index.tsx` — `SwipeableTabs`, padding do `macroPanel`, entrada da lista.
- `app/(app)/history/index.tsx` — pill de streak no cabeçalho.
- `app/_layout.tsx:59` e `app/(app)/_layout.tsx:58` — `animation: "fade"`.
- `components/domain/MealCard.tsx` — press feedback.

---

### Task 1: Cor do loading do onboarding

Único `ActivityIndicator` do app sem `color` — RNW cai no azul default `#1976D2`.

**Files:**
- Modify: `app/(onboarding)/index.tsx:3,23`
- Test: `lib/activity-indicator-color.test.ts` (criar)

**Interfaces:**
- Consumes: `colors` de `@/lib/colors` (já existe; `colors.primary[400]` = `#06D59F`).
- Produces: nada consumido por tasks seguintes.

- [ ] **Step 1: Escrever o guard test que falha**

Cria `apps/mobile/lib/activity-indicator-color.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Um <ActivityIndicator> sem prop `color` renderiza azul (#1976D2) no
// react-native-web, destoando da menta da marca. Este guard trava a regra
// para todo o app, não só para o caso que originou o fix.
const ROOT = resolve(__dirname, "..");

function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walkTsx(full);
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

/** Extrai cada tag de abertura `<ActivityIndicator ... />` do fonte. */
function activityIndicatorTags(source: string): string[] {
  const tags: string[] = [];
  let idx = source.indexOf("<ActivityIndicator");
  while (idx !== -1) {
    const end = source.indexOf("/>", idx);
    tags.push(source.slice(idx, end === -1 ? source.length : end));
    idx = source.indexOf("<ActivityIndicator", idx + 1);
  }
  return tags;
}

const files = ["app", "components"]
  .flatMap((d) => walkTsx(join(ROOT, d)))
  .filter((f) => readFileSync(f, "utf8").includes("<ActivityIndicator"));

describe("ActivityIndicator usa a cor da marca", () => {
  test("há usos de ActivityIndicator para vigiar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)("%s passa color explicitamente", (file) => {
    for (const tag of activityIndicatorTags(readFileSync(file, "utf8"))) {
      expect(tag).toMatch(/color=/);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest lib/activity-indicator-color.test.ts`
Expected: FAIL — o caso `app/(onboarding)/index.tsx` não bate `/color=/`.

- [ ] **Step 3: Corrigir a cor**

Em `app/(onboarding)/index.tsx`, adiciona o import (linha 3 area) e a prop:

```tsx
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/lib/colors";
```

```tsx
      <ActivityIndicator size="large" color={colors.primary[400]} />
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest lib/activity-indicator-color.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(onboarding\)/index.tsx apps/mobile/lib/activity-indicator-color.test.ts
git commit -m "fix(mobile): loading do onboarding usa a menta da marca, não o azul default"
```

---

### Task 2: Remover o outline azul dos inputs no web

`react-native-web` renderiza `TextInput` como `<input>`/`<textarea>`; o anel de foco do browser aparece por cima da borda que `Input.tsx:37-41` já anima no focus.

**Files:**
- Modify: `apps/mobile/global.css`

**Interfaces:**
- Consumes: nada.
- Produces: nada.

Sem teste automatizado: um assert de "o arquivo CSS contém a string X" só reafirma a linha escrita, sem provar que o browser parou de desenhar o anel. A verificação real é visual, na Task 13.

- [ ] **Step 1: Adicionar o reset**

Substitui o conteúdo de `apps/mobile/global.css` por:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* react-native-web renderiza TextInput como <input>/<textarea>, e o browser
   desenha seu próprio anel de foco por cima da borda que Input.tsx já troca
   para border-primary-400 no focus. Suprimir o anel deixa a borda do design
   system como o único (e suficiente) indicador de foco. */
input,
textarea {
  outline: none;
}
```

- [ ] **Step 2: Verificar que o typecheck segue limpo**

Run: `npm run typecheck`
Expected: sem erros (CSS não afeta o tsc, mas confirma que nada quebrou).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/global.css
git commit -m "fix(mobile): remove anel de foco azul do browser nos inputs"
```

---

### Task 3: LoadingDots com bounce sequencial

`CalculatingBlock.tsx:91-97` renderiza três `View` com `opacity` fixa calculada no `map` — nunca anima. A tela fica visível 2600ms, tempo de sobra pro usuário notar que nada se move.

**Files:**
- Create: `components/LoadingDots.tsx`
- Create: `components/LoadingDots.test.tsx`
- Modify: `components/onboarding/blocks/CalculatingBlock.tsx:3,89-98`

**Interfaces:**
- Consumes: `Motion` de `@/lib/motion` (`Motion.easing.standard`, `Motion.duration.fast`).
- Produces: `LoadingDots` — componente sem props obrigatórias, exportado de `@/components/LoadingDots`. Cada ponto tem `testID="loading-dot"`.

- [ ] **Step 1: Escrever o teste que falha**

Cria `apps/mobile/components/LoadingDots.test.tsx`:

```tsx
import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { LoadingDots } from "./LoadingDots";

describe("LoadingDots", () => {
  test("renderiza três pontos", () => {
    const { getAllByTestId } = render(<LoadingDots />);
    expect(getAllByTestId("loading-dot")).toHaveLength(3);
  });

  test("expõe o estado de carregamento para leitores de tela", () => {
    const { getByLabelText } = render(<LoadingDots />);
    expect(getByLabelText("Carregando")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest components/LoadingDots.test.tsx`
Expected: FAIL — "Cannot find module './LoadingDots'".

- [ ] **Step 3: Criar o componente**

Cria `apps/mobile/components/LoadingDots.tsx`:

```tsx
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Motion } from "@/lib/motion";

// Bounce sequencial ("digitando"): cada ponto sobe e desce com um atraso
// escalonado, formando uma onda. 400ms por metade do ciclo dá um ritmo
// calmo; 140ms de defasagem é o bastante pra leitura de onda sem parecer
// que os pontos estão dessincronizados.
const BOUNCE_MS = 400;
const STAGGER_MS = 140;
const LIFT_PX = -8;
const DOT_COUNT = 3;

function BouncingDot({ index }: { index: number }) {
  const y = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    y.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(LIFT_PX, { duration: BOUNCE_MS, easing: Motion.easing.standard }),
          withTiming(0, { duration: BOUNCE_MS, easing: Motion.easing.standard }),
        ),
        -1,
        false,
      ),
    );
  }, [index, reduced, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View
      testID="loading-dot"
      className="h-3 w-3 rounded-full bg-primary-400"
      style={style}
    />
  );
}

/** Três pontos com bounce sequencial, para esperas curtas e indeterminadas. */
export function LoadingDots() {
  return (
    <View
      className="flex-row gap-2.5"
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
    >
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <BouncingDot key={i} index={i} />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest components/LoadingDots.test.tsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Usar no CalculatingBlock**

Em `components/onboarding/blocks/CalculatingBlock.tsx`, adiciona o import:

```tsx
import { LoadingDots } from "@/components/LoadingDots";
```

E substitui o bloco `return` (linhas 87-101) por:

```tsx
  return (
    <OnboardingChapterShell chapter={chapter} title="Calculando suas metas..." showNav={false}>
      <View className="flex-1 items-center justify-center gap-3 py-12">
        <LoadingDots />
      </View>
    </OnboardingChapterShell>
  );
```

- [ ] **Step 6: Verificar typecheck e suíte**

Run: `npm run typecheck && npx jest`
Expected: tsc limpo; 39 testes passando (37 baseline + 2 novos).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/LoadingDots.tsx apps/mobile/components/LoadingDots.test.tsx apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx
git commit -m "feat(mobile): anima os três pontos da tela de cálculo de metas"
```

---

### Task 4: Nomenclatura — aba "Social", sub-aba "Feed"

Hierarquia atual confunde: aba de topo "Feed" contendo sub-aba "Publicações". Vira aba "Social" contendo sub-aba "Feed". **Só os rótulos exibidos mudam** — a chave interna `HomeTab = "home" | "feed" | "analises"` fica como está (renomear propagaria por vários arquivos sem ganho).

**Files:**
- Modify: `components/domain/HomeHeader.tsx:14-18`
- Modify: `components/domain/FeedTabContent.tsx:21,32`
- Create: `components/domain/HomeHeader.test.tsx`
- Create: `components/domain/FeedTabContent.test.tsx`

**Interfaces:**
- Produces: `TABS` passa a ser **exportado** de `components/domain/HomeHeader.tsx` com o tipo
  `{ key: HomeTab; label: string; Icon: typeof HomeIcon }[]`, na ordem `home → feed → analises`.
  A Task 9 usa esse array para mapear aba ⇄ índice do pager.

- [ ] **Step 1: Escrever os testes que falham**

Cria `apps/mobile/components/domain/HomeHeader.test.tsx`:

```tsx
import { describe, expect, test } from "@jest/globals";

import { TABS } from "./HomeHeader";

describe("abas da Home", () => {
  test("a aba social é rotulada 'Social'", () => {
    expect(TABS.find((t) => t.key === "feed")?.label).toBe("Social");
  });

  test("a ordem das abas é home → feed → analises", () => {
    expect(TABS.map((t) => t.key)).toEqual(["home", "feed", "analises"]);
  });
});
```

Cria `apps/mobile/components/domain/FeedTabContent.test.tsx`:

```tsx
import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

// Os painéis fazem fetch próprio; aqui só interessam os rótulos das sub-abas.
jest.mock("@/components/domain/FeedPostsPanel", () => ({ FeedPostsPanel: () => null }));
jest.mock("@/components/domain/FriendsPanel", () => ({ FriendsPanel: () => null }));

import { FeedTabContent } from "./FeedTabContent";

describe("sub-abas do Social", () => {
  test("a sub-aba de publicações é rotulada 'Feed'", () => {
    const { getByLabelText } = render(<FeedTabContent />);
    expect(getByLabelText("Feed")).toBeTruthy();
  });

  test("mantém a sub-aba Amigos", () => {
    const { getByLabelText } = render(<FeedTabContent />);
    expect(getByLabelText("Amigos")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx jest components/domain/HomeHeader.test.tsx components/domain/FeedTabContent.test.tsx`
Expected: FAIL — `TABS` não é exportado; e o label da sub-aba ainda é "Publicações".

- [ ] **Step 3: Renomear na HomeHeader**

Em `components/domain/HomeHeader.tsx`, exporta `TABS` e troca o label:

```tsx
export const TABS: { key: HomeTab; label: string; Icon: typeof HomeIcon }[] = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "feed", label: "Social", Icon: Rss },
  { key: "analises", label: "Análises", Icon: BarChart3 },
];
```

- [ ] **Step 4: Renomear na FeedTabContent**

Em `components/domain/FeedTabContent.tsx`, na `Pressable` de `posts` (linhas 18-34), troca `accessibilityLabel` e o texto:

```tsx
          accessibilityLabel="Feed"
```

```tsx
            Feed
```

E atualiza o comentário do componente (linhas 8-11) para refletir a nova nomenclatura:

```tsx
/**
 * Aba "Social" da Home no mobile — Amigos deixou de ser destino de navegação
 * principal e virou sub-aba aqui dentro, ao lado do Feed.
 */
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npx jest components/domain/HomeHeader.test.tsx components/domain/FeedTabContent.test.tsx`
Expected: PASS (4 testes)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx apps/mobile/components/domain/HomeHeader.test.tsx apps/mobile/components/domain/FeedTabContent.tsx apps/mobile/components/domain/FeedTabContent.test.tsx
git commit -m "feat(mobile): renomeia aba Feed para Social e sub-aba Publicações para Feed"
```

---

### Task 5: Avatar com a mesma altura do pill de streak

Avatar é `h-9 w-9` (36px); o container do streak tem `min-h-[44px]`. Lado a lado com a mesma sombra, a diferença de 8px salta.

**Files:**
- Modify: `components/domain/HomeHeader.tsx:64-69`
- Modify: `app/(app)/index.tsx:373`

**Interfaces:** nenhuma mudança de API.

Mudança puramente visual — sem teste automatizado; verificada no browser na Task 13.

- [ ] **Step 1: Aumentar o avatar**

Em `components/domain/HomeHeader.tsx`, no `View` do avatar (linhas 64-69):

```tsx
          <View
            style={shadows.floating}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary-100"
          >
            <Text className="font-sans-bold text-sm text-primary-800">{initials}</Text>
          </View>
```

- [ ] **Step 2: Dar respiro entre as abas e o card de resumo**

Em `app/(app)/index.tsx`, no `macroPanel` (linha 373), adiciona `pt-3`:

```tsx
    <View className="gap-2 px-4 pb-2 pt-3">
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx apps/mobile/app/\(app\)/index.tsx
git commit -m "fix(mobile): alinha altura do avatar com o pill de streak e dá respiro ao card de resumo"
```

---

### Task 6: Tocar no streak abre o Histórico

O pill do streak é um `View` inerte (`HomeHeader.tsx:47-53`). Vira `Pressable` navegando para `/(app)/history`. O `StreakCounter` continua puramente apresentacional — quem decide comportamento é o call-site, então o uso no desktop segue não-clicável.

**Files:**
- Modify: `components/domain/HomeHeader.tsx:47-53`
- Modify: `components/domain/HomeHeader.test.tsx` (adicionar caso)

**Interfaces:**
- Consumes: `TABS` (Task 4), `useRouter` de `expo-router` (já importado em `HomeHeader.tsx:2`).
- Produces: `Pressable` com `accessibilityLabel="Ver histórico de ofensivas"`.

- [ ] **Step 1: Adicionar o teste que falha**

Acrescenta ao topo de `components/domain/HomeHeader.test.tsx` (antes do `import { TABS }`):

```tsx
import { fireEvent, render } from "@testing-library/react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/hooks/useStreak", () => ({
  useStreak: () => ({ data: { streak: { current_streak: 5 }, atRisk: false } }),
}));
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => ({ full_name: "Ana Silva", soft_mode: false }),
}));
jest.mock("@/lib/hooks/useAuthSession", () => ({
  useAuthSession: () => ({
    status: "signed_in",
    session: { user: { email: "ana@exemplo.com" } },
  }),
}));

import { HomeHeader } from "./HomeHeader";
```

E o import de `jest` no topo passa a ser:

```tsx
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
```

Depois acrescenta o bloco de testes ao final do arquivo:

```tsx
describe("pill de streak", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  test("navega para o histórico ao ser tocado", () => {
    const { getByLabelText } = render(
      <HomeHeader activeTab="home" onChangeTab={jest.fn()} />,
    );

    fireEvent.press(getByLabelText("Ver histórico de ofensivas"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/history");
  });

  test("não é renderizado em soft mode", () => {
    const { queryByLabelText } = render(
      <HomeHeader softMode activeTab="home" onChangeTab={jest.fn()} />,
    );

    expect(queryByLabelText("Ver histórico de ofensivas")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest components/domain/HomeHeader.test.tsx`
Expected: FAIL — nenhum elemento com o label "Ver histórico de ofensivas".

- [ ] **Step 3: Tornar o pill clicável**

Em `components/domain/HomeHeader.tsx`, troca o `View` do streak (linhas 47-53) por:

```tsx
          <Pressable
            onPress={() => router.push("/(app)/history" as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver histórico de ofensivas"
            style={shadows.floating}
            className="rounded-full bg-white px-2 active:opacity-70"
          >
            <StreakCounter
              current={streakView.streak.current_streak}
              atRisk={streakView.atRisk}
              size={20}
            />
          </Pressable>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest components/domain/HomeHeader.test.tsx`
Expected: PASS (4 testes no arquivo)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx apps/mobile/components/domain/HomeHeader.test.tsx
git commit -m "feat(mobile): tocar no streak abre o histórico"
```

---

### Task 7: Streak no cabeçalho do Histórico

O cabeçalho de `history/index.tsx:67-77` tem só voltar + título. Ganha o mesmo pill da Home, à direita. Não é clicável — o usuário já está no destino.

**Files:**
- Modify: `app/(app)/history/index.tsx`

**Interfaces:**
- Consumes: `useStreak` de `@/lib/hooks/useStreak` (retorna `{ data?: { streak: { current_streak: number }, atRisk: boolean } }`), `StreakCounter` de `@/components/domain/StreakCounter`, `shadows` de `@/lib/shadows`.

- [ ] **Step 1: Adicionar imports**

Em `app/(app)/history/index.tsx`, junto aos imports existentes:

```tsx
import { shadows } from "@/lib/shadows";
import { useStreak } from "@/lib/hooks/useStreak";
import { StreakCounter } from "@/components/domain/StreakCounter";
```

- [ ] **Step 2: Consumir o hook**

Dentro de `HistoryScreen`, junto às outras chamadas de hook (perto de `const query = useDailySummaries(...)`):

```tsx
  const { data: streakView } = useStreak();
```

- [ ] **Step 3: Renderizar o pill no cabeçalho**

Substitui o `View` do cabeçalho (linhas 67-77) por:

```tsx
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => backOrHome(router)}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 text-xl font-display-bold text-neutral-800">Histórico</Text>
        {!profile.soft_mode && streakView && (
          <View style={shadows.floating} className="rounded-full bg-white px-2">
            <StreakCounter
              current={streakView.streak.current_streak}
              atRisk={streakView.atRisk}
              size={20}
            />
          </View>
        )}
      </View>
```

- [ ] **Step 4: Verificar typecheck e suíte**

Run: `npm run typecheck && npx jest`
Expected: tsc limpo; suíte verde.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/history/index.tsx
git commit -m "feat(mobile): exibe ofensiva atual no cabeçalho do histórico"
```

---

### Task 8: Componente SwipeableTabs

Pager horizontal genérico. A decisão de qual aba vira ativa é uma função pura exportada (`resolveIndex`) — é onde mora a lógica de verdade, e é testável sem renderizar nem simular gesto.

**Files:**
- Create: `components/domain/SwipeableTabs.tsx`
- Create: `components/domain/SwipeableTabs.test.tsx`

**Interfaces:**
- Produces:
  - `resolveIndex(args: { current: number; translationX: number; velocityX: number; width: number; count: number }): number`
  - `SwipeableTabs(props: { index: number; onIndexChange: (i: number) => void; children: React.ReactNode })` — as cenas são os filhos, na mesma ordem dos índices.
  - `SWIPE_DISTANCE_RATIO = 1/3`, `SWIPE_VELOCITY_THRESHOLD = 500`.
- Consumes: `Gesture`/`GestureDetector` de `react-native-gesture-handler`, `Motion` de `@/lib/motion`.

- [ ] **Step 1: Escrever os testes que falham**

Cria `apps/mobile/components/domain/SwipeableTabs.test.tsx`:

```tsx
import { describe, expect, test } from "@jest/globals";

import { resolveIndex } from "./SwipeableTabs";

const WIDTH = 390;
const COUNT = 3;
const base = { width: WIDTH, count: COUNT };

describe("resolveIndex", () => {
  test("arrasto curto e lento não troca de aba", () => {
    expect(
      resolveIndex({ ...base, current: 1, translationX: -40, velocityX: -100 }),
    ).toBe(1);
  });

  test("arrasto além de 1/3 da largura para a esquerda avança", () => {
    expect(
      resolveIndex({ ...base, current: 0, translationX: -200, velocityX: 0 }),
    ).toBe(1);
  });

  test("arrasto além de 1/3 da largura para a direita retrocede", () => {
    expect(
      resolveIndex({ ...base, current: 2, translationX: 200, velocityX: 0 }),
    ).toBe(1);
  });

  test("fling rápido avança mesmo com pouca distância", () => {
    expect(
      resolveIndex({ ...base, current: 0, translationX: -20, velocityX: -900 }),
    ).toBe(1);
  });

  test("fling rápido para a direita retrocede mesmo com pouca distância", () => {
    expect(
      resolveIndex({ ...base, current: 2, translationX: 20, velocityX: 900 }),
    ).toBe(1);
  });

  test("não passa da última aba", () => {
    expect(
      resolveIndex({ ...base, current: 2, translationX: -300, velocityX: -900 }),
    ).toBe(2);
  });

  test("não passa da primeira aba", () => {
    expect(
      resolveIndex({ ...base, current: 0, translationX: 300, velocityX: 900 }),
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx jest components/domain/SwipeableTabs.test.tsx`
Expected: FAIL — "Cannot find module './SwipeableTabs'".

- [ ] **Step 3: Criar o componente**

Cria `apps/mobile/components/domain/SwipeableTabs.tsx`:

```tsx
import { Children, useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/** Fração da largura da tela que confirma a troca de aba por distância. */
export const SWIPE_DISTANCE_RATIO = 1 / 3;
/** Velocidade (px/s) que confirma a troca mesmo sem distância suficiente. */
export const SWIPE_VELOCITY_THRESHOLD = 500;

const SPRING = { damping: 20, stiffness: 180 } as const;
/** Ignora arrastos quase verticais para não sequestrar o scroll das listas. */
const ACTIVE_OFFSET_X: [number, number] = [-12, 12];
const FAIL_OFFSET_Y: [number, number] = [-12, 12];

/**
 * Índice da aba após um gesto: troca se o arrasto passar de
 * SWIPE_DISTANCE_RATIO da largura OU se o fling for rápido o bastante.
 * Sem wrap-around — nas bordas, o índice é preservado.
 */
export function resolveIndex({
  current,
  translationX,
  velocityX,
  width,
  count,
}: {
  current: number;
  translationX: number;
  velocityX: number;
  width: number;
  count: number;
}): number {
  "worklet";
  const farEnough = Math.abs(translationX) > width * SWIPE_DISTANCE_RATIO;
  const fastEnough = Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD;
  if (!farEnough && !fastEnough) return current;

  // Distância manda quando existe; senão, a direção vem da velocidade.
  // Negativo = arrastou para a esquerda = próxima aba.
  const direction = farEnough ? (translationX < 0 ? 1 : -1) : velocityX < 0 ? 1 : -1;
  const next = current + direction;
  return Math.min(Math.max(next, 0), count - 1);
}

/**
 * Pager horizontal controlado. Não conhece o domínio — recebe o índice ativo,
 * um callback de mudança e as cenas como filhos.
 */
export function SwipeableTabs({
  index,
  onIndexChange,
  children,
}: {
  index: number;
  onIndexChange: (index: number) => void;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const scenes = Children.toArray(children);
  const count = scenes.length;

  const translateX = useSharedValue(-index * width);
  const startX = useSharedValue(0);
  // Espelho do índice em shared value: o worklet do gesto lê este valor em vez
  // de capturar a prop, evitando closure velha entre re-renders.
  const indexSV = useSharedValue(index);

  useEffect(() => {
    indexSV.value = index;
    translateX.value = withSpring(-index * width, SPRING);
  }, [index, width, indexSV, translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX(ACTIVE_OFFSET_X)
    .failOffsetY(FAIL_OFFSET_Y)
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
    })
    .onEnd((e) => {
      const next = resolveIndex({
        current: indexSV.value,
        translationX: e.translationX,
        velocityX: e.velocityX,
        width,
        count,
      });
      translateX.value = withSpring(-next * width, SPRING);
      if (next !== indexSV.value) {
        indexSV.value = next;
        runOnJS(onIndexChange)(next);
      }
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View className="flex-1 flex-row" style={[{ width: width * count }, style]}>
        {scenes.map((scene, i) => (
          <View key={i} style={{ width }} className="flex-1">
            {scene}
          </View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx jest components/domain/SwipeableTabs.test.tsx`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/domain/SwipeableTabs.tsx apps/mobile/components/domain/SwipeableTabs.test.tsx
git commit -m "feat(mobile): componente SwipeableTabs com pager horizontal"
```

---

### Task 9: Integrar o swipe na Home

Substitui os três blocos condicionais (`activeTab === "..." && ...`) pelas cenas do `SwipeableTabs`. O `HomeHeader` segue sendo a barra de abas visível — nada muda nela. `activeTab` continua a fonte da verdade, sincronizada nos dois sentidos.

**Files:**
- Modify: `app/(app)/index.tsx:47,397-437`

**Interfaces:**
- Consumes: `SwipeableTabs` (Task 8), `TABS` (Task 4).

O `MealComposer` (linhas 441-456) fica **fora** do `SwipeableTabs`, absolutamente posicionado como hoje — comportamento atual preservado.

- [ ] **Step 1: Adicionar imports**

Em `app/(app)/index.tsx`, junto aos imports de componentes:

```tsx
import { SwipeableTabs } from "@/components/domain/SwipeableTabs";
```

E estende o import já existente de `HomeHeader` para trazer `TABS`:

```tsx
import { HomeHeader, greetingFor, TABS, type HomeTab } from "@/components/domain/HomeHeader";
```

- [ ] **Step 2: Extrair a cena da Home para uma variável**

Logo depois de `macroPanel` (após a linha 395), adiciona:

```tsx
  const homeScene = (
    <>
      {macroPanel}
      {listHeader}
      {mealsQuery.isLoading ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss} />
      ) : items.length === 0 ? (
        <Pressable className="flex-1" onPress={Keyboard.dismiss}>
          <Card variant="flat" className="mx-4">
            <EmptyMealsState />
          </Card>
        </Pressable>
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={(m) => (m as OptimisticMeal).id}
          renderItem={renderItem as never}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          itemLayoutAnimation={LinearTransition.springify().damping(20).stiffness(180)}
          refreshControl={
            <RefreshControl
              refreshing={mealsQuery.isRefetching || summaryQuery.isRefetching}
              onRefresh={() => {
                void mealsQuery.refetch();
                void summaryQuery.refetch();
              }}
              tintColor={colors.primary[400]}
            />
          }
        />
      )}
    </>
  );
```

- [ ] **Step 3: Trocar os condicionais pelo pager**

Substitui o trecho das três condicionais (linhas 401-437, de `{activeTab === "home" && (` até `{activeTab === "analises" && <AnalisesPanel />}`) por:

```tsx
        <SwipeableTabs
          index={TABS.findIndex((t) => t.key === activeTab)}
          onIndexChange={(i) => setActiveTab(TABS[i]!.key)}
        >
          {homeScene}
          <FeedTabContent />
          <AnalisesPanel />
        </SwipeableTabs>
```

- [ ] **Step 4: Verificar typecheck e suíte**

Run: `npm run typecheck && npx jest`
Expected: tsc limpo; suíte verde.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/index.tsx
git commit -m "feat(mobile): navegação por swipe entre Home, Social e Análises"
```

---

### Task 10: Feedback de toque em cards e abas

O codebase já expressa press feedback com o modificador `active:` do NativeWind (`Button.tsx:26-30` usa `active:bg-*`; `HistoryDayCard.tsx:55` usa `active:opacity-80`). Esta task fecha as lacunas seguindo o mesmo idioma — sem hook novo, sem mudança estrutural.

Fora de escopo, com motivo:
- `Button.tsx` — **já tem** feedback (`active:bg-primary-500` etc.). Adicionar escala exigiria plumbing de `className` por um wrapper animado, com risco de quebrar layouts de consumidores (`w-full`, `flex-1`), em troca de ganho marginal.
- `HistoryDayCard.tsx` — **já tem** `active:opacity-80`.

**Files:**
- Modify: `components/domain/MealCard.tsx` (a `Pressable` da linha 59)
- Modify: `components/domain/HomeHeader.tsx` (a `Pressable` das abas, linhas 77-86)
- Modify: `components/domain/FeedTabContent.tsx` (as duas `Pressable` de sub-aba)

- [ ] **Step 1: Ler a Pressable do MealCard**

Run: `sed -n '55,70p' apps/mobile/components/domain/MealCard.tsx`

A `className` é montada por array (`className={[...]}`). Adiciona `"active:opacity-70"` como mais um item do array, preservando a composição existente.

- [ ] **Step 2: Adicionar feedback nas abas da HomeHeader**

Em `components/domain/HomeHeader.tsx`, na `className` da `Pressable` das abas (linhas 83-85), acrescenta `active:opacity-70`:

```tsx
              className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-70 ${
                active ? "bg-primary-400" : ""
              }`}
```

- [ ] **Step 3: Adicionar feedback nas sub-abas do Social**

Em `components/domain/FeedTabContent.tsx`, nas duas `Pressable`, acrescenta `active:opacity-70` à `className`:

```tsx
          className={`min-h-[44px] flex-1 items-center justify-center rounded-full active:opacity-70 ${subTab === "posts" ? "bg-white" : ""}`}
```

```tsx
          className={`min-h-[44px] flex-1 items-center justify-center rounded-full active:opacity-70 ${subTab === "friends" ? "bg-white" : ""}`}
```

- [ ] **Step 4: Verificar typecheck e suíte**

Run: `npm run typecheck && npx jest`
Expected: tsc limpo; suíte verde.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/domain/MealCard.tsx apps/mobile/components/domain/HomeHeader.tsx apps/mobile/components/domain/FeedTabContent.tsx
git commit -m "feat(mobile): feedback de toque em cards de refeição e abas"
```

---

### Task 11: Transição entre telas

Nenhum `Stack` do projeto define `animation` — no web o default do expo-router praticamente não anima, o que produz a sensação de "travado". As telas com `presentation` explícito (`modal`, `formSheet`) mantêm o comportamento próprio.

**Files:**
- Modify: `app/_layout.tsx:59`
- Modify: `app/(app)/_layout.tsx:58`

- [ ] **Step 1: Stack raiz**

Em `app/_layout.tsx`, linha 59:

```tsx
            <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
```

- [ ] **Step 2: Stack do app**

Em `app/(app)/_layout.tsx`, linha 58:

```tsx
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
```

- [ ] **Step 3: Verificar typecheck e suíte**

Run: `npm run typecheck && npx jest`
Expected: tsc limpo; suíte verde.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/app/\(app\)/_layout.tsx
git commit -m "feat(mobile): transição em fade entre telas"
```

---

### Task 12: Entrada suave dos itens de lista

Itens aparecem todos de uma vez. Ambas as listas já usam `Animated.FlatList` / cards próprios, então é adição de prop.

**Files:**
- Modify: `app/(app)/index.tsx` (dentro de `renderItem`, linhas 248-266)
- Modify: `app/(app)/history/index.tsx` (o `renderItem` da FlatList)

**Interfaces:**
- Consumes: `FadeInDown` de `react-native-reanimated`.

Escalonamento limitado aos 10 primeiros itens: além disso o atraso acumulado ficaria perceptível na rolagem.

- [ ] **Step 1: Animar os cards de refeição**

Em `app/(app)/index.tsx`, estende o import de reanimated para incluir `FadeInDown`:

```tsx
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
```

E no `renderItem` (linhas 248-266), envolve o retorno com `Animated.View`:

```tsx
  const renderItem = useMemo(
    () =>
      function MealListItem({ item, index }: { item: OptimisticMeal; index: number }) {
        if (item.__status === "processing") return <MealCardSkeleton />;
        return (
          <Animated.View entering={FadeInDown.duration(250).delay(Math.min(index, 9) * 40)}>
            <MealCardSwipeable
              meal={item}
              onPress={() =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                router.push({ pathname: "/(app)/meal/[id]" as any, params: { id: item.id } })
              }
              onDelete={() => handleDelete(item.id)}
            />
          </Animated.View>
        );
      },
    // `handleDelete` captures `day`; including it ensures renderItem is
    // recreated at day rollover — FlatList compares by data reference anyway.
    [router, handleDelete],
  );
```

- [ ] **Step 2: Animar os cards de histórico**

Em `app/(app)/history/index.tsx`, adiciona o import:

```tsx
import Animated, { FadeInDown } from "react-native-reanimated";
```

E envolve o conteúdo do `renderItem`:

```tsx
            renderItem={({ item, index }) => (
              <Animated.View
                className="flex-1"
                entering={FadeInDown.duration(250).delay(Math.min(index, 9) * 40)}
              >
                {item.type === "filled" ? (
                  <HistoryDayCard summary={item.summary} softMode={profile.soft_mode} />
                ) : (
                  <HistoryEmptyDayCard day={item.day} />
                )}
              </Animated.View>
            )}
```

- [ ] **Step 3: Verificar typecheck e suíte**

Run: `npm run typecheck && npx jest`
Expected: tsc limpo; suíte verde.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/index.tsx apps/mobile/app/\(app\)/history/index.tsx
git commit -m "feat(mobile): entrada escalonada dos itens de lista"
```

---

### Task 13: Verificação final

Fecha o loop: suíte automatizada + verificação visual no browser dos itens que só existem como pixels.

- [ ] **Step 1: Suíte completa e typecheck**

Run: `npm run typecheck && npx jest`
Expected: tsc limpo; ≥52 testes passando (37 baseline + 15 novos), 0 falhas.

- [ ] **Step 2: Subir o preview**

Usar `preview_start` com `{name: "mobile-web"}` e `resize_window` para viewport mobile (375×812), garantindo o branch `width < 1024`.

- [ ] **Step 3: Conferir console limpo**

`read_console_messages` — nenhum erro novo. Warnings pré-existentes (`expo-av` deprecated, `shadow*` deprecated) são aceitáveis.

- [ ] **Step 4: Percorrer a checklist visual**

Confirmar cada item, com screenshot dos que mudam de aparência:

1. Loading do gate de onboarding em menta, não azul.
2. Três pontinhos com bounce em onda na tela de cálculo de metas.
3. Nenhum anel azul ao focar um input; borda menta ainda indica foco.
4. Swipe lateral alterna Home ↔ Social ↔ Análises, com a aba destacada acompanhando.
5. Toque na aba também anima a transição.
6. Cards e abas escurecem ao toque.
7. Navegação entre telas com fade.
8. Itens de lista entram escalonados.
9. Avatar e pill de streak com a mesma altura no header.
10. Respiro visível entre a barra de abas e o card de resumo.
11. Aba lê "Social"; sub-aba lê "Feed".
12. Tocar no streak da Home abre o Histórico.
13. Histórico exibe o pill de streak no cabeçalho.
14. Scroll vertical das listas continua funcionando (o `failOffsetY` do pan não pode tê-lo sequestrado).

- [ ] **Step 5: Relatar honestamente**

Reportar o que foi verificado e o que não pôde ser. Qualquer item que falhar vira correção antes de declarar concluído — não declarar sucesso sem evidência.
```

---

## Auto-revisão

**Cobertura da spec:** Grupo 1 → Tasks 1-2. Grupo 2 → Task 3. Grupo 3 → Tasks 8-9. Grupo 4.1 → Task 10; 4.2 → Task 11; 4.3 → Task 12. Grupo 5 → Task 5. Grupo 6 → Task 4. Grupo 7 → Tasks 6-7. Verificação → Task 13. Sem lacunas.

**Placeholders:** nenhum "TBD"/"similar à Task N"/"tratar edge cases". Todo passo de código traz o código.

**Consistência de tipos:** `TABS` é exportado na Task 4 e consumido na Task 9 com a mesma forma. `resolveIndex` e `SwipeableTabs` são definidos na Task 8 com as assinaturas que a Task 9 usa. `LoadingDots` é criado na Task 3 e consumido no mesmo passo.

**Desvio consciente da spec:** o Grupo 4.1 previa um hook `usePressAnimation` com escala via Reanimated. A Task 10 usa o modificador `active:` do NativeWind porque o codebase já expressa press feedback assim (`Button.tsx:26-30`, `HistoryDayCard.tsx:55`) — mesmo resultado percebido, sem hook novo nem risco de quebrar layout. Consequência: `Button` e `HistoryDayCard` saem de escopo por já terem feedback.
