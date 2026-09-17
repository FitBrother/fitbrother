# Tour guiado pós-primeiro-registro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disparar um tour guiado (spotlight sobre a UI real) assim que um usuário novo completa seu primeiro registro de refeição no app, passando pelas abas Home/Social/Análises e terminando no Perfil, com destaque pro cartão "Adicionar à Tela de Início" já existente.

**Architecture:** Um `TourProvider` (contexto React montado em `app/(app)/_layout.tsx`) guarda o passo atual e os retângulos medidos dos alvos na tela; um `TourOverlay` único (portal absoluto na raiz) desenha o véu com recorte + balão. As três primeiras "abas" são troca de estado local em `index.tsx` (não navegação) — o tour sincroniza com elas via `currentStepId`; só o passo de Perfil dispara `router.push` de verdade. Persistência em `profiles.tutorial_completed_at` via `PATCH /account/settings`.

**Tech Stack:** React Native (Expo Router, NativeWind v4), `react-native-svg` (já é dependência) pro recorte do spotlight, TanStack Query, Fastify + Zod no backend, Postgres/Supabase.

**Spec:** [`docs/superpowers/specs/2026-09-17-tour-guiado-primeiro-registro-design.md`](../specs/2026-09-17-tour-guiado-primeiro-registro-design.md) — o plano segue essa spec; quem executar deve ler os dois.

## Global Constraints

- Tipografia: nunca `font-medium`/`font-semibold`/`font-bold` — usar `font-sans`, `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`, `font-sans-extrabold`.
- Números (kcal, gramas, streak, contagem) levam `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores via token (`@/lib/colors`), nunca hex inline em JSX.
- Hit target mínimo 44×44 pt em qualquer `Pressable`.
- `accessibilityLabel` obrigatório em botões só-ícone; `accessibilityRole` em interativos.
- Sombras via `@/lib/shadows` (já cobre `Platform.select` iOS/Android/web).
- Sem `dark:` em código novo (sem dark mode no MVP).
- Ícones só de `lucide-react-native`.
- Sem tags HTML (`<div>`, `<h1>`) — `View`/`Text`/`Pressable`.
- RLS não se aplica a esta feature (sem tabela nova, só uma coluna em `profiles`, já coberta pela policy padrão existente).
- Migrations são imutáveis após merge — qualquer ajuste depois vira nova migration.
- Tour só dispara no layout compacto (`width < 1024`) — no desktop a navegação é a `Sidebar`, fora de escopo (pedido explicitamente como guia "para mobile").

**Fora de escopo (decisão deliberada, não lacuna):** `app/(app)/history/[day]/new.tsx` (lançar refeição num dia passado, alcançado a partir do Histórico) **não** chama `tour.notifyMealCreated()` — não faz sentido como "primeiro registro" de um usuário novo, que ainda não tem histórico pra fazer backfill. Nenhuma task deste plano toca nesse arquivo.

---

## Task 1: Migration — `profiles.tutorial_completed_at`

**Files:**
- Create: `supabase/migrations/0077_profiles_tutorial_completed.sql`

**Interfaces:**
- Produces: coluna `public.profiles.tutorial_completed_at timestamptz` (nullable), `NULL` só para profiles criados depois desta migration.

- [ ] **Step 1: Escrever a migration**

```sql
-- Tour guiado pós-primeiro-registro (spotlight sobre Home/Social/Análises +
-- Perfil + atalho de instalação) — marca quando o usuário terminou ou pulou.
-- Ver docs/superpowers/specs/2026-09-17-tour-guiado-primeiro-registro-design.md.
--
-- Backfill dentro da própria migration: toda conta já existente recebe
-- now() aqui, então só quem se cadastra depois deste deploy nasce com a
-- coluna NULL. Sem isso, usuários antigos (já com muitas refeições
-- registradas) seriam tratados como novos na primeira vez que
-- registrassem algo depois do deploy, e o tour dispararia sem sentido.
ALTER TABLE public.profiles ADD COLUMN tutorial_completed_at timestamptz;

UPDATE public.profiles SET tutorial_completed_at = now() WHERE tutorial_completed_at IS NULL;
```

- [ ] **Step 2: Aplicar localmente e conferir**

Run: `npm run db:reset`
Expected: migration `0077_profiles_tutorial_completed.sql` aplica sem erro; conferir manualmente com `select user_id, tutorial_completed_at from profiles limit 5;` no `supabase db` local — todas as linhas do seed (se houver) devem vir com timestamp preenchido, não `NULL` (prova do backfill).

- [ ] **Step 3: Regenerar tipos do Postgres (convenção do projeto)**

Run: `npm run db:types`
Expected: `packages/db-types/index.ts` atualizado incluindo `tutorial_completed_at` em `profiles`. Não há consumidor desse pacote hoje (verificado: nenhum import de `db-types` em `apps/server`/`apps/mobile`) — é só housekeeping, não bloqueia o restante do plano se o Supabase local não estiver disponível na sessão de execução.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0077_profiles_tutorial_completed.sql packages/db-types/index.ts
git commit -m "feat(db): adiciona profiles.tutorial_completed_at com backfill"
```

---

## Task 2: Contrato compartilhado — `PatchAccountSettingsRequestSchema` / `AccountSettingsResponseSchema`

**Files:**
- Modify: `packages/shared/src/schemas.ts:358-376`
- Create: `packages/shared/src/tour.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `PatchAccountSettingsRequestSchema` aceita `tutorial_completed?: true`; `PatchAccountSettingsRequest` ganha o campo opcional `tutorial_completed?: boolean`; `AccountSettingsResponseSchema.settings` ganha `tutorial_completed_at: string | null`; `AccountSettingsResponse.settings.tutorial_completed_at: string | null`.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `packages/shared/src/tour.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AccountSettingsResponseSchema, PatchAccountSettingsRequestSchema } from "./schemas";

describe("contrato do tour guiado", () => {
  it("aceita tutorial_completed como campo opcional do PATCH de settings", () => {
    expect(PatchAccountSettingsRequestSchema.safeParse({}).success).toBe(true);
    expect(
      PatchAccountSettingsRequestSchema.safeParse({ tutorial_completed: true }).success,
    ).toBe(true);
    // Só aceita `true` — não existe caso de uso pra "desmarcar" via cliente.
    expect(
      PatchAccountSettingsRequestSchema.safeParse({ tutorial_completed: false }).success,
    ).toBe(false);
  });

  it("a resposta de settings inclui tutorial_completed_at nullable", () => {
    const base = { timezone: "America/Sao_Paulo", day_start_hour: 0, updated_at: "2026-09-17T00:00:00Z" };
    expect(
      AccountSettingsResponseSchema.safeParse({ settings: { ...base, tutorial_completed_at: null } })
        .success,
    ).toBe(true);
    expect(
      AccountSettingsResponseSchema.safeParse({
        settings: { ...base, tutorial_completed_at: "2026-09-17T12:00:00Z" },
      }).success,
    ).toBe(true);
    expect(
      AccountSettingsResponseSchema.safeParse({ settings: base }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace packages/shared`
Expected: FAIL — `tutorial_completed` rejeitado pelo schema atual e `tutorial_completed_at` ausente do schema de resposta.

- [ ] **Step 3: Editar os schemas**

Em `packages/shared/src/schemas.ts`, substituir:

```ts
export const PatchAccountSettingsRequestSchema = z.object({
  timezone: z.string().min(1).optional(),
  day_start_hour: z.number().int().min(0).max(23).optional(),
});
export type PatchAccountSettingsRequest = z.infer<typeof PatchAccountSettingsRequestSchema>;
```

por:

```ts
export const PatchAccountSettingsRequestSchema = z.object({
  timezone: z.string().min(1).optional(),
  day_start_hour: z.number().int().min(0).max(23).optional(),
  // Só `true`: não existe fluxo de "desmarcar" o tour pelo cliente — ver
  // docs/superpowers/specs/2026-09-17-tour-guiado-primeiro-registro-design.md.
  tutorial_completed: z.literal(true).optional(),
});
export type PatchAccountSettingsRequest = z.infer<typeof PatchAccountSettingsRequestSchema>;
```

E substituir:

```ts
export const AccountSettingsResponseSchema = z.object({
  settings: z.object({
    timezone: z.string(),
    day_start_hour: z.number().int().min(0).max(23),
    updated_at: z.string(),
  }),
});
export type AccountSettingsResponse = z.infer<typeof AccountSettingsResponseSchema>;
```

por:

```ts
export const AccountSettingsResponseSchema = z.object({
  settings: z.object({
    timezone: z.string(),
    day_start_hour: z.number().int().min(0).max(23),
    updated_at: z.string(),
    tutorial_completed_at: z.string().nullable(),
  }),
});
export type AccountSettingsResponse = z.infer<typeof AccountSettingsResponseSchema>;
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test --workspace packages/shared`
Expected: PASS.

- [ ] **Step 5: Rebuild do pacote (o server resolve `@fitbrother/shared` via `dist/`, não `src/`)**

Run: `npm run build --workspace packages/shared`
Expected: build sem erro; `packages/shared/dist/index.js` e `.d.ts` atualizados. **Obrigatório antes da Task 3** — sem isso o `apps/server` typecheck/test enxergam o `dist` antigo, sem o campo novo.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/tour.test.ts packages/shared/dist
git commit -m "feat(shared): contrato de tutorial_completed no PATCH de account/settings"
```

---

## Task 3: Servidor — `PATCH /account/settings` grava `tutorial_completed_at`

**Files:**
- Modify: `apps/server/src/routes/account.ts:113-142`

**Interfaces:**
- Consumes: `PatchAccountSettingsRequestSchema`, `AccountSettingsResponseSchema` (Task 2).
- Produces: `PATCH /account/settings` com `{ tutorial_completed: true }` no corpo grava `profiles.tutorial_completed_at = now()` e devolve esse valor em `settings.tutorial_completed_at`.

- [ ] **Step 1: Editar o handler**

Em `apps/server/src/routes/account.ts`, dentro de `app.patch("/account/settings", ...)`, trocar:

```ts
    const userId = req.user!.id;
    const admin = supabaseService();
    const patch: Record<string, unknown> = {};
    if (parsed.data.timezone) patch.timezone = parsed.data.timezone;
    if (parsed.data.day_start_hour !== undefined) patch.day_start_hour = parsed.data.day_start_hour;
```

por:

```ts
    const userId = req.user!.id;
    const admin = supabaseService();
    const patch: Record<string, unknown> = {};
    if (parsed.data.timezone) patch.timezone = parsed.data.timezone;
    if (parsed.data.day_start_hour !== undefined) patch.day_start_hour = parsed.data.day_start_hour;
    if (parsed.data.tutorial_completed) patch.tutorial_completed_at = new Date().toISOString();
```

E trocar o `.select(...)` logo abaixo:

```ts
    const { data, error } = await admin
      .from("profiles")
      .update(patch)
      .eq("user_id", userId)
      .select("timezone, day_start_hour, updated_at")
      .single();
```

por:

```ts
    const { data, error } = await admin
      .from("profiles")
      .update(patch)
      .eq("user_id", userId)
      .select("timezone, day_start_hour, updated_at, tutorial_completed_at")
      .single();
```

- [ ] **Step 2: Typecheck e testes do server**

Run: `npm run typecheck --workspace apps/server && npm run test --workspace apps/server`
Expected: PASS (nenhum teste de rota HTTP cobre este handler hoje — `account.test.ts` só testa helpers puros — então este passo é uma checagem de regressão, não um teste novo).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/account.ts
git commit -m "feat(server): PATCH /account/settings grava tutorial_completed_at"
```

---

## Task 4: Tipo `Profile` no mobile + exportar status do `useInstallPrompt`

**Files:**
- Modify: `apps/mobile/lib/profile/types.ts`
- Modify: `apps/mobile/lib/hooks/useInstallPrompt.ts:15-21`

**Interfaces:**
- Produces: `Profile.tutorial_completed_at: string | null`; `export type InstallPromptState` (era `type` sem `export`) — necessário pra `lib/tour/steps.ts` (Task 5) tipar `installStatus` contra `InstallPromptState["status"]`.

- [ ] **Step 1: Editar `Profile`**

Em `apps/mobile/lib/profile/types.ts`, trocar:

```ts
export type Profile = {
  id: string;
  full_name: string;
  timezone: string;
  day_start_hour: number;
  locale: string;
  created_at: string;
  soft_mode: boolean;
  /** Caminho no Storage (`{user_id}/avatar.jpg`), não uma URL. */
  avatar_url?: string | null;
  [k: string]: unknown;
};
```

por:

```ts
export type Profile = {
  id: string;
  full_name: string;
  timezone: string;
  day_start_hour: number;
  locale: string;
  created_at: string;
  soft_mode: boolean;
  /** Caminho no Storage (`{user_id}/avatar.jpg`), não uma URL. */
  avatar_url?: string | null;
  /** `NULL` até o usuário terminar (ou pular) o tour guiado — ver lib/tour/. */
  tutorial_completed_at: string | null;
  [k: string]: unknown;
};
```

- [ ] **Step 2: Exportar `InstallPromptState`**

Em `apps/mobile/lib/hooks/useInstallPrompt.ts`, trocar:

```ts
type InstallPromptState =
  | { status: "native" }
  | { status: "installed" }
  | { status: "installable-chrome"; promptEvent: BeforeInstallPromptEvent }
  | { status: "installable-ios" }
  | { status: "installable-mac-safari" }
  | { status: "unsupported" };
```

por:

```ts
export type InstallPromptState =
  | { status: "native" }
  | { status: "installed" }
  | { status: "installable-chrome"; promptEvent: BeforeInstallPromptEvent }
  | { status: "installable-ios" }
  | { status: "installable-mac-safari" }
  | { status: "unsupported" };
```

- [ ] **Step 3: Typecheck do mobile**

Run: `npm run typecheck --workspace apps/mobile`
Expected: PASS. (`Profile` ganhar um campo obrigatório novo só quebraria algo se alguém construísse um `Profile` literal sem esse campo fora do fluxo real — a única origem de `Profile` é a resposta de `GET /me/home`, que já vira esse objeto via `as Profile`, então não há literal pra atualizar.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/profile/types.ts apps/mobile/lib/hooks/useInstallPrompt.ts
git commit -m "feat(mobile): expõe tutorial_completed_at e InstallPromptState"
```

---

## Task 5: Configuração dos passos do tour

**Files:**
- Create: `apps/mobile/lib/tour/steps.ts`
- Create: `apps/mobile/lib/tour/steps.test.ts`

**Interfaces:**
- Consumes: `InstallPromptState` (Task 4).
- Produces: `TourStepId`, `TourStep`, `TOUR_STEPS: TourStep[]`, `visibleSteps(installStatus: InstallPromptState["status"]): TourStep[]`.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `apps/mobile/lib/tour/steps.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import { TOUR_STEPS, visibleSteps } from "./steps";

describe("visibleSteps", () => {
  test("inclui os 5 passos quando há atalho pra oferecer", () => {
    expect(visibleSteps("installable-chrome")).toHaveLength(5);
    expect(visibleSteps("installable-ios")).toHaveLength(5);
    expect(visibleSteps("installable-mac-safari")).toHaveLength(5);
  });

  test("tira o passo do atalho quando não há nada pra instalar", () => {
    expect(visibleSteps("native").map((s) => s.id)).not.toContain("profile-shortcut-card");
    expect(visibleSteps("installed").map((s) => s.id)).not.toContain("profile-shortcut-card");
    expect(visibleSteps("unsupported").map((s) => s.id)).not.toContain("profile-shortcut-card");
    expect(visibleSteps("native")).toHaveLength(4);
  });

  test("a ordem dos passos bate com a sequência aprovada na spec", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "home-tab",
      "social-tab",
      "analises-tab",
      "profile-avatar",
      "profile-shortcut-card",
    ]);
  });

  test("os passos das abas ficam na tela home e os dois últimos na profile", () => {
    expect(TOUR_STEPS.filter((s) => s.screen === "home").map((s) => s.id)).toEqual([
      "home-tab",
      "social-tab",
      "analises-tab",
    ]);
    expect(TOUR_STEPS.filter((s) => s.screen === "profile").map((s) => s.id)).toEqual([
      "profile-avatar",
      "profile-shortcut-card",
    ]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace apps/mobile -- lib/tour/steps.test.ts`
Expected: FAIL — `./steps` não existe.

- [ ] **Step 3: Implementar**

Create `apps/mobile/lib/tour/steps.ts`:

```ts
import type { InstallPromptState } from "@/lib/hooks/useInstallPrompt";

export type TourStepId =
  | "home-tab"
  | "social-tab"
  | "analises-tab"
  | "profile-avatar"
  | "profile-shortcut-card";

export type TourStep = {
  id: TourStepId;
  copy: string;
  screen: "home" | "profile";
};

export const TOUR_STEPS: TourStep[] = [
  { id: "home-tab", copy: "Aqui você vê seu resumo do dia.", screen: "home" },
  { id: "social-tab", copy: "Veja o progresso dos seus amigos.", screen: "home" },
  { id: "analises-tab", copy: "Gráficos da sua evolução.", screen: "home" },
  { id: "profile-avatar", copy: "Seu perfil e configurações ficam aqui.", screen: "profile" },
  {
    id: "profile-shortcut-card",
    copy: "Adicione o Fitbrother à tela inicial.",
    screen: "profile",
  },
];

const SHORTCUT_SKIPPED_STATUSES: ReadonlyArray<InstallPromptState["status"]> = [
  "native",
  "installed",
  "unsupported",
];

/**
 * O passo do atalho só entra quando `useInstallPrompt` tem algo pra mostrar —
 * mesmos status em que `InstallPrompt.tsx` já retorna `null`.
 */
export function visibleSteps(installStatus: InstallPromptState["status"]): TourStep[] {
  if (SHORTCUT_SKIPPED_STATUSES.includes(installStatus)) {
    return TOUR_STEPS.filter((step) => step.id !== "profile-shortcut-card");
  }
  return TOUR_STEPS;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test --workspace apps/mobile -- lib/tour/steps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/tour/steps.ts apps/mobile/lib/tour/steps.test.ts
git commit -m "feat(mobile): configuração dos passos do tour guiado"
```

---

## Task 6: `TourProvider` / `useTour`

**Files:**
- Create: `apps/mobile/lib/tour/tour-context.tsx`
- Create: `apps/mobile/lib/tour/tour-context.test.tsx`

**Interfaces:**
- Consumes: `visibleSteps`, `TourStepId` (Task 5); `Profile.tutorial_completed_at` (Task 4); `patchAccountSettings` de `@/lib/api/account` (já existe, agora aceita `tutorial_completed`); `useProfile`/`useProfileActions` de `@/lib/profile/profile-context` (já existe); `useInstallPrompt` de `@/lib/hooks/useInstallPrompt` (já existe).
- Produces: `TourProvider`, `useTour()` devolvendo
  `{ active: boolean; currentStepId: TourStepId | null; targets: Partial<Record<TourStepId, Rect>>; registerTarget(id, rect): void; startTour(): void; next(): void; skip(): void; notifyMealCreated(): void }`,
  e o tipo `Rect = { x: number; y: number; width: number; height: number }`.
  Consumido por: `TourTarget` (Task 7), `TourOverlay` (Task 8), `HomeHeader`/`index.tsx` (Task 10), `profile.tsx`/`scan-confirm.tsx` (Task 11), `settings.tsx` (Task 12).

- [ ] **Step 1: Escrever o teste (falhando)**

Create `apps/mobile/lib/tour/tour-context.test.tsx`:

```tsx
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

// O import do módulo sob teste (`./tour-context`) precisa vir DEPOIS de todo
// mock abaixo — ele é o gatilho que carrega "expo-router" etc. pela primeira
// vez, e as factories de `jest.mock` (hoisted acima de tudo pelo babel, mas
// executadas só nesse require) leem `mock*` por closure. Se o import viesse
// antes das `const mock* = jest.fn()`, essas variáveis ainda não existiriam
// quando a factory rodasse (mesmo padrão de `HomeHeader.test.tsx`).
const mockPush = jest.fn();
let mockPathname = "/";
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

const mockProfile: { tutorial_completed_at: string | null } = { tutorial_completed_at: null };
const mockUpdate = jest.fn();
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => mockProfile,
  useProfileActions: () => ({ update: mockUpdate, refresh: jest.fn() }),
}));

let mockInstallStatus: string = "installable-chrome";
jest.mock("@/lib/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ status: mockInstallStatus }),
}));

const mockPatchAccountSettings = jest.fn<() => Promise<{ settings: Record<string, unknown> }>>();
jest.mock("@/lib/api/account", () => ({
  patchAccountSettings: (...args: unknown[]) => mockPatchAccountSettings(...args),
}));

let mockLarguraJanela = 375;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockLarguraJanela, height: 812, scale: 2, fontScale: 1 }),
}));

import { TourProvider, useTour } from "./tour-context";

function Consumer() {
  const tour = useTour();
  return (
    <>
      <Text testID="active">{String(tour.active)}</Text>
      <Text testID="step">{tour.currentStepId ?? "none"}</Text>
      <Pressable testID="start" onPress={tour.startTour} accessibilityRole="button" />
      <Pressable testID="next" onPress={tour.next} accessibilityRole="button" />
      <Pressable testID="skip" onPress={tour.skip} accessibilityRole="button" />
      <Pressable
        testID="meal-created"
        onPress={tour.notifyMealCreated}
        accessibilityRole="button"
      />
    </>
  );
}

function renderTour() {
  return render(
    <TourProvider>
      <Consumer />
    </TourProvider>,
  );
}

beforeEach(() => {
  mockPush.mockReset();
  mockPathname = "/";
  mockProfile.tutorial_completed_at = null;
  mockUpdate.mockReset();
  mockInstallStatus = "installable-chrome";
  mockLarguraJanela = 375;
  mockPatchAccountSettings.mockReset();
  mockPatchAccountSettings.mockResolvedValue({
    settings: { timezone: "America/Sao_Paulo", day_start_hour: 0, updated_at: "now", tutorial_completed_at: "now" },
  });
});

describe("início e avanço do tour", () => {
  test("startTour começa no primeiro passo", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("active")).toHaveTextContent("true");
    expect(getByTestId("step")).toHaveTextContent("home-tab");
  });

  test("next avança pra sequência aprovada", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next"));
    expect(getByTestId("step")).toHaveTextContent("social-tab");
    fireEvent.press(getByTestId("next"));
    expect(getByTestId("step")).toHaveTextContent("analises-tab");
  });

  test("next no último passo encerra o tour e persiste no servidor", async () => {
    const { getByTestId, findByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("next")); // analises-tab
    fireEvent.press(getByTestId("next")); // profile-avatar
    fireEvent.press(getByTestId("next")); // profile-shortcut-card (último)
    expect(await findByTestId("active")).toHaveTextContent("false");
    expect(mockPatchAccountSettings).toHaveBeenCalledWith({ tutorial_completed: true });
  });

  test("skip encerra o tour em qualquer passo e persiste", async () => {
    const { getByTestId, findByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("skip"));
    expect(await findByTestId("active")).toHaveTextContent("false");
    expect(mockPatchAccountSettings).toHaveBeenCalledWith({ tutorial_completed: true });
  });

  test("startTour não faz nada se o tour já está ativo", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("start")); // não deve voltar pro passo 1
    expect(getByTestId("step")).toHaveTextContent("social-tab");
  });

  test("no layout desktop (width >= 1024) o tour não inicia", () => {
    mockLarguraJanela = 1024;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("active")).toHaveTextContent("false");
  });
});

describe("gatilho do primeiro registro", () => {
  test("notifyMealCreated inicia o tour quando tutorial_completed_at é null", () => {
    mockProfile.tutorial_completed_at = null;
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("meal-created"));
    expect(getByTestId("active")).toHaveTextContent("true");
  });

  test("notifyMealCreated não faz nada quando o tour já foi concluído antes", () => {
    mockProfile.tutorial_completed_at = "2026-01-01T00:00:00Z";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("meal-created"));
    expect(getByTestId("active")).toHaveTextContent("false");
  });
});

describe("navegação automática pro Perfil", () => {
  test("ao entrar no passo profile-avatar, navega se ainda não está lá", () => {
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next")); // social-tab
    fireEvent.press(getByTestId("next")); // analises-tab
    fireEvent.press(getByTestId("next")); // profile-avatar
    expect(mockPush).toHaveBeenCalledWith("/(app)/profile");
  });

  test("não navega de novo se já está no Perfil", () => {
    mockPathname = "/profile";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next"));
    fireEvent.press(getByTestId("next"));
    fireEvent.press(getByTestId("next"));
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("passo sem atalho pra instalar", () => {
  test("com status native, o último passo é profile-avatar", () => {
    mockInstallStatus = "native";
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    fireEvent.press(getByTestId("next"));
    fireEvent.press(getByTestId("next"));
    expect(getByTestId("step")).toHaveTextContent("profile-avatar");
  });
});

describe("rede de segurança de alvo ausente", () => {
  test("avança sozinho se o alvo do passo não registra em ~2s", () => {
    jest.useFakeTimers();
    const { getByTestId } = renderTour();
    fireEvent.press(getByTestId("start"));
    expect(getByTestId("step")).toHaveTextContent("home-tab");
    jest.advanceTimersByTime(2100);
    expect(getByTestId("step")).toHaveTextContent("social-tab");
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace apps/mobile -- lib/tour/tour-context.test.tsx`
Expected: FAIL — `./tour-context` não existe.

- [ ] **Step 3: Implementar**

Create `apps/mobile/lib/tour/tour-context.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "expo-router";
import { useWindowDimensions } from "react-native";
import { patchAccountSettings } from "@/lib/api/account";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { useProfile, useProfileActions } from "@/lib/profile/profile-context";
import { visibleSteps, type TourStepId } from "./steps";

export type Rect = { x: number; y: number; width: number; height: number };

type ContextValue = {
  active: boolean;
  currentStepId: TourStepId | null;
  targets: Partial<Record<TourStepId, Rect>>;
  registerTarget: (id: TourStepId, rect: Rect | null) => void;
  startTour: () => void;
  next: () => void;
  skip: () => void;
  notifyMealCreated: () => void;
};

const TourContext = createContext<ContextValue | null>(null);

/**
 * A partir daqui a navegação principal é a `Sidebar`, não a barra de abas do
 * `HomeHeader` — o tour foi pedido "para mobile" (ver spec) e não tem alvo
 * nenhum pra apontar nesse layout.
 */
const DESKTOP_MIN_WIDTH = 1024;

/** Alvo não registra a tempo (ex.: navegação lenta pro Perfil) — avança
 * sozinho em vez de travar o véu sem recorte. */
const TARGET_TIMEOUT_MS = 2000;

export function TourProvider({ children }: { children: ReactNode }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [targets, setTargets] = useState<Partial<Record<TourStepId, Rect>>>({});
  const profile = useProfile();
  const { update } = useProfileActions();
  const install = useInstallPrompt();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const steps = visibleSteps(install.status);
  const currentStepId = stepIndex !== null ? (steps[stepIndex]?.id ?? null) : null;

  const finish = useCallback(() => {
    setStepIndex(null);
    setTargets({});
    void patchAccountSettings({ tutorial_completed: true })
      .then((result) => update(result.settings))
      .catch(() => {
        // Best-effort, sem retry bloqueante — ver spec, "Tratamento de
        // erros". Se falhar, tutorial_completed_at continua null no client,
        // e o tour dispara de novo no próximo primeiro-registro, o que é
        // aceitável.
      });
  }, [update]);

  const next = useCallback(() => {
    setStepIndex((current) => {
      if (current === null) return current;
      if (current >= steps.length - 1) {
        finish();
        return null;
      }
      return current + 1;
    });
  }, [steps.length, finish]);

  const skip = useCallback(() => {
    if (stepIndex === null) return;
    finish();
  }, [stepIndex, finish]);

  const startTour = useCallback(() => {
    if (stepIndex !== null) return;
    if (width >= DESKTOP_MIN_WIDTH) return;
    setTargets({});
    setStepIndex(0);
  }, [stepIndex, width]);

  const notifyMealCreated = useCallback(() => {
    if (profile.tutorial_completed_at !== null) return;
    startTour();
  }, [profile.tutorial_completed_at, startTour]);

  const registerTarget = useCallback((id: TourStepId, rect: Rect | null) => {
    setTargets((current) => {
      if (rect === null) {
        if (!(id in current)) return current;
        const nextTargets = { ...current };
        delete nextTargets[id];
        return nextTargets;
      }
      return { ...current, [id]: rect };
    });
  }, []);

  // Navega pro Perfil assim que o passo atual pede uma tela que não é a Home
  // — ver spec, "Fluxo de dados e coordenação com navegação".
  useEffect(() => {
    if (stepIndex === null) return;
    const step = steps[stepIndex];
    if (!step) return;
    if (step.screen === "profile" && pathname !== "/profile") {
      router.push("/(app)/profile");
    }
  }, [stepIndex, steps, pathname, router]);

  // Rede de segurança: se o alvo do passo atual não registrar a tempo,
  // avança sozinho em vez de travar o véu sem recorte.
  useEffect(() => {
    if (stepIndex === null || currentStepId === null) return;
    if (targets[currentStepId]) return;
    const timeout = setTimeout(() => next(), TARGET_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [stepIndex, currentStepId, targets, next]);

  return (
    <TourContext.Provider
      value={{
        active: stepIndex !== null,
        currentStepId,
        targets,
        registerTarget,
        startTour,
        next,
        skip,
        notifyMealCreated,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour(): ContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour called outside TourProvider");
  return ctx;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test --workspace apps/mobile -- lib/tour/tour-context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/tour/tour-context.tsx apps/mobile/lib/tour/tour-context.test.tsx
git commit -m "feat(mobile): TourProvider/useTour com sequenciamento e persistência"
```

---

## Task 7: `TourTarget`

**Files:**
- Create: `apps/mobile/components/tour/TourTarget.tsx`

**Interfaces:**
- Consumes: `useTour()` (Task 6) — usa `active` e `registerTarget`.
- Produces: `<TourTarget id={TourStepId}>{children}</TourTarget>` — componente usado por `HomeHeader.tsx` (Task 10) e `profile.tsx` (Task 11).

Sem teste unitário dedicado: `measureInWindow` depende de layout nativo real, que o test renderer do RN não produz — a cobertura desse comportamento vem da checklist manual da Task 13 (o overlay só aparece com recorte quando o layout mede de verdade, em dispositivo/browser real).

- [ ] **Step 1: Implementar**

Create `apps/mobile/components/tour/TourTarget.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";
import { useTour } from "@/lib/tour/tour-context";
import type { TourStepId } from "@/lib/tour/steps";

/**
 * Envolve um elemento real (aba, avatar, card) que o tour pode apontar.
 * Fora do tour não faz nada além de repassar os filhos — sem custo de
 * `onLayout`/medição quando `active` é `false`.
 */
export function TourTarget({ id, children }: { id: TourStepId; children: ReactNode }) {
  const { active, registerTarget } = useTour();
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!active) return;
    // Desregistra ao desmontar (ex.: saiu da tela) ou quando o tour acaba.
    return () => registerTarget(id, null);
  }, [active, id, registerTarget]);

  if (!active) return <>{children}</>;

  return (
    <View
      ref={ref}
      // Obrigatório no Android: sem isso a view pode ser "achatada" na
      // otimização de hierarquia nativa, e `measureInWindow` para de
      // funcionar de forma confiável.
      collapsable={false}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          registerTarget(id, { x, y, width, height });
        });
      }}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/tour/TourTarget.tsx
git commit -m "feat(mobile): componente TourTarget"
```

---

## Task 8: `TourOverlay`

**Files:**
- Create: `apps/mobile/components/tour/TourOverlay.tsx`
- Create: `apps/mobile/components/tour/TourOverlay.test.tsx`

**Interfaces:**
- Consumes: `useTour()` (Task 6), `visibleSteps` (Task 5), `useInstallPrompt()` (já existe), `Button` (`@/components/Button`, já existe), `colors`/`shadows` (já existem).
- Produces: `<TourOverlay />` — montado uma vez em `app/(app)/_layout.tsx` (Task 9). Sem props.

- [ ] **Step 1: Escrever o teste (falhando)**

Create `apps/mobile/components/tour/TourOverlay.test.tsx`:

```tsx
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

// Mesma regra de ordenação do tour-context.test.tsx: o import de
// `./TourOverlay` (módulo sob teste) fica no fim do arquivo, depois de todo
// `jest.mock`.
const mockNext = jest.fn();
const mockSkip = jest.fn();
let mockTour: {
  active: boolean;
  currentStepId: string | null;
  targets: Record<string, { x: number; y: number; width: number; height: number }>;
  next: () => void;
  skip: () => void;
};
jest.mock("@/lib/tour/tour-context", () => ({
  useTour: () => mockTour,
}));

jest.mock("@/lib/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ status: "installable-chrome" }),
}));

let mockLarguraJanela = 375;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockLarguraJanela, height: 812, scale: 2, fontScale: 1 }),
}));

import { TourOverlay } from "./TourOverlay";

describe("TourOverlay", () => {
  test("não renderiza nada quando o tour está inativo", () => {
    mockTour = { active: false, currentStepId: null, targets: {}, next: mockNext, skip: mockSkip };
    const { toJSON } = render(<TourOverlay />);
    expect(toJSON()).toBeNull();
  });

  test("mostra a copy do passo atual", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: { "home-tab": { x: 10, y: 10, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByText } = render(<TourOverlay />);
    expect(getByText("Aqui você vê seu resumo do dia.")).toBeTruthy();
  });

  test("o botão Próximo chama next()", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: { "home-tab": { x: 10, y: 10, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText } = render(<TourOverlay />);
    fireEvent.press(getByLabelText("Próximo passo"));
    expect(mockNext).toHaveBeenCalled();
  });

  test("o botão Pular chama skip()", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: { "home-tab": { x: 10, y: 10, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText } = render(<TourOverlay />);
    fireEvent.press(getByLabelText("Pular tour"));
    expect(mockSkip).toHaveBeenCalled();
  });

  test("no último passo o botão vira 'Concluir tour'", () => {
    mockTour = {
      active: true,
      currentStepId: "profile-shortcut-card",
      targets: { "profile-shortcut-card": { x: 10, y: 500, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText } = render(<TourOverlay />);
    expect(getByLabelText("Concluir tour")).toBeTruthy();
  });

  test("sem retângulo medido ainda, mostra só o véu (sem quebrar)", () => {
    mockTour = { active: true, currentStepId: "home-tab", targets: {}, next: mockNext, skip: mockSkip };
    const { getByText } = render(<TourOverlay />);
    expect(getByText("Aqui você vê seu resumo do dia.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace apps/mobile -- components/tour/TourOverlay.test.tsx`
Expected: FAIL — `./TourOverlay` não existe.

- [ ] **Step 3: Implementar**

Create `apps/mobile/components/tour/TourOverlay.tsx`:

```tsx
import { View, Text, useWindowDimensions } from "react-native";
import Svg, { Defs, Mask, Rect as SvgRect } from "react-native-svg";
import { Button } from "@/components/Button";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { useTour } from "@/lib/tour/tour-context";
import { visibleSteps } from "@/lib/tour/steps";
import { shadows } from "@/lib/shadows";

/** Respiro entre o alvo real e a borda do recorte do spotlight. */
const CUTOUT_PADDING = 8;
const CUTOUT_RADIUS = 16;
const BALLOON_MARGIN = 16;
const BALLOON_SIDE_MARGIN = 20;

export function TourOverlay() {
  const { active, currentStepId, targets, next, skip } = useTour();
  const install = useInstallPrompt();
  const { width, height } = useWindowDimensions();

  if (!active || !currentStepId) return null;

  const steps = visibleSteps(install.status);
  const stepIndex = steps.findIndex((s) => s.id === currentStepId);
  const step = steps[stepIndex];
  if (!step) return null;

  const isLast = stepIndex === steps.length - 1;
  const rect = targets[currentStepId];
  const hole = rect
    ? {
        x: Math.max(0, rect.x - CUTOUT_PADDING),
        y: Math.max(0, rect.y - CUTOUT_PADDING),
        width: rect.width + CUTOUT_PADDING * 2,
        height: rect.height + CUTOUT_PADDING * 2,
      }
    : null;

  // Sem retângulo ainda medido (tela recém-navegada), o balão fica no meio
  // vertical da tela — melhor que travar sem nada visível.
  const balloonBelow = !rect || rect.y < height / 2;

  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      accessibilityViewIsModal
    >
      <Svg width={width} height={height} style={{ position: "absolute" }} pointerEvents="none">
        <Defs>
          <Mask id="tour-mask">
            <SvgRect x={0} y={0} width={width} height={height} fill="white" />
            {hole ? (
              <SvgRect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={CUTOUT_RADIUS}
                fill="black"
              />
            ) : null}
          </Mask>
        </Defs>
        <SvgRect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="rgba(4, 16, 12, 0.72)"
          mask="url(#tour-mask)"
        />
      </Svg>

      <View
        style={{
          position: "absolute",
          left: BALLOON_SIDE_MARGIN,
          right: BALLOON_SIDE_MARGIN,
          ...(rect
            ? balloonBelow
              ? { top: rect.y + rect.height + CUTOUT_PADDING + BALLOON_MARGIN }
              : { bottom: height - rect.y + CUTOUT_PADDING + BALLOON_MARGIN }
            : { top: height / 2 - 60 }),
        }}
      >
        <View className="gap-3 rounded-2xl bg-white p-4" style={shadows.floating}>
          <Text className="font-sans-medium text-base text-neutral-900">{step.copy}</Text>
          <View className="flex-row justify-end gap-2">
            <Button
              label="Pular"
              variant="ghost"
              size="sm"
              onPress={skip}
              accessibilityLabel="Pular tour"
            />
            <Button
              label={isLast ? "Entendi" : "Próximo"}
              size="sm"
              onPress={next}
              accessibilityLabel={isLast ? "Concluir tour" : "Próximo passo"}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test --workspace apps/mobile -- components/tour/TourOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/tour/TourOverlay.tsx apps/mobile/components/tour/TourOverlay.test.tsx
git commit -m "feat(mobile): componente TourOverlay (spotlight + balão)"
```

---

## Task 9: Montar `TourProvider` + `TourOverlay` no layout

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`

**Interfaces:**
- Consumes: `TourProvider` (Task 6), `TourOverlay` (Task 8).
- Produces: ambos ativos em toda a sessão logada, disponíveis pra `useTour()` em qualquer tela dentro de `(app)`.

- [ ] **Step 1: Editar o layout**

Em `apps/mobile/app/(app)/_layout.tsx`, adicionar o import:

```ts
import { TourProvider } from "@/lib/tour/tour-context";
import { TourOverlay } from "@/components/tour/TourOverlay";
```

`TourProvider` precisa envolver o trecho que já chama `useProfile()`-dependente (ele mesmo chama `useProfile()` internamente, e só é seguro depois do gate de `state.status === "ready"`). O retorno final de `GuardedStack` hoje é:

```tsx
  return (
    // Linha só a partir de `lg`, casando com o breakpoint da Sidebar: abaixo
    // disso ela não existe e a coluna é o layout do mobile.
    <View className="flex-1 lg:flex-row">
      <Sidebar />
      <ScreenFade>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="meal/[id]/edit" options={{ presentation: "modal" }} />
          <Stack.Screen
            name="history/[day]/new"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: "fitToContents",
              sheetCornerRadius: 24,
              contentStyle: { backgroundColor: SHEET_BG },
              gestureEnabled: false,
            }}
          />
        </Stack>
      </ScreenFade>
    </View>
  );
```

Trocar por:

```tsx
  return (
    <TourProvider>
      {/* Linha só a partir de `lg`, casando com o breakpoint da Sidebar: abaixo
          disso ela não existe e a coluna é o layout do mobile. */}
      <View className="flex-1 lg:flex-row">
        <Sidebar />
        <ScreenFade>
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="meal/[id]/edit" options={{ presentation: "modal" }} />
            <Stack.Screen
              name="history/[day]/new"
              options={{
                presentation: "formSheet",
                sheetAllowedDetents: "fitToContents",
                sheetCornerRadius: 24,
                contentStyle: { backgroundColor: SHEET_BG },
                gestureEnabled: false,
              }}
            />
          </Stack>
        </ScreenFade>
      </View>
      <TourOverlay />
    </TourProvider>
  );
```

- [ ] **Step 2: Typecheck e testes do mobile**

Run: `npm run typecheck --workspace apps/mobile && npm run test --workspace apps/mobile`
Expected: PASS — nenhum teste existente cobre `_layout.tsx` diretamente (não há arquivo `_layout.test.tsx`), então esta é uma checagem de regressão. `TourOverlay` renderiza `null` fora do tour (Task 8), então isso não muda a árvore visível hoje.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/_layout.tsx
git commit -m "feat(mobile): monta TourProvider/TourOverlay no layout logado"
```

---

## Task 10: Alvos e gatilho na Home (`HomeHeader.tsx` + `index.tsx`)

**Files:**
- Modify: `apps/mobile/components/domain/HomeHeader.tsx:377-393`
- Modify: `apps/mobile/app/(app)/index.tsx` (imports, `activeTab` sync, 3 chamadas `.mutate`)

**Interfaces:**
- Consumes: `TourTarget` (Task 7), `useTour()` (Task 6).
- Produces: os 3 `TourTarget` das abas montados sempre que `HomeHeader` renderiza; `index.tsx` sincroniza `activeTab` com `tour.currentStepId` e chama `tour.notifyMealCreated()` nos 3 `onSuccess` de criação de refeição.

- [ ] **Step 1: Envolver as 3 abas em `HomeHeader.tsx`**

Em `apps/mobile/components/domain/HomeHeader.tsx`, adicionar o import:

```ts
import { TourTarget } from "@/components/tour/TourTarget";
import type { TourStepId } from "@/lib/tour/steps";
```

Adicionar, perto de `TABS` (linha 24), o mapeamento de chave de aba pra id de passo do tour:

```ts
const TAB_STEP_ID: Record<HomeTab, TourStepId> = {
  home: "home-tab",
  feed: "social-tab",
  analises: "analises-tab",
};
```

E trocar o `.map` das abas:

```tsx
        {TABS.map(({ key, label, Icon }) => {
          const active = key === activeTab;
          return (
            <Tab
              key={key}
              label={label}
              Icon={Icon}
              active={active}
              wide={wide}
              // Em `wide` as três dividem a barra por igual; em `compact` só a
              // ativa cresce e as outras ficam quadradas.
              width={wide || active ? largura : TAB_INACTIVE_WIDTH}
              onPress={() => onChangeTab(key)}
            />
          );
        })}
```

por:

```tsx
        {TABS.map(({ key, label, Icon }) => {
          const active = key === activeTab;
          return (
            <TourTarget key={key} id={TAB_STEP_ID[key]}>
              <Tab
                label={label}
                Icon={Icon}
                active={active}
                wide={wide}
                // Em `wide` as três dividem a barra por igual; em `compact` só a
                // ativa cresce e as outras ficam quadradas.
                width={wide || active ? largura : TAB_INACTIVE_WIDTH}
                onPress={() => onChangeTab(key)}
              />
            </TourTarget>
          );
        })}
```

- [ ] **Step 2: Rodar os testes existentes do `HomeHeader`**

Run: `npm run test --workspace apps/mobile -- components/domain/HomeHeader.test.tsx`
Expected: PASS sem alterações no arquivo de teste — `TourTarget` fora do tour (`active === false`, já que nenhum teste desse arquivo monta `TourProvider`/inicia o tour) simplesmente repassa os filhos (`<>{children}</>`), então a árvore renderizada não muda.

Se falhar porque `useTour()` é chamado fora de um `TourProvider` nesses testes: **isso é esperado ser evitado** — `TourTarget` só chama `useTour()` incondicionalmente (não há `TourProvider` no teste). Corrigir mockando o módulo no topo de `HomeHeader.test.tsx`, junto aos outros mocks:

```ts
jest.mock("@/lib/tour/tour-context", () => ({
  useTour: () => ({ active: false, registerTarget: () => {} }),
}));
```

- [ ] **Step 3: Sincronizar `activeTab` com o tour e disparar `notifyMealCreated` em `index.tsx`**

Adicionar import em `apps/mobile/app/(app)/index.tsx`:

```ts
import { useTour } from "@/lib/tour/tour-context";
```

Depois da linha `const [activeTab, setActiveTab] = useState<HomeTab>("home");` (linha 169), adicionar:

```ts
  const tour = useTour();

  // O tour comanda a troca de aba durante os passos 1-3 (ver
  // lib/tour/steps.ts) — as abas em si continuam sendo estado local desta
  // tela, o tour só reage a elas.
  useEffect(() => {
    if (tour.currentStepId === "home-tab") setActiveTab("home");
    else if (tour.currentStepId === "social-tab") setActiveTab("feed");
    else if (tour.currentStepId === "analises-tab") setActiveTab("analises");
  }, [tour.currentStepId]);
```

Nos 3 `.mutate(...)` de criação de refeição, adicionar `onSuccess: () => tour.notifyMealCreated()` ao objeto de callbacks já existente (que hoje só tem `onError`). Trocar (linha ~276-289):

```ts
      {
        onError: (err) => {
          if (err instanceof QuotaExceededError) {
            setBanner("quota_exceeded");
          } else if (err.message === "request_timeout") {
            setBanner("offline");
          } else if ((getErrorStatus(err) ?? 0) >= 500) {
            setBanner("server_error");
          } else {
            setBanner("network");
          }
        },
      },
    );
  };

  const handleAudioReady = useCallback(
```

por:

```ts
      {
        onSuccess: () => tour.notifyMealCreated(),
        onError: (err) => {
          if (err instanceof QuotaExceededError) {
            setBanner("quota_exceeded");
          } else if (err.message === "request_timeout") {
            setBanner("offline");
          } else if ((getErrorStatus(err) ?? 0) >= 500) {
            setBanner("server_error");
          } else {
            setBanner("network");
          }
        },
      },
    );
  };

  const handleAudioReady = useCallback(
```

E, no bloco de `createMealAudio.mutate` (linha ~313-329), trocar:

```ts
          {
            onError: (err) => {
              // eslint-disable-next-line no-console
              console.warn("[handleAudioReady] mutation error:", err);
```

por:

```ts
          {
            onSuccess: () => tour.notifyMealCreated(),
            onError: (err) => {
              // eslint-disable-next-line no-console
              console.warn("[handleAudioReady] mutation error:", err);
```

E adicionar `tour` ao array de deps de `handleAudioReady` (linha 337): `[createMealAudio, day, tour, userId]`.

No bloco de `createMealPhoto.mutate` (linha ~359-371), trocar:

```ts
        {
          onError: (err) => {
            if (err instanceof QuotaExceededError) {
              setBanner("quota_exceeded");
            } else if (err.message === "request_timeout") {
              setBanner("offline");
            } else if ((getErrorStatus(err) ?? 0) >= 500) {
              setBanner("server_error");
            } else {
              setBanner("network");
            }
          },
        },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[handlePhotoPress] photo error:", err);
      setBanner("network");
    }
  }, [createMealPhoto, day, userId]);
```

por:

```ts
        {
          onSuccess: () => tour.notifyMealCreated(),
          onError: (err) => {
            if (err instanceof QuotaExceededError) {
              setBanner("quota_exceeded");
            } else if (err.message === "request_timeout") {
              setBanner("offline");
            } else if ((getErrorStatus(err) ?? 0) >= 500) {
              setBanner("server_error");
            } else {
              setBanner("network");
            }
          },
        },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[handlePhotoPress] photo error:", err);
      setBanner("network");
    }
  }, [createMealPhoto, day, tour, userId]);
```

- [ ] **Step 4: Typecheck e testes do mobile**

Run: `npm run typecheck --workspace apps/mobile && npm run test --workspace apps/mobile`
Expected: PASS. Se algum outro teste monta `<HomeScreen />`/`index.tsx` diretamente e quebra por `useTour()` sem `TourProvider`, aplicar o mesmo mock do Step 2 nesse arquivo de teste.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx apps/mobile/components/domain/HomeHeader.test.tsx apps/mobile/app/\(app\)/index.tsx
git commit -m "feat(mobile): alvos das abas e gatilho do tour na Home"
```

---

## Task 11: Alvos e gatilho no Perfil (`profile.tsx` + `scan-confirm.tsx`)

**Files:**
- Modify: `apps/mobile/app/(app)/profile.tsx:1-40, 149-192`
- Modify: `apps/mobile/app/(app)/scan-confirm.tsx:1-24, 60-105`

**Interfaces:**
- Consumes: `TourTarget` (Task 7), `useTour()` (Task 6).
- Produces: `TourTarget id="profile-avatar"` e `TourTarget id="profile-shortcut-card"` montados em `profile.tsx`; `tour.notifyMealCreated()` chamado nos 2 pontos de sucesso de criação de refeição em `scan-confirm.tsx`.

- [ ] **Step 1: Envolver avatar e `InstallPrompt` em `profile.tsx`**

Adicionar imports em `apps/mobile/app/(app)/profile.tsx`:

```ts
import { TourTarget } from "@/components/tour/TourTarget";
```

Trocar (linha 164):

```tsx
          <EmailConfirmationBanner />
          <InstallPrompt />
          <View className="items-center">
            <Pressable
              onPress={() => setAvatarModal("actions")}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Opções da foto do perfil"
              className="relative h-24 w-24"
            >
```

por:

```tsx
          <EmailConfirmationBanner />
          <TourTarget id="profile-shortcut-card">
            <InstallPrompt />
          </TourTarget>
          <TourTarget id="profile-avatar">
            <View className="items-center">
              <Pressable
                onPress={() => setAvatarModal("actions")}
                disabled={avatarBusy}
                accessibilityRole="button"
                accessibilityLabel="Opções da foto do perfil"
                className="relative h-24 w-24"
              >
```

E fechar o novo `TourTarget` logo depois do bloco existente do avatar (o `</View>` que já fecha o `<View className="items-center">` original, antes de `<MenuSection>`). O bloco fica:

```tsx
                <Camera size={18} color={colors.neutral[50]} />
              </View>
            </Pressable>
            <Text className="mt-3 font-display-bold text-2xl text-neutral-900">
              {profile.full_name || "FitBrother"}
            </Text>
            {profile.username ? (
              <Text className="font-sans-medium text-sm text-primary-700">@{profile.username}</Text>
            ) : null}
            <Text className="mt-1 font-sans text-sm text-neutral-500">{user.email}</Text>
          </View>
          </TourTarget>

          <MenuSection>
```

(Indentação: ajustar pra bater com o padrão do arquivo depois de editar — sem mudança de conteúdo, só a árvore JSX ganha os dois wrappers.)

- [ ] **Step 2: Typecheck e testes do mobile**

Run: `npm run typecheck --workspace apps/mobile`
Expected: PASS. Não há `profile.test.tsx` hoje, então não há suíte existente pra rodar contra este arquivo.

- [ ] **Step 3: Disparar `notifyMealCreated` em `scan-confirm.tsx`**

Adicionar import:

```ts
import { useTour } from "@/lib/tour/tour-context";
```

Adicionar, junto às outras chamadas de hook em `ScanConfirmScreen` (perto de `const createMealText = useCreateMealText();`):

```ts
  const tour = useTour();
```

Trocar o `onSuccess` de `handleSave` (linha ~76):

```ts
      {
        onSuccess: () => {
          router.replace("/(app)/" as never);
        },
        onError: () => {
          setBanner("network");
        },
      },
    );
  };

  const handleSendToAI = useCallback(() => {
```

por:

```ts
      {
        onSuccess: () => {
          tour.notifyMealCreated();
          router.replace("/(app)/" as never);
        },
        onError: () => {
          setBanner("network");
        },
      },
    );
  };

  const handleSendToAI = useCallback(() => {
```

E o `onSuccess` de `handleSendToAI` (linha ~97):

```ts
      {
        onSuccess: () => {
          router.replace("/(app)/" as never);
        },
        onError: () => {
          setBanner("network");
        },
      },
    );
  }, [barcode, createMealText, profile, router]);
```

por:

```ts
      {
        onSuccess: () => {
          tour.notifyMealCreated();
          router.replace("/(app)/" as never);
        },
        onError: () => {
          setBanner("network");
        },
      },
    );
  }, [barcode, createMealText, profile, router, tour]);
```

- [ ] **Step 4: Typecheck do mobile**

Run: `npm run typecheck --workspace apps/mobile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/profile.tsx apps/mobile/app/\(app\)/scan-confirm.tsx
git commit -m "feat(mobile): alvos do Perfil e gatilho do tour no registro por barcode"
```

---

## Task 12: "Rever tutorial" em Configurações

**Files:**
- Modify: `apps/mobile/app/(app)/settings.tsx`

**Interfaces:**
- Consumes: `useTour()` (Task 6).
- Produces: novo `AccountCard` com botão que chama `tour.startTour()`.

- [ ] **Step 1: Adicionar o card**

Adicionar import em `apps/mobile/app/(app)/settings.tsx`:

```ts
import { useTour } from "@/lib/tour/tour-context";
```

Adicionar, dentro do componente:

```ts
  const tour = useTour();
```

E adicionar, como último `AccountCard` antes do fechamento de `</AccountScreen>`:

```tsx
      <AccountCard>
        <Text className="font-sans-semibold text-base text-neutral-900">Tour guiado</Text>
        <Text className="mt-1 font-sans text-sm text-neutral-600">
          Reveja o passeio pelas abas do app e pelo atalho de instalação.
        </Text>
        <Button
          className="mt-4"
          label="Rever tutorial"
          variant="outline"
          onPress={() => tour.startTour()}
        />
      </AccountCard>
```

- [ ] **Step 2: Typecheck do mobile**

Run: `npm run typecheck --workspace apps/mobile`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/settings.tsx
git commit -m "feat(mobile): opção de rever o tutorial em Configurações"
```

---

## Task 13: Verificação final e checklist manual

**Files:** nenhum (só verificação).

- [ ] **Step 1: Suíte completa**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: PASS em todos os workspaces.

- [ ] **Step 2: Checklist manual — web mobile (Chrome Android ou DevTools em modo mobile)**

1. `npm run dev` (mobile) + `npm run dev:server`, logar com uma conta nova (`tutorial_completed_at` NULL — ou usar `npm run db:reset-user` numa conta de teste pra zerar).
2. Registrar a primeira refeição (texto). Esperado: overlay aparece destacando a aba Home.
3. Tocar "Próximo" duas vezes: overlay troca sozinho pra Social e depois Análises, sem o usuário tocar nas abas de verdade.
4. Tocar "Próximo" de novo: app navega pra `/profile` sozinho, overlay destaca o avatar.
5. Tocar "Próximo": overlay destaca o cartão "Adicionar à Tela de Início". Botão vira "Entendi".
6. Tocar "Entendi": overlay some. Sair e registrar uma segunda refeição — tour **não** deve reaparecer.
7. Em Configurações, tocar "Rever tutorial": overlay reabre do passo 1 (mesmo com `tutorial_completed_at` já preenchido).

- [ ] **Step 3: Checklist manual — Safari iOS (ou simulador)**

Repetir os passos 1-7 do Step 2. No passo 5, confirmar que o texto do atalho é o de "Adicionar à Tela de Início" (não o de Chrome/Mac Dock) — comportamento já existente de `InstallPrompt`, só confirmando que o `TourTarget` não interfere no layout dele.

- [ ] **Step 4: Checklist manual — app nativo (iOS ou Android, build de dev)**

Repetir os passos 1-4 do Step 2. No passo 4 (destacar avatar no Perfil), confirmar que o tour **encerra ali** — o passo do atalho não aparece, porque `useInstallPrompt().status === "native"` retorna `InstallPrompt` como `null`.

- [ ] **Step 5: Checklist manual — desktop (largura ≥ 1024px)**

Registrar a primeira refeição com a janela larga (`Sidebar` visível). Esperado: nenhum overlay aparece — o tour não dispara nesse layout (ver `DESKTOP_MIN_WIDTH` em `tour-context.tsx`).

Nenhum desses 4 passos manuais tem cobertura automatizada — mesmo padrão de outras entregas no `docs/PLAN.md` que dependem de device/browser real. Documentar no PR quais desses foram efetivamente executados.
