# Tour guiado no web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rodar o roteiro de 10 passos também no layout desktop do web (≥ 1024 px), com alvos na Sidebar e telas de Feed/Análises abertas.

**Architecture:** `steps.ts` ganha `tourLayout(width)` e variantes `desktop` por passo, aplicadas por `visibleSteps(status, layout)`. O provider tira a trava do desktop e navega também para `feed`/`insights`. O `TourTarget` ignora medidas 0×0 (Sidebar escondida no layout estreito). No web o overlay é `position: fixed` e trava a rolagem do `body`.

**Tech Stack:** React Native + react-native-web · Expo Router 6 · Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-23-tour-guiado-web-design.md`

## Global Constraints

- Corte de layout: `width >= 1024` → desktop (igual ao `isDesktop` da Home e ao `lg` da Sidebar).
- Ids e ordem dos 10 passos são os mesmos nos dois layouts.
- Textos desktop exatos: streak → "Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu."; home-avatar → "Aqui você abre seu perfil e suas configurações."
- Tipografia `font-sans-*`; cores via token; sem novas dependências.
- Comandos em `apps/mobile`: `npx jest <path>`, `npx tsc --noEmit -p .`, `npx eslint components app lib --max-warnings 0`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Layout e variantes desktop em `steps.ts`

**Files:**
- Modify: `apps/mobile/lib/tour/steps.ts`
- Test: `apps/mobile/lib/tour/steps.test.ts`

**Interfaces:**
- Produces: `TourScreen` += `"feed" | "insights"`; `TourLayout = "compact" | "desktop"`; `DESKTOP_MIN_WIDTH = 1024`; `tourLayout(width: number): TourLayout`; `TourStep.desktop?: { screen?: TourScreen; copy?: string }`; `visibleSteps(installStatus, layout: TourLayout = "compact"): TourStep[]`.

- [ ] **Step 1: Testes**

Acrescentar ao fim de `steps.test.ts` (e importar `tourLayout`):

```ts
describe("layout desktop", () => {
  test("tourLayout corta em 1024", () => {
    expect(tourLayout(1023)).toBe("compact");
    expect(tourLayout(1024)).toBe("desktop");
  });

  test("no desktop, Social e Análises abrem Feed e Insights", () => {
    const steps = visibleSteps("installable-chrome", "desktop");
    expect(steps.map((s) => s.id)).toEqual(TOUR_STEPS.map((s) => s.id));
    expect(steps.find((s) => s.id === "social-tab")?.screen).toBe("feed");
    expect(steps.find((s) => s.id === "analises-tab")?.screen).toBe("insights");
  });

  test("no desktop, streak e avatar usam o texto da variante", () => {
    const steps = visibleSteps("installable-chrome", "desktop");
    expect(steps.find((s) => s.id === "streak")?.copy).toBe(
      "Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu.",
    );
    expect(steps.find((s) => s.id === "home-avatar")?.copy).toBe(
      "Aqui você abre seu perfil e suas configurações.",
    );
  });

  test("no compacto nada muda", () => {
    const steps = visibleSteps("installable-chrome", "compact");
    expect(steps.find((s) => s.id === "social-tab")?.screen).toBe("home");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest lib/tour/steps.test.ts` → FAIL (`tourLayout` não existe).

- [ ] **Step 3: Implementar**

Em `steps.ts`:

```ts
export type TourScreen = "home" | "history" | "profile" | "goals" | "feed" | "insights";

export type TourLayout = "compact" | "desktop";

/** A partir daqui a navegação é a Sidebar (mesmo corte do `isDesktop` da Home
 * e do `lg` da Sidebar) e os passos usam a variante `desktop`. */
export const DESKTOP_MIN_WIDTH = 1024;

export function tourLayout(width: number): TourLayout {
  return width >= DESKTOP_MIN_WIDTH ? "desktop" : "compact";
}

export type TourStep = {
  id: TourStepId;
  copy: string;
  screen: TourScreen;
  /** Diferenças no layout desktop do web — ver spec do tour web. */
  desktop?: { screen?: TourScreen; copy?: string };
};
```

Adicionar `desktop` nos passos:

```ts
  // social-tab
  desktop: { screen: "feed" },
  // analises-tab
  desktop: { screen: "insights" },
  // streak
  desktop: {
    copy: "Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu.",
  },
  // home-avatar
  desktop: { copy: "Aqui você abre seu perfil e suas configurações." },
```

E trocar `visibleSteps`:

```ts
export function visibleSteps(
  installStatus: InstallPromptState["status"],
  layout: TourLayout = "compact",
): TourStep[] {
  const steps = SHORTCUT_SKIPPED_STATUSES.includes(installStatus)
    ? TOUR_STEPS.filter((step) => step.id !== "profile-shortcut-card")
    : TOUR_STEPS;
  if (layout === "compact") return steps;
  return steps.map(({ desktop, ...step }) => ({ ...step, ...desktop }));
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest lib/tour/steps.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add apps/mobile/lib/tour/steps.ts apps/mobile/lib/tour/steps.test.ts && git commit -m "feat(mobile): variantes desktop do roteiro do tour"`

---

### Task 2: `TourTarget` ignora alvo invisível

**Files:**
- Modify: `apps/mobile/components/tour/TourTarget.tsx`
- Test: `apps/mobile/components/tour/TourTarget.test.tsx`

- [ ] **Step 1: Teste**

```ts
test("alvo invisível (0×0, display: none) nunca registra", () => {
  measureInWindow.mockImplementation((cb) => cb(0, 0, 0, 0));
  render(
    <TourTarget id="home-tab">
      <Text>Home</Text>
    </TourTarget>,
  );
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(mockRegisterTarget).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest components/tour/TourTarget.test.tsx` → FAIL (registra 0×0 no teto de 1 s).

- [ ] **Step 3: Implementar**

No `tick`, a condição de estabilidade exige área (`width > 0 && height > 0` no lugar de `width > 0`) e o teto deixa de registrar alvo vazio:

```ts
        if (stable >= STABLE_FRAMES) {
          registerTarget(id, rect);
          return;
        }
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          // Alvo invisível (ex.: Sidebar com `display: none` no layout
          // estreito, que divide o id com a aba do HomeHeader) mede 0×0 e não
          // registra — o visível vence; sem nenhum, a rede de segurança de 2 s
          // do provider avança o passo.
          if (width > 0 && height > 0) registerTarget(id, rect);
          return;
        }
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest components/tour/TourTarget.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "fix(mobile): alvo invisível do tour não registra medida vazia"`

---

### Task 3: Provider no desktop

**Files:**
- Modify: `apps/mobile/lib/tour/tour-context.tsx`
- Test: `apps/mobile/lib/tour/tour-context.test.tsx`

**Interfaces:**
- Consumes: `tourLayout`, `visibleSteps(status, layout)`, `TourScreen` (Task 1).

- [ ] **Step 1: Testes**

Trocar o teste "no layout desktop (width >= 1024) o tour não inicia" por:

```ts
  test("no layout desktop (web ≥ 1024) o tour inicia", () => {
    mockLarguraJanela = 1280;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("active")).toHaveTextContent("true");
  });
```

E, no `describe("navegação do roteiro")`:

```ts
  test("no desktop, Social e Análises abrem Feed e Insights", () => {
    mockLarguraJanela = 1280;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    expect(mockPush).toHaveBeenCalledWith("/(app)/feed");
    fireEvent.press(getByTestId("next")); // analises-tab
    expect(mockPush).toHaveBeenCalledWith("/(app)/insights");
  });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest lib/tour/tour-context.test.tsx` → FAIL.

- [ ] **Step 3: Implementar**

1. Import: `import { tourLayout, visibleSteps, type TourScreen, type TourStepId } from "./steps";`
2. Apagar a constante `DESKTOP_MIN_WIDTH` (e seu comentário) do arquivo.
3. `const steps = visibleSteps(install.status, tourLayout(width));`
4. Em `startTour`, apagar `if (width >= DESKTOP_MIN_WIDTH) return;`; deps `[stepIndex]`.
5. `SCREEN_ROUTE` ganha:

```ts
  feed: { pathname: "/feed", href: "/(app)/feed" },
  insights: { pathname: "/insights", href: "/(app)/insights" },
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest lib/tour` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): tour roda no desktop web e abre Feed e Análises"`

---

### Task 4: Overlay no web

**Files:**
- Modify: `apps/mobile/components/tour/TourOverlay.tsx`
- Test: `apps/mobile/components/tour/TourOverlay.test.tsx`

- [ ] **Step 1: Teste**

Trocar `const mockLarguraJanela = 375;` por `let mockLarguraJanela = 375;` e acrescentar:

```ts
  test("no desktop mostra o texto da variante", () => {
    mockLarguraJanela = 1280;
    mockTour = {
      active: true,
      currentStepId: "streak",
      targets: { streak: { x: 900, y: 40, width: 80, height: 44 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByText } = render(<TourOverlay />);
    expect(
      getByText(
        "Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu.",
      ),
    ).toBeTruthy();
    mockLarguraJanela = 375;
  });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest components/tour/TourOverlay.test.tsx` → FAIL.

- [ ] **Step 3: Implementar**

1. Imports: `import { useEffect, useRef, useState } from "react";`, `import { Platform, View, Text, useWindowDimensions } from "react-native";`, `import { tourLayout, visibleSteps } from "@/lib/tour/steps";`.
2. Antes do `if (!active || !currentStepId) return null;`:

```ts
  // Web: a página rola por baixo com a roda do mouse e o destaque ficaria
  // fora do lugar — trava a rolagem do documento enquanto o tour está ativo.
  useEffect(() => {
    if (Platform.OS !== "web" || !active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
```

3. `const steps = visibleSteps(install.status, tourLayout(width));`
4. No `style` do `View` raiz, trocar `position: "absolute"` por:

```ts
        // Web: `fixed` pra cobrir a viewport mesmo com o documento rolado
        // (layout desktop usa sticky + rolagem de página). O tipo do RN não
        // conhece "fixed"; o react-native-web aceita.
        position: (Platform.OS === "web" ? "fixed" : "absolute") as "absolute",
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest components/tour` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): overlay do tour fixo e com rolagem travada no web"`

---

### Task 5: Alvos do desktop

**Files:**
- Modify: `apps/mobile/components/layout/Sidebar.tsx`
- Modify: `apps/mobile/app/(app)/index.tsx` (ramo `isDesktop`, card "Hoje")

- [ ] **Step 1: Sidebar**

Importar `TourTarget` e `type TourStepId`, mapear os itens que o tour aponta:

```ts
/** Itens da Sidebar que o tour destaca no layout desktop. */
const TOUR_ID: Partial<Record<string, TourStepId>> = {
  "/": "home-tab",
  "/(app)/feed": "social-tab",
  "/(app)/insights": "analises-tab",
};
```

No `NAV_ITEMS.map`, envolver o `Pressable` quando houver id:

```tsx
        const tourId = TOUR_ID[item.href];
        const link = (
          <Pressable key={item.href} …props e filhos inalterados… </Pressable>
        );
        return tourId ? (
          <TourTarget key={item.href} id={tourId}>
            {link}
          </TourTarget>
        ) : (
          link
        );
```

E envolver o `Pressable` do perfil (`accessibilityLabel="Perfil"`) em `<TourTarget id="home-avatar">…</TourTarget>`.

- [ ] **Step 2: Home desktop — streak**

No ramo `isDesktop` de `app/(app)/index.tsx`:

```tsx
            {!profile.soft_mode && streakView && (
              <TourTarget id="streak">
                <StreakCounter
                  current={streakView.streak.current_streak}
                  atRisk={streakView.atRisk}
                />
              </TourTarget>
            )}
```

(importar `TourTarget` de `@/components/tour/TourTarget` se ainda não estiver importado).

- [ ] **Step 3: Verificar** — `npx tsc --noEmit -p . && npx eslint components app lib --max-warnings 0 && npx jest` → tudo limpo, todos PASS. Se algum teste que renderiza `Sidebar`/Home quebrar por importar o `tour-context` real, aplicar o mesmo mock usado em `HomeHeader.test.tsx`.

- [ ] **Step 4: Commit** — `git commit -m "feat(mobile): alvos do tour na Sidebar e no streak do desktop"`

---

### Task 6: Validação no navegador

- [ ] **Step 1:** `http://localhost:8081` com janela ≥ 1024 px: Configurações → Rever tutorial; conferir os 10 passos (Feed e Análises abertos com o item da Sidebar destacado, streak do card "Hoje", perfil da Sidebar), rolagem travada, "Concluir" volta pra Home.
- [ ] **Step 2:** Janela < 1024 px: mesmo roteiro do celular, sem destaque "perdido" na Sidebar escondida.
- [ ] **Step 3:** Conferir no log do Metro o `Web Bundled` sem `ERROR`/`Uncaught`.
