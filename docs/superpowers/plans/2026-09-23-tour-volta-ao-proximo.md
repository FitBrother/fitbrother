# Tour ampliado de volta ao "Próximo" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter os 10 passos do tour ampliado, mas voltar a avançar pelo botão "Próximo" em vez do toque direto no item.

**Architecture:** Remove o campo `action` dos passos e o `Pressable` sobre o recorte no `TourOverlay`; todos os passos, exceto o último, mostram "Pular" + "Próximo". Os textos deixam de pedir "Toque em…". A aba da Home volta a mostrar a aba do próprio passo.

**Tech Stack:** React Native · Expo Router 6 · Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-22-tour-guiado-ampliado-design.md` (atualizada na Task 2) + design aprovado no chat em 2026-09-23.

## Global Constraints

- Mantém: ordem dos 10 passos, navegação Histórico → Home → Perfil → Metas, último passo só com "Concluir" (sem "Pular"), volta pra Home ao terminar, medição estável do `TourTarget`.
- Tipografia `font-sans-*`; cores via token; sem novas dependências.
- Comandos em `apps/mobile`: `npx jest <path>`, `npx tsc --noEmit -p .`, `npx eslint components app lib --max-warnings 0`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Remover o modo de toque

**Files:**
- Modify: `apps/mobile/lib/tour/steps.ts`
- Modify: `apps/mobile/components/tour/TourOverlay.tsx`
- Modify: `apps/mobile/app/(app)/index.tsx` (`TOUR_TAB`)
- Test: `apps/mobile/lib/tour/steps.test.ts`, `apps/mobile/components/tour/TourOverlay.test.tsx`

**Interfaces:**
- Produces: `TourStep = { id: TourStepId; copy: string; screen: TourScreen }` (sem `action`). `TourStepId`, `TourScreen`, `TOUR_STEPS`, `visibleSteps` inalterados no resto.

- [ ] **Step 1: Atualizar os testes**

Em `steps.test.ts`, trocar o teste "tela e ação de cada passo" por:

```ts
  test("tela de cada passo", () => {
    expect(TOUR_STEPS.map((s) => [s.id, s.screen])).toEqual([
      ["home-tab", "home"],
      ["social-tab", "home"],
      ["analises-tab", "home"],
      ["composer-plus", "home"],
      ["streak", "home"],
      ["history-day", "history"],
      ["home-avatar", "home"],
      ["profile-shortcut-card", "profile"],
      ["profile-goals", "profile"],
      ["goals-editor", "goals"],
    ]);
  });

  test("nenhum texto pede pra tocar no item (o avanço é pelo Próximo)", () => {
    for (const step of TOUR_STEPS) expect(step.copy).not.toMatch(/^Toque/);
  });
```

Em `TourOverlay.test.tsx`, trocar o teste "passo de toque: sem Próximo, e tocar no recorte avança" por:

```ts
  test("passo que não é o último tem Pular e Próximo, e o recorte não é botão", () => {
    mockNext.mockReset();
    mockTour = {
      active: true,
      currentStepId: "social-tab",
      targets: { "social-tab": { x: 100, y: 40, width: 44, height: 44 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText, queryByLabelText } = render(<TourOverlay />);
    expect(getByLabelText("Pular tour")).toBeTruthy();
    fireEvent.press(getByLabelText("Próximo passo"));
    expect(mockNext).toHaveBeenCalled();
    expect(queryByLabelText("Veja o progresso dos seus amigos.")).toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/tour/steps.test.ts components/tour/TourOverlay.test.tsx`
Expected: FAIL (textos "Toque em…"; passo de Social sem "Próximo").

- [ ] **Step 3: `steps.ts` — tirar `action` e trocar textos**

Remover do tipo `TourStep` o campo `action` e seu comentário, e remover `action: ...` de todos os itens de `TOUR_STEPS`. Textos que mudam:

```ts
  { id: "social-tab", copy: "Veja o progresso dos seus amigos.", screen: "home" },
  { id: "analises-tab", copy: "Gráficos da sua evolução.", screen: "home" },
  {
    id: "composer-plus",
    copy: "No + você registra por foto ou código de barras.",
    screen: "home",
  },
  {
    id: "streak",
    copy: "Sua ofensiva: dias seguidos registrando. Tocando nela você vê seu histórico.",
    screen: "home",
  },
  {
    id: "home-avatar",
    copy: "Na sua foto você abre seu perfil e suas configurações.",
    screen: "home",
  },
  {
    id: "profile-goals",
    copy: "Em Metas e macros você ajusta suas metas.",
    screen: "profile",
  },
```

(`home-tab`, `history-day`, `profile-shortcut-card`, `goals-editor` mantêm o texto.)

- [ ] **Step 4: `TourOverlay.tsx` — tirar o recorte clicável**

1. Import: `import { View, Text, useWindowDimensions } from "react-native";` (sem `Pressable`).
2. Apagar `const isTap = step.action === "tap" && !isLast;`.
3. Apagar o bloco `{hole && isTap ? ( <Pressable …/> ) : null}` e o comentário dele.
4. No ramo não-último dos botões, trocar `{isTap ? null : ( <Button label="Próximo" … /> )}` por:

```tsx
                  <Button
                    label="Próximo"
                    size="sm"
                    onPress={next}
                    accessibilityLabel="Próximo passo"
                  />
```

- [ ] **Step 5: `index.tsx` — aba do próprio passo**

Trocar `TOUR_TAB` e seu comentário por:

```ts
/** Aba mostrada em cada passo do tour: a do próprio passo. Nos passos do + e
 * do streak a aba fica como estava (Análises). */
const TOUR_TAB: Partial<Record<TourStepId, HomeTab>> = {
  "home-tab": "home",
  "social-tab": "feed",
  "analises-tab": "analises",
};
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit -p . && npx eslint components app lib --max-warnings 0 && npx jest`
Expected: tudo limpo; todos os testes PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/tour/steps.ts apps/mobile/lib/tour/steps.test.ts apps/mobile/components/tour/TourOverlay.tsx apps/mobile/components/tour/TourOverlay.test.tsx "apps/mobile/app/(app)/index.tsx"
git commit -m "feat(mobile): tour ampliado volta a avançar pelo Próximo"
```

---

### Task 2: Spec em dia + validação no aparelho

**Files:**
- Modify: `docs/superpowers/specs/2026-09-22-tour-guiado-ampliado-design.md`

- [ ] **Step 1: Atualizar a spec**

No topo, abaixo de **Base:**, acrescentar:

```markdown
**Revisão 2026-09-23:** o toque direto foi revertido — todos os passos avançam
pelo "Próximo" (o último só com "Concluir"). Roteiro, navegação e volta pra
Home continuam valendo; as seções de "tap" abaixo ficam como histórico da
decisão.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-09-22-tour-guiado-ampliado-design.md docs/superpowers/plans/2026-09-23-tour-volta-ao-proximo.md
git commit -m "docs(tour): registra a volta ao Próximo no tour ampliado"
```

- [ ] **Step 3: Validar no Expo Go**

Recarregar o app (Metro já rodando), Configurações → Rever tutorial: cada passo com "Pular" + "Próximo", último só com "Concluir", volta pra Home ao concluir. Conferir no log do Metro a ausência de `ERROR`/`Uncaught`.
