# Tour guiado ampliado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar o tour guiado para 10 passos (Home, +, streak → Histórico, avatar → Perfil → Metas) com toque direto no item destacado.

**Architecture:** `steps.ts` ganha `action: "tap" | "next"` e telas `home | history | profile | goals`. O `TourProvider` navega por um mapa de telas (push, ou `dismissTo` para a Home) e volta para a Home ao terminar. O `TourOverlay` põe um `Pressable` invisível sobre o recorte nos passos `tap` e troca os botões do último passo por um único "Concluir". Os alvos novos são `TourTarget` nas telas existentes.

**Tech Stack:** React Native · Expo Router 6 (`router.push`, `router.dismissTo`) · react-native-svg · Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-22-tour-guiado-ampliado-design.md`

## Global Constraints

- Tipografia só com a família `font-sans-*` (nunca `font-medium`/`font-bold`).
- Cores via token; sem hex inline em JSX.
- Hit target ≥ 44×44 pt; `accessibilityRole` em interativos, `accessibilityLabel` em alvos sem texto.
- Sem novas dependências.
- Comandos rodam em `apps/mobile`: `npx jest <path>`, `npx tsc --noEmit -p .`, `npx eslint <paths> --max-warnings 0`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Roteiro novo em `steps.ts`

**Files:**
- Modify: `apps/mobile/lib/tour/steps.ts`
- Test: `apps/mobile/lib/tour/steps.test.ts`

**Interfaces:**
- Produces: `TourStepId` (10 ids abaixo), `TourScreen = "home" | "history" | "profile" | "goals"`, `TourStep = { id; copy; screen: TourScreen; action: "tap" | "next" }`, `TOUR_STEPS`, `visibleSteps(status)` (assinatura inalterada).

- [ ] **Step 1: Reescrever o teste**

```ts
import { describe, expect, test } from "@jest/globals";
import { TOUR_STEPS, visibleSteps } from "./steps";

describe("visibleSteps", () => {
  test("inclui os 10 passos quando há atalho pra oferecer", () => {
    expect(visibleSteps("installable-chrome")).toHaveLength(10);
    expect(visibleSteps("installable-ios")).toHaveLength(10);
    expect(visibleSteps("installable-mac-safari")).toHaveLength(10);
  });

  test("tira o passo do atalho quando não há nada pra instalar", () => {
    for (const status of ["native", "installed", "unsupported"] as const) {
      expect(visibleSteps(status).map((s) => s.id)).not.toContain("profile-shortcut-card");
      expect(visibleSteps(status)).toHaveLength(9);
    }
  });

  test("a ordem dos passos bate com a spec", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "home-tab",
      "social-tab",
      "analises-tab",
      "composer-plus",
      "streak",
      "history-day",
      "home-avatar",
      "profile-shortcut-card",
      "profile-goals",
      "goals-editor",
    ]);
  });

  test("tela e ação de cada passo", () => {
    expect(TOUR_STEPS.map((s) => [s.id, s.screen, s.action])).toEqual([
      ["home-tab", "home", "next"],
      ["social-tab", "home", "tap"],
      ["analises-tab", "home", "tap"],
      ["composer-plus", "home", "tap"],
      ["streak", "home", "tap"],
      ["history-day", "history", "next"],
      ["home-avatar", "home", "tap"],
      ["profile-shortcut-card", "profile", "next"],
      ["profile-goals", "profile", "tap"],
      ["goals-editor", "goals", "next"],
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/tour/steps.test.ts`
Expected: FAIL (5 passos em vez de 10, sem `action`).

- [ ] **Step 3: Implementar**

Substituir o topo de `steps.ts` (tipos + `TOUR_STEPS`) por:

```ts
export type TourStepId =
  | "home-tab"
  | "social-tab"
  | "analises-tab"
  | "composer-plus"
  | "streak"
  | "history-day"
  | "home-avatar"
  | "profile-shortcut-card"
  | "profile-goals"
  | "goals-editor";

export type TourScreen = "home" | "history" | "profile" | "goals";

export type TourStep = {
  id: TourStepId;
  copy: string;
  screen: TourScreen;
  /** `tap`: o usuário toca no próprio item destacado pra avançar (o tour
   * captura o toque — ver spec). `next`: botão "Próximo". */
  action: "tap" | "next";
};

export const TOUR_STEPS: TourStep[] = [
  { id: "home-tab", copy: "Aqui você vê seu resumo do dia.", screen: "home", action: "next" },
  {
    id: "social-tab",
    copy: "Toque em Social para ver o progresso dos seus amigos.",
    screen: "home",
    action: "tap",
  },
  {
    id: "analises-tab",
    copy: "Toque em Análises para ver os gráficos da sua evolução.",
    screen: "home",
    action: "tap",
  },
  {
    id: "composer-plus",
    copy: "Toque no + para registrar por foto ou código de barras.",
    screen: "home",
    action: "tap",
  },
  {
    id: "streak",
    copy: "Sua ofensiva: dias seguidos registrando. Toque para ver seu histórico.",
    screen: "home",
    action: "tap",
  },
  {
    id: "history-day",
    copy: "Cada dia registrado fica aqui, com seus totais.",
    screen: "history",
    action: "next",
  },
  {
    id: "home-avatar",
    copy: "Toque na sua foto para abrir o perfil.",
    screen: "home",
    action: "tap",
  },
  {
    id: "profile-shortcut-card",
    copy: "Adicione o Fitbrother à tela inicial.",
    screen: "profile",
    action: "next",
  },
  {
    id: "profile-goals",
    copy: "Toque em Metas e macros para ajustar suas metas.",
    screen: "profile",
    action: "tap",
  },
  {
    id: "goals-editor",
    copy: "Aqui você ajusta calorias, macros e seus dados do corpo manualmente.",
    screen: "goals",
    action: "next",
  },
];
```

(`SHORTCUT_SKIPPED_STATUSES` e `visibleSteps` ficam como estão.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/tour/steps.test.ts`
Expected: PASS. (`tsc` ainda acusa `profile-avatar` em `profile.tsx` — resolvido na Task 4.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/tour/steps.ts apps/mobile/lib/tour/steps.test.ts
git commit -m "feat(mobile): roteiro do tour ampliado com passos de toque"
```

---

### Task 2: Navegação por tela e volta pra Home no `TourProvider`

**Files:**
- Modify: `apps/mobile/lib/tour/tour-context.tsx`
- Test: `apps/mobile/lib/tour/tour-context.test.tsx`

**Interfaces:**
- Consumes: `TourScreen`, `visibleSteps` (Task 1).
- Produces: contexto inalterado (`active`, `currentStepId`, `targets`, `registerTarget`, `startTour`, `next`, `skip`, `notifyMealCreated`).

- [ ] **Step 1: Atualizar os testes**

Em `tour-context.test.tsx`:

1. Adicionar um helper logo após `renderTour`:

```ts
function pressNextUntil(
  getByTestId: ReturnType<typeof renderTour>["getByTestId"],
  stepId: string,
) {
  for (let i = 0; i < 12; i++) {
    if (getByTestId("step").props.children === stepId) return;
    fireEvent.press(getByTestId("next"));
  }
  throw new Error(`não chegou em ${stepId}`);
}
```

2. Trocar o teste "next no último passo encerra o tour e persiste no servidor" por:

```ts
  test("next no último passo encerra o tour e persiste no servidor", async () => {
    const { getByTestId, findByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "goals-editor");
    fireEvent.press(getByTestId("next")); // "Concluir"
    expect(await findByTestId("active")).toHaveTextContent("false");
    expect(mockPatchAccountSettings).toHaveBeenCalledWith({ tutorial_completed: true });
  });
```

3. Substituir o `describe("navegação automática pro Perfil", ...)` inteiro por:

```ts
describe("navegação do roteiro", () => {
  test("empurra Histórico, Perfil e Metas nos passos dessas telas", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "history-day");
    expect(mockPush).toHaveBeenCalledWith("/(app)/history");
    pressNextUntil(getByTestId, "profile-shortcut-card");
    expect(mockPush).toHaveBeenCalledWith("/(app)/profile");
    pressNextUntil(getByTestId, "goals-editor");
    expect(mockPush).toHaveBeenCalledWith("/(app)/goals");
  });

  test("volta do Histórico pra Home com dismissTo no passo do avatar", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "history-day");
    mockPathname = "/history";
    fireEvent.press(getByTestId("next")); // home-avatar
    expect(mockDismissTo).toHaveBeenCalledWith("/(app)");
  });

  test("não navega se já está na tela do passo", () => {
    mockPathname = "/profile";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    mockDismissTo.mockReset();
    pressNextUntil(getByTestId, "profile-goals");
    expect(mockPush).not.toHaveBeenCalledWith("/(app)/profile");
  });
});

describe("fim do tour", () => {
  test("concluir fora da Home volta pra Home", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    // Antes de chegar no último passo: o pathname entra no próximo render e o
    // finish() lê o valor renderizado (pathnameRef).
    mockPathname = "/goals";
    pressNextUntil(getByTestId, "goals-editor");
    mockDismissTo.mockReset();
    fireEvent.press(getByTestId("next"));
    expect(mockDismissTo).toHaveBeenCalledWith("/(app)");
  });

  test("pular na Home não navega", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("skip"));
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});
```

4. Trocar o teste de `describe("passo sem atalho pra instalar")` por:

```ts
  test("com status native, do avatar vai direto pra Metas e macros", () => {
    mockInstallStatus = "native";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    pressNextUntil(getByTestId, "home-avatar");
    fireEvent.press(getByTestId("next"));
    expect(getByTestId("step")).toHaveTextContent("profile-goals");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/tour/tour-context.test.tsx`
Expected: FAIL (sem push de Histórico/Metas, sem `dismissTo` ao concluir).

- [ ] **Step 3: Implementar**

Em `tour-context.tsx`:

1. Importar o tipo: `import { visibleSteps, type TourScreen, type TourStepId } from "./steps";`
2. Adicionar, perto das outras constantes:

```ts
/** Onde cada tela do roteiro mora: `pathname` como o `usePathname` devolve e
 * `href` pra navegar. */
const SCREEN_ROUTE: Record<TourScreen, { pathname: string; href: string }> = {
  home: { pathname: "/", href: "/(app)" },
  history: { pathname: "/history", href: "/(app)/history" },
  profile: { pathname: "/profile", href: "/(app)/profile" },
  goals: { pathname: "/goals", href: "/(app)/goals" },
};
```

3. Em `finish`, antes de `void patchAccountSettings(...)`:

```ts
    // Termina sempre na Home (spec: "Ao terminar, o app volta para a Home").
    if (pathnameRef.current !== "/") router.dismissTo("/(app)");
```

e trocar as deps de `finish` para `[update, router]`. Mover a declaração de `pathnameRef` para antes de `finish` se necessário.

4. Em `startTour`, remover a linha `if (pathnameRef.current !== "/") router.dismissTo("/(app)");` (e o comentário acima dela) — o efeito de navegação abaixo passa a cuidar disso, já que o passo 1 é da tela `home`. Deps de `startTour`: `[stepIndex, width]`.

5. Substituir o efeito "Navega pro Perfil..." por:

```ts
  // Leva o usuário pra tela do passo atual — ver spec, "Navegação e abas".
  // Depende da tela (string), não do array `steps` (novo a cada render), pra
  // não empurrar a mesma rota de novo enquanto a navegação ainda está em voo.
  const currentScreen = stepIndex !== null ? steps[stepIndex]?.screen : undefined;
  useEffect(() => {
    if (!currentScreen) return;
    const route = SCREEN_ROUTE[currentScreen];
    if (pathname === route.pathname) return;
    if (currentScreen === "home") router.dismissTo(route.href);
    else router.push(route.href);
  }, [currentScreen, pathname, router]);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/tour/tour-context.test.tsx`
Expected: PASS (inclui "startTour fora da Home volta pra Home", agora via efeito).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/tour/tour-context.tsx apps/mobile/lib/tour/tour-context.test.tsx
git commit -m "feat(mobile): tour navega por Histórico/Perfil/Metas e termina na Home"
```

---

### Task 3: Toque no recorte e último passo com "Concluir" (`TourOverlay`)

**Files:**
- Modify: `apps/mobile/components/tour/TourOverlay.tsx`
- Test: `apps/mobile/components/tour/TourOverlay.test.tsx`

**Interfaces:**
- Consumes: `TourStep.action` (Task 1); `next`, `skip` do contexto.

- [ ] **Step 1: Atualizar os testes**

Trocar o teste "no último passo o botão vira 'Concluir tour'" e acrescentar os de toque:

```ts
  test("no último passo só aparece 'Concluir' (sem Pular)", () => {
    mockTour = {
      active: true,
      currentStepId: "goals-editor",
      targets: { "goals-editor": { x: 10, y: 200, width: 300, height: 44 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText, queryByLabelText, getByText } = render(<TourOverlay />);
    expect(getByText("Concluir")).toBeTruthy();
    fireEvent.press(getByLabelText("Concluir tour"));
    expect(mockNext).toHaveBeenCalled();
    expect(queryByLabelText("Pular tour")).toBeNull();
  });

  test("passo de toque: sem Próximo, e tocar no recorte avança", () => {
    mockNext.mockReset();
    mockTour = {
      active: true,
      currentStepId: "social-tab",
      targets: { "social-tab": { x: 100, y: 40, width: 44, height: 44 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText, queryByLabelText } = render(<TourOverlay />);
    expect(queryByLabelText("Próximo passo")).toBeNull();
    expect(getByLabelText("Pular tour")).toBeTruthy();
    fireEvent.press(getByLabelText("Toque em Social para ver o progresso dos seus amigos."));
    expect(mockNext).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest components/tour/TourOverlay.test.tsx`
Expected: FAIL ("Concluir" não existe; Próximo presente no passo de toque).

- [ ] **Step 3: Implementar**

1. Import: `import { Pressable, View, Text, useWindowDimensions } from "react-native";`
2. Após `const isLast = ...`: `const isTap = step.action === "tap" && !isLast;`
3. Logo depois do `</Svg>`, antes do balão:

```tsx
      {hole && isTap ? (
        // Passo de toque: o recorte vira o botão do tour (o item real embaixo
        // não recebe o toque — ver spec, "O tour roteiriza").
        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={step.copy}
          style={{
            position: "absolute",
            left: hole.x,
            top: hole.y,
            width: hole.width,
            height: hole.height,
            borderRadius: CUTOUT_RADIUS,
          }}
        />
      ) : null}
```

4. Trocar a linha de botões do balão por:

```tsx
            <View className="flex-row justify-end gap-2">
              {isLast ? (
                <Button
                  label="Concluir"
                  size="sm"
                  onPress={next}
                  accessibilityLabel="Concluir tour"
                />
              ) : (
                <>
                  <Button
                    label="Pular"
                    variant="ghost"
                    size="sm"
                    onPress={skip}
                    accessibilityLabel="Pular tour"
                  />
                  {isTap ? null : (
                    <Button
                      label="Próximo"
                      size="sm"
                      onPress={next}
                      accessibilityLabel="Próximo passo"
                    />
                  )}
                </>
              )}
            </View>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest components/tour`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/tour/TourOverlay.tsx apps/mobile/components/tour/TourOverlay.test.tsx
git commit -m "feat(mobile): toque direto no item destacado e 'Concluir' no último passo"
```

---

### Task 4: Alvos novos nas telas + aba da Home por passo

**Files:**
- Modify: `apps/mobile/components/domain/HomeHeader.tsx` (streak ~l.343, avatar ~l.404)
- Modify: `apps/mobile/components/domain/MealComposer.tsx` (botão + ~l.604)
- Modify: `apps/mobile/app/(app)/history/index.tsx` (`renderItem` ~l.106)
- Modify: `apps/mobile/app/(app)/profile.tsx` (remover `profile-avatar` ~l.169; envolver "Metas e macros" ~l.212)
- Modify: `apps/mobile/app/(app)/goals.tsx` (seletor de abas ~l.285)
- Modify: `apps/mobile/app/(app)/index.tsx` (efeito de aba ~l.173)

**Interfaces:**
- Consumes: `TourTarget({ id, children })` de `@/components/tour/TourTarget`; ids da Task 1.

- [ ] **Step 1: HomeHeader — streak e avatar**

Envolver o `Pressable` do streak (o que faz `router.push("/(app)/history")`):

```tsx
      {!softMode && streakView ? (
        <TourTarget id="streak">
          <Pressable
            onPress={() => router.push("/(app)/history" as never)}
            ...props e filhos inalterados...
          </Pressable>
        </TourTarget>
      ) : null}
```

E o `Pressable` do avatar (`accessibilityLabel="Perfil"`):

```tsx
      <TourTarget id="home-avatar">
        <Pressable
          onPress={() => router.push("/(app)/profile" as never)}
          ...props e filhos inalterados...
        </Pressable>
      </TourTarget>
```

- [ ] **Step 2: MealComposer — botão +**

Import `import { TourTarget } from "@/components/tour/TourTarget";` e envolver o `Pressable` com `accessibilityLabel="Mais opções de registro"`:

```tsx
          {!hasText && !isRecording && onPhotoPress && onScanPress ? (
            <TourTarget id="composer-plus">
              <Pressable
                onPress={() => setAttachMenuOpen(true)}
                ...props e filhos inalterados...
              </Pressable>
            </TourTarget>
          ) : ...
```

- [ ] **Step 3: Histórico — 1º card**

Import `TourTarget` e, em `renderItem`, envolver o conteúdo do índice 0:

```tsx
              renderItem={({ item, index }) => {
                const card =
                  item.type === "filled" ? (
                    <HistoryDayCard summary={item.summary} softMode={profile.soft_mode} />
                  ) : (
                    <HistoryEmptyDayCard day={item.day} />
                  );
                return (
                  <Animated.View
                    style={{ flex: 1 }}
                    entering={FadeInDown.duration(250).delay(Math.min(index, 9) * 40)}
                  >
                    {index === 0 ? <TourTarget id="history-day">{card}</TourTarget> : card}
                  </Animated.View>
                );
              }}
```

- [ ] **Step 4: Perfil — tirar `profile-avatar`, envolver Metas e macros**

Trocar `<TourTarget id="profile-avatar">…</TourTarget>` pelo seu conteúdo (o `<View className="items-center">…</View>` sem wrapper) e envolver o item:

```tsx
            <TourTarget id="profile-goals">
              <MenuItem
                icon={Target}
                label="Metas e macros"
                onPress={() => router.push("/goals" as never)}
              />
            </TourTarget>
```

- [ ] **Step 5: Metas — seletor de abas**

Import `TourTarget` e envolver o `<View className="flex-row gap-1 rounded-full bg-neutral-100 p-1">…</View>` (os dois `Pressable` "Calorias & macros" / "Meu corpo") em `<TourTarget id="goals-editor">…</TourTarget>`.

- [ ] **Step 6: Home — aba reflete o último toque**

Em `app/(app)/index.tsx`, importar `type TourStepId` de `@/lib/tour/steps`, declarar no nível do módulo:

```ts
/** Aba mostrada em cada passo do tour: reflete o último toque (tocar em
 * Social mostra o feed no passo seguinte, etc.) — ver spec. */
const TOUR_TAB: Partial<Record<TourStepId, HomeTab>> = {
  "home-tab": "home",
  "social-tab": "home",
  "analises-tab": "feed",
  "composer-plus": "analises",
  streak: "analises",
};
```

e trocar o efeito atual que mapeia `tour.currentStepId` para `setActiveTab` por:

```ts
  useEffect(() => {
    const tab = tour.currentStepId ? TOUR_TAB[tour.currentStepId] : undefined;
    if (tab) setActiveTab(tab);
  }, [tour.currentStepId]);
```

(atualizar o comentário acima do efeito: "O tour comanda a aba mostrada em cada passo — ver TOUR_TAB".)

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit -p . && npx eslint components app lib --max-warnings 0 && npx jest`
Expected: typecheck/lint limpos; todos os testes PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx apps/mobile/components/domain/MealComposer.tsx "apps/mobile/app/(app)/history/index.tsx" "apps/mobile/app/(app)/profile.tsx" "apps/mobile/app/(app)/goals.tsx" "apps/mobile/app/(app)/index.tsx"
git commit -m "feat(mobile): alvos do tour no +, streak, avatar, Histórico e Metas"
```

---

### Task 5: Validação no aparelho

- [ ] **Step 1:** Recarregar o app no Expo Go (Metro já rodando) e fazer Configurações → Rever tutorial.
- [ ] **Step 2:** Conferir os 10 passos: toque direto nos passos `tap`, Histórico abre e volta pra Home, Perfil → Metas, último card só com "Concluir", e ao concluir volta pra Home.
- [ ] **Step 3:** Conferir no log do Metro a ausência de `ERROR`/`Uncaught`.
