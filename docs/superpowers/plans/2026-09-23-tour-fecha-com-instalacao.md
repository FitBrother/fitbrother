# Tour fecha com a instalação do atalho Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No web, o tour termina no passo de instalar o atalho (Instalar/Entendi ou Pular), e "Pular" em passos anteriores leva a esse passo.

**Architecture:** `profile-shortcut-card` vira o último passo de `TOUR_STEPS` e `visibleSteps` troca o texto dele conforme o navegador. O `skip` do provider pula para o atalho quando ele ainda está à frente; no atalho (ou sem atalho) encerra. O `TourOverlay` mostra no último passo, quando ele é o atalho, "Pular" + "Instalar" (Chrome: `promptEvent.prompt()`) ou "Entendi" (Safari/iOS).

**Tech Stack:** React Native + react-native-web · Expo Router 6 · Jest + @testing-library/react-native.

**Spec:** design aprovado no chat em 2026-09-23 (base: `docs/superpowers/specs/2026-09-23-tour-guiado-web-design.md`).

## Global Constraints

- Vale para todo o web (desktop e celular); no nativo o passo de atalho não existe e nada muda (último passo: Metas, só "Concluir").
- Textos exatos do atalho: Chrome → "Instale o Fitbrother para abrir direto da sua tela, como um app."; Mac Safari → "Para instalar, clique em Compartilhar na barra de endereço e escolha “Adicionar ao Dock”."; iOS → "Para instalar, toque em Compartilhar e depois em “Adicionar à Tela de Início”."
- Instalar/Entendi/Pular no atalho encerram o tour (volta pra Home, persiste `tutorial_completed`).
- Comandos em `apps/mobile`: `npx jest <path>`, `npx tsc --noEmit -p .`, `npx eslint components app lib --max-warnings 0`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Atalho por último e texto por navegador (`steps.ts`)

**Files:** Modify `apps/mobile/lib/tour/steps.ts`; Test `apps/mobile/lib/tour/steps.test.ts`

**Interfaces:** Produces `SHORTCUT_STEP_ID = "profile-shortcut-card"` (const exportada); `visibleSteps` inalterada na assinatura.

- [ ] **Step 1: Testes** — em `steps.test.ts`, mover `"profile-shortcut-card"` para o fim nas listas de "a ordem dos passos bate com a spec" e "tela de cada passo" (`["profile-shortcut-card", "profile"]` por último) e acrescentar:

```ts
describe("passo do atalho", () => {
  test("é o último quando existe", () => {
    expect(visibleSteps("installable-chrome").at(-1)?.id).toBe("profile-shortcut-card");
    expect(visibleSteps("native").at(-1)?.id).toBe("goals-editor");
  });

  test("texto conforme o navegador", () => {
    const copy = (status: Parameters<typeof visibleSteps>[0]) =>
      visibleSteps(status).find((s) => s.id === "profile-shortcut-card")?.copy;
    expect(copy("installable-chrome")).toBe(
      "Instale o Fitbrother para abrir direto da sua tela, como um app.",
    );
    expect(copy("installable-mac-safari")).toBe(
      "Para instalar, clique em Compartilhar na barra de endereço e escolha “Adicionar ao Dock”.",
    );
    expect(copy("installable-ios")).toBe(
      "Para instalar, toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest lib/tour/steps.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

1. Em `TOUR_STEPS`, mover o objeto `profile-shortcut-card` para depois de `goals-editor`.
2. Acrescentar:

```ts
export const SHORTCUT_STEP_ID: TourStepId = "profile-shortcut-card";

/** Texto do passo do atalho por navegador — Chrome tem prompt nativo; Safari
 * e iOS só instalam à mão, então o balão ensina o caminho. */
const SHORTCUT_COPY: Partial<Record<InstallPromptState["status"], string>> = {
  "installable-chrome": "Instale o Fitbrother para abrir direto da sua tela, como um app.",
  "installable-mac-safari":
    "Para instalar, clique em Compartilhar na barra de endereço e escolha “Adicionar ao Dock”.",
  "installable-ios":
    "Para instalar, toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
};
```

3. Em `visibleSteps`, depois de filtrar e antes do ramo de layout:

```ts
  const shortcutCopy = SHORTCUT_COPY[installStatus];
  const withCopy = shortcutCopy
    ? steps.map((s) => (s.id === SHORTCUT_STEP_ID ? { ...s, copy: shortcutCopy } : s))
    : steps;
```

e usar `withCopy` no lugar de `steps` no retorno (compacto e desktop).

- [ ] **Step 4: Rodar e ver passar** — `npx jest lib/tour/steps.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(mobile): atalho de instalação vira o último passo do tour`

---

### Task 2: "Pular" leva ao atalho (`tour-context.tsx`)

**Files:** Modify `apps/mobile/lib/tour/tour-context.tsx`; Test `apps/mobile/lib/tour/tour-context.test.tsx`

**Interfaces:** Consumes `SHORTCUT_STEP_ID` (Task 1). Contexto inalterado.

- [ ] **Step 1: Testes** — ajustar ao novo último passo e ao novo `skip`:

1. "next no último passo encerra…": `pressNextUntil(getByTestId, "profile-shortcut-card")`.
2. Trocar "skip encerra o tour em qualquer passo e persiste" por:

```ts
  test("skip num passo do meio pula pro atalho; no atalho encerra e persiste", async () => {
    const { getByTestId, findByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("skip"));
    expect(getByTestId("step")).toHaveTextContent("profile-shortcut-card");
    expect(mockPatchAccountSettings).not.toHaveBeenCalled();
    fireEvent.press(getByTestId("skip"));
    expect(await findByTestId("active")).toHaveTextContent("false");
    expect(mockPatchAccountSettings).toHaveBeenCalledWith({ tutorial_completed: true });
  });

  test("sem passo de atalho (nativo), skip encerra", async () => {
    mockInstallStatus = "native";
    const { getByTestId, findByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("skip"));
    expect(await findByTestId("active")).toHaveTextContent("false");
  });
```

3. "empurra Histórico, Perfil e Metas…": sequência `history-day` (push history) → `profile-goals` (push profile) → `goals-editor` (push goals) → `profile-shortcut-card` (push profile de novo: `expect(mockPush).toHaveBeenLastCalledWith("/(app)/profile")`).
4. "concluir fora da Home volta pra Home": `pressNextUntil(getByTestId, "profile-shortcut-card")` com `mockPathname = "/profile"`.
5. "pular na Home não navega": trocar por `mockInstallStatus = "native"` no início (sem atalho, skip encerra na Home sem `dismissTo`).

- [ ] **Step 2: Rodar e ver falhar** — `npx jest lib/tour/tour-context.test.tsx` → FAIL.

- [ ] **Step 3: Implementar**

```ts
  // Índice do atalho no roteiro atual (-1 quando não há) — número, não o
  // array `steps`, pra `skip` manter a identidade entre renders.
  const shortcutIndex = steps.findIndex((s) => s.id === SHORTCUT_STEP_ID);

  const skip = useCallback(() => {
    if (stepIndex === null) return;
    // Pular antes do atalho leva a ele (spec: o tour sempre oferece a
    // instalação); no atalho, ou sem atalho, encerra.
    if (shortcutIndex !== -1 && stepIndex < shortcutIndex) {
      setStepIndex(shortcutIndex);
      return;
    }
    finish();
  }, [stepIndex, shortcutIndex, finish]);
```

(import `SHORTCUT_STEP_ID` de `./steps`).

- [ ] **Step 4: Rodar e ver passar** — `npx jest lib/tour` → PASS.
- [ ] **Step 5: Commit** — `feat(mobile): pular o tour leva ao passo de instalar o atalho`

---

### Task 3: Botões do último passo (`TourOverlay.tsx`)

**Files:** Modify `apps/mobile/components/tour/TourOverlay.tsx`; Test `apps/mobile/components/tour/TourOverlay.test.tsx`

**Interfaces:** Consumes `SHORTCUT_STEP_ID`; `useInstallPrompt()` (`installable-chrome` traz `promptEvent: { prompt(): Promise<void>; userChoice: Promise<unknown> }`).

- [ ] **Step 1: Testes**

1. Trocar o mock fixo por status variável:

```ts
const mockPrompt = jest.fn(async () => {});
let mockInstall: { status: string; promptEvent?: object } = { status: "installable-chrome" };
jest.mock("@/lib/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => mockInstall,
}));
```

com `beforeEach(() => { mockInstall = { status: "installable-chrome", promptEvent: { prompt: mockPrompt, userChoice: Promise.resolve({ outcome: "accepted" }) } }; mockNext.mockReset(); mockSkip.mockReset(); })`.

2. "no último passo só aparece 'Concluir'": definir `mockInstall = { status: "native" }` no início (último = `goals-editor`).
3. Acrescentar:

```ts
  test("atalho no Chrome: Pular e Instalar; Instalar abre o prompt e encerra", async () => {
    mockTour = {
      active: true,
      currentStepId: "profile-shortcut-card",
      targets: { "profile-shortcut-card": { x: 10, y: 300, width: 300, height: 80 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText, queryByLabelText } = render(<TourOverlay />);
    expect(queryByLabelText("Concluir tour")).toBeNull();
    fireEvent.press(getByLabelText("Pular tour"));
    expect(mockSkip).toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(getByLabelText("Instalar o app"));
    });
    expect(mockPrompt).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  test("atalho no Safari do Mac: texto com o caminho e botão Entendi", () => {
    mockInstall = { status: "installable-mac-safari" };
    mockTour = {
      active: true,
      currentStepId: "profile-shortcut-card",
      targets: { "profile-shortcut-card": { x: 10, y: 300, width: 300, height: 80 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByText, getByLabelText } = render(<TourOverlay />);
    expect(
      getByText(
        "Para instalar, clique em Compartilhar na barra de endereço e escolha “Adicionar ao Dock”.",
      ),
    ).toBeTruthy();
    fireEvent.press(getByLabelText("Concluir tour"));
    expect(mockNext).toHaveBeenCalled();
    expect(getByLabelText("Pular tour")).toBeTruthy();
  });
```

(importar `act` de `@testing-library/react-native` e `beforeEach` de `@jest/globals`).

- [ ] **Step 2: Rodar e ver falhar** — `npx jest components/tour/TourOverlay.test.tsx` → FAIL.

- [ ] **Step 3: Implementar**

1. Import `SHORTCUT_STEP_ID` de `@/lib/tour/steps`.
2. Após `const isLast = …`:

```ts
  const isShortcutLast = isLast && step.id === SHORTCUT_STEP_ID;
  // Chrome/Edge: o balão dispara o prompt nativo; Safari/iOS não têm prompt
  // programático — o texto do passo ensina o caminho e o botão só fecha.
  const chromeInstall = install.status === "installable-chrome" ? install : null;
  const handleInstall = async () => {
    try {
      if (chromeInstall) {
        await chromeInstall.promptEvent.prompt();
        await chromeInstall.promptEvent.userChoice;
      }
    } finally {
      next();
    }
  };
```

3. Substituir o bloco de botões por:

```tsx
            <View className="flex-row justify-end gap-2">
              {isLast && !isShortcutLast ? (
                <Button label="Concluir" size="sm" onPress={next} accessibilityLabel="Concluir tour" />
              ) : (
                <>
                  <Button
                    label="Pular"
                    variant="ghost"
                    size="sm"
                    onPress={skip}
                    accessibilityLabel="Pular tour"
                  />
                  {isShortcutLast ? (
                    chromeInstall ? (
                      <Button
                        label="Instalar"
                        size="sm"
                        onPress={handleInstall}
                        accessibilityLabel="Instalar o app"
                      />
                    ) : (
                      <Button
                        label="Entendi"
                        size="sm"
                        onPress={next}
                        accessibilityLabel="Concluir tour"
                      />
                    )
                  ) : (
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

- [ ] **Step 4: Rodar e ver passar** — `npx jest components/tour` → PASS; depois `npx tsc --noEmit -p . && npx eslint components app lib --max-warnings 0 && npx jest`.
- [ ] **Step 5: Commit** — `feat(mobile): tour termina oferecendo instalar o atalho`

---

### Task 4: Validação no navegador

- [ ] Chrome em `http://localhost:8081` (≥ 1024 e < 1024): Rever tutorial → Próximo até Metas → Perfil com o card de instalar destacado → "Instalar" abre o prompt; ao aceitar/recusar volta pra Home.
- [ ] "Pular" no passo 2 → vai direto ao atalho no Perfil; "Pular" ali encerra.
- [ ] Metro sem `ERROR`/`Uncaught`.
