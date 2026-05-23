# M2.3 Mobile capture-first (texto) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Home + composer + meal detail no app mobile com fluxo de criar/confirmar/deletar refeição via texto, batendo no backend M2 já merged. Áudio entra em M2.4 (UI já preparada).

**Architecture:** Expo Router stack com group `(app)` autenticado, React Query 5 para cache server-state + mutations otimistas, Profile via Context, componentes de domínio em `components/domain/`. Sem realtime nesta fase — `POST /meals/text` responde com payload canônico (3–8s) e cache substitui placeholder otimista.

**Tech Stack:** React Native 0.81 (Expo 54) · TypeScript · NativeWind v4 · React Query 5 · Zustand 5 (já instalado, não usado neste milestone) · Expo Router 6 · expo-crypto (UUID) · expo-localization · expo-haptics · react-native-gesture-handler · react-native-reanimated · lucide-react-native.

**Spec:** [docs/superpowers/specs/2026-05-22-m2-3-mobile-capture-first-design.md](../specs/2026-05-22-m2-3-mobile-capture-first-design.md)

**Restrições do CLAUDE.md a respeitar em todo código:**
- Tipografia: `font-sans`, `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`, `font-sans-extrabold` — **nunca** `font-medium`/`font-semibold`/`font-bold`.
- Números: `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores: tokens Tailwind no JSX (sem hex inline). Hex permitido apenas em SVG via `lib/colors.ts`.
- Hit target 44×44 em qualquer Pressable.
- `accessibilityLabel` obrigatório em icon-only buttons.
- Ícones: `lucide-react-native` apenas.
- Sem `<div>`/`<h1>` etc. — só `View`/`Text`/`Pressable`.
- Sem `dark:` em código novo.

**Verification baseline (cada task):** `npm run typecheck` no `apps/mobile` deve passar 0 erros antes do commit. Esse projeto não tem jest configurado — tarefas de pure-function incluem "sanity values" para checar resultado via `console.log`; tarefas de UI são verificadas rodando `npm run dev` e observando comportamento.

---

## Phase 1 — Data layer foundation

### Task 1: Adicionar QueryClient singleton + Provider

**Files:**
- Create: `apps/mobile/lib/query-client.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Instalar `@tanstack/react-query` dev plugin se ainda não tiver**

Run (a partir da raiz):
```bash
cd apps/mobile && npm ls @tanstack/react-query
```
Expected: já está em `^5.62.0` (confirmado em package.json). Se não estiver: `npm install @tanstack/react-query`.

- [ ] **Step 2: Criar `lib/query-client.ts`**

```ts
// apps/mobile/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

// Single instance shared across the app. RN doesn't have window-focus events
// in the web sense — React Query handles AppState transitions internally when
// `refetchOnWindowFocus` is true (default).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Meal POSTs must not auto-retry — would create duplicates from the
      // user's perspective even when client_meal_id deduplicates server-side.
      retry: 0,
    },
  },
});
```

- [ ] **Step 3: Montar `QueryClientProvider` em `_layout.tsx`**

Modificar [apps/mobile/app/_layout.tsx](../../../apps/mobile/app/_layout.tsx). Adicionar import e envolver `<Stack>`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

// ...dentro do return, envolver:
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Smoke run**

Run: `cd apps/mobile && npm run dev`
Expected: app abre normalmente (auth ou onboarding). Sem warning de `No QueryClient set`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/query-client.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): mount QueryClientProvider with M2.3 defaults"
```

---

### Task 2: `lib/time/nutritional-day.ts`

**Files:**
- Create: `apps/mobile/lib/time/nutritional-day.ts`

- [ ] **Step 1: Implementar helper**

```ts
// apps/mobile/lib/time/nutritional-day.ts

/**
 * Returns the user's "nutritional today" as YYYY-MM-DD, mirroring the
 * Postgres boundary used in fitbrother_nutritional_day:
 *   ((consumed_at AT TIME ZONE p.timezone) - (p.day_start_hour || ' hours')::interval)::date
 *
 * Server stays the source of truth — this is only used to pick the React
 * Query cache key and the `day` parameter for GET /meals?day=.
 */
export function nutritionalDay(
  ts: Date,
  profile: { timezone: string; day_start_hour: number },
): string {
  // Convert the timestamp into the profile's local wall-clock. The
  // toLocaleString hack is the standard way to do this without pulling in
  // a date library on RN. Output format from sv-SE is "YYYY-MM-DD HH:mm:ss".
  const localStr = ts.toLocaleString("sv-SE", { timeZone: profile.timezone });
  const localDate = new Date(localStr.replace(" ", "T"));
  localDate.setHours(localDate.getHours() - profile.day_start_hour);
  return localDate.toISOString().slice(0, 10);
}

export function nutritionalToday(profile: {
  timezone: string;
  day_start_hour: number;
}): string {
  return nutritionalDay(new Date(), profile);
}
```

- [ ] **Step 2: Sanity-check valores**

Abrir o REPL ou rodar `node --input-type=module -e "..."` colando o código acima + estes inputs:

```ts
// caso 1: SP, day_start_hour=0, 2026-05-22T14:30:00Z → "2026-05-22"
// caso 2: SP, day_start_hour=4, 2026-05-22T05:00:00Z → "2026-05-21" (2am local → -4h = ontem)
// caso 3: SP, day_start_hour=4, 2026-05-22T08:00:00Z → "2026-05-22" (5am local → -4h = hoje)
// caso 4: NY, day_start_hour=0, 2026-05-22T02:00:00Z → "2026-05-21" (22h ET no dia anterior)
```

Expected: as 4 saídas batem com os comentários.

> Se algum não bater: provavelmente é o split do `toLocaleString` (alguns RN engines usam `,` ao invés de espaço). Hermes/JSC produzem espaço com locale `sv-SE`; se rodar em outro engine, ajustar.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/time/nutritional-day.ts
git commit -m "feat(mobile): nutritional-day helper mirroring server boundary"
```

---

### Task 3: `lib/api/meals.ts` (HTTP helpers)

**Files:**
- Create: `apps/mobile/lib/api/meals.ts`
- Modify: `apps/mobile/lib/api.ts` — extrair `authedFetch` para um helper reusável

- [ ] **Step 1: Refatorar `lib/api.ts` para expor `authedFetch`**

Adicionar `export` no `authedFetch` em [apps/mobile/lib/api.ts](../../../apps/mobile/lib/api.ts) (linha 7):

```ts
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // ... resto inalterado
}
```

- [ ] **Step 2: Criar `lib/api/meals.ts` com helpers**

```ts
// apps/mobile/lib/api/meals.ts
import type { MealResponse, PatchMealRequest } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

export class QuotaExceededError extends Error {
  code = "AI_QUOTA_EXCEEDED" as const;
  constructor(public kind: string) {
    super("quota_exceeded");
  }
}

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { kind?: string };
    throw new QuotaExceededError(body.kind ?? "llm");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? `request_failed_${res.status}`);
}

export async function createMealText(input: {
  client_meal_id: string;
  text: string;
  consumed_at?: string;
  locale: string;
}): Promise<{ meal: MealResponse; cache_hit: boolean; already_existed: boolean }> {
  const res = await authedFetch("/meals/text", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return (await parseOrThrow(res)) as {
    meal: MealResponse;
    cache_hit: boolean;
    already_existed: boolean;
  };
}

export async function listMealsForDay(day: string): Promise<MealResponse[]> {
  const res = await authedFetch(`/meals?day=${encodeURIComponent(day)}`);
  const body = (await parseOrThrow(res)) as { meals: MealResponse[] };
  return body.meals;
}

export async function getMeal(id: string): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}`);
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}

export async function confirmMeal(id: string): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}/confirm`, { method: "POST" });
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}

export async function patchMeal(id: string, patch: PatchMealRequest): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}

export async function deleteMeal(id: string): Promise<void> {
  const res = await authedFetch(`/meals/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    await parseOrThrow(res); // throws appropriately
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/api.ts apps/mobile/lib/api/meals.ts
git commit -m "feat(mobile): meals API client + typed quota error"
```

---

## Phase 2 — React Query hooks

### Task 4: `useMealsForDay`

**Files:**
- Create: `apps/mobile/lib/hooks/useMealsForDay.ts`

- [ ] **Step 1: Implementar hook**

```ts
// apps/mobile/lib/hooks/useMealsForDay.ts
import { useQuery } from "@tanstack/react-query";
import { listMealsForDay } from "@/lib/api/meals";

export const mealsForDayKey = (day: string) => ["meals", day] as const;

export function useMealsForDay(day: string) {
  return useQuery({
    queryKey: mealsForDayKey(day),
    queryFn: () => listMealsForDay(day),
    enabled: Boolean(day),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/useMealsForDay.ts
git commit -m "feat(mobile): useMealsForDay hook"
```

---

### Task 5: `useCreateMealText` (optimistic)

**Files:**
- Create: `apps/mobile/lib/hooks/useCreateMealText.ts`

- [ ] **Step 1: Implementar hook**

```ts
// apps/mobile/lib/hooks/useCreateMealText.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type { MealResponse } from "@fitbrother/shared";
import { createMealText } from "@/lib/api/meals";
import { mealsForDayKey } from "./useMealsForDay";

type Args = { text: string; consumed_at?: string; locale: string; day: string };
type Context = { previous?: MealResponse[]; client_meal_id: string };

// Placeholder shape — looks like a MealResponse but marks itself processing.
// Components render MealCardSkeleton when they encounter this.
export type OptimisticMeal = MealResponse & { __status?: "processing" };

function makeOptimistic(args: Args, client_meal_id: string): OptimisticMeal {
  const now = new Date().toISOString();
  return {
    id: client_meal_id,
    source: "app_text",
    raw_input: args.text,
    audio_path: null,
    meal_type: "other",
    consumed_at: args.consumed_at ?? now,
    total_kcal: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: null,
    review_required: false,
    created_at: now,
    deleted_at: null,
    items: [],
    __status: "processing",
  };
}

export function useCreateMealText() {
  const qc = useQueryClient();

  return useMutation<
    { meal: MealResponse; cache_hit: boolean; already_existed: boolean },
    Error,
    Args,
    Context
  >({
    mutationFn: async (args) => {
      const client_meal_id = randomUUID();
      return createMealText({
        client_meal_id,
        text: args.text,
        consumed_at: args.consumed_at,
        locale: args.locale,
      });
    },
    onMutate: async (args) => {
      const client_meal_id = randomUUID();
      // Cancel in-flight refetches so they don't overwrite the optimistic state.
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      const optimistic = makeOptimistic(args, client_meal_id);
      qc.setQueryData<OptimisticMeal[]>(mealsForDayKey(args.day), (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { previous, client_meal_id };
    },
    onSuccess: (result, args, ctx) => {
      // Replace by client_meal_id (server uses it as meals.id).
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) => {
        if (!old) return [result.meal];
        return old.map((m) => (m.id === ctx?.client_meal_id ? result.meal : m));
      });
    },
    onError: (_err, args, ctx) => {
      // Rollback to the snapshot from onMutate.
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      } else {
        qc.invalidateQueries({ queryKey: mealsForDayKey(args.day) });
      }
    },
  });
}
```

> Nota: o `randomUUID()` é chamado duas vezes (em `mutationFn` e `onMutate`). Isso é um bug do esqueleto acima — o `client_meal_id` precisa ser **único** por chamada. Corrigido na Step 2.

- [ ] **Step 2: Corrigir o UUID compartilhado**

Substituir a estrutura para gerar o UUID **antes** da mutation e passar via args:

```ts
// apps/mobile/lib/hooks/useCreateMealText.ts (versão final)
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type { MealResponse } from "@fitbrother/shared";
import { createMealText } from "@/lib/api/meals";
import { mealsForDayKey } from "./useMealsForDay";

export type OptimisticMeal = MealResponse & { __status?: "processing" };

type Args = {
  client_meal_id: string;
  text: string;
  consumed_at?: string;
  locale: string;
  day: string;
};
type Context = { previous?: MealResponse[] };

function makeOptimistic(args: Args): OptimisticMeal {
  const now = new Date().toISOString();
  return {
    id: args.client_meal_id,
    source: "app_text",
    raw_input: args.text,
    audio_path: null,
    meal_type: "other",
    consumed_at: args.consumed_at ?? now,
    total_kcal: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: null,
    review_required: false,
    created_at: now,
    deleted_at: null,
    items: [],
    __status: "processing",
  };
}

export function useCreateMealText() {
  const qc = useQueryClient();

  return useMutation<
    { meal: MealResponse; cache_hit: boolean; already_existed: boolean },
    Error,
    Args,
    Context
  >({
    mutationFn: (args) =>
      createMealText({
        client_meal_id: args.client_meal_id,
        text: args.text,
        consumed_at: args.consumed_at,
        locale: args.locale,
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      qc.setQueryData<OptimisticMeal[]>(mealsForDayKey(args.day), (old) => [
        makeOptimistic(args),
        ...(old ?? []),
      ]);
      return { previous };
    },
    onSuccess: (result, args) => {
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) => {
        if (!old) return [result.meal];
        return old.map((m) => (m.id === args.client_meal_id ? result.meal : m));
      });
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      } else {
        qc.invalidateQueries({ queryKey: mealsForDayKey(args.day) });
      }
    },
  });
}

// Helper for callers: generate a stable id before kicking off the mutation.
export function newClientMealId(): string {
  return randomUUID();
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/hooks/useCreateMealText.ts
git commit -m "feat(mobile): useCreateMealText with optimistic insert"
```

---

### Task 6: `useConfirmMeal`

**Files:**
- Create: `apps/mobile/lib/hooks/useConfirmMeal.ts`

- [ ] **Step 1: Implementar hook**

```ts
// apps/mobile/lib/hooks/useConfirmMeal.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { confirmMeal } from "@/lib/api/meals";
import { mealsForDayKey } from "./useMealsForDay";

type Args = { id: string; day: string };
type Context = { previous?: MealResponse[] };

export function useConfirmMeal() {
  const qc = useQueryClient();
  return useMutation<MealResponse, Error, Args, Context>({
    mutationFn: (args) => confirmMeal(args.id),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) =>
        old?.map((m) => (m.id === args.id ? { ...m, review_required: false } : m)),
      );
      qc.setQueryData<MealResponse>(["meal", args.id], (old) =>
        old ? { ...old, review_required: false } : old,
      );
      return { previous };
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      }
      qc.invalidateQueries({ queryKey: ["meal", args.id] });
    },
    onSuccess: (meal, args) => {
      qc.setQueryData(["meal", args.id], meal);
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/useConfirmMeal.ts
git commit -m "feat(mobile): useConfirmMeal hook"
```

---

### Task 7: `useDeleteMeal`

**Files:**
- Create: `apps/mobile/lib/hooks/useDeleteMeal.ts`

- [ ] **Step 1: Implementar hook**

```ts
// apps/mobile/lib/hooks/useDeleteMeal.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { deleteMeal } from "@/lib/api/meals";
import { mealsForDayKey } from "./useMealsForDay";

type Args = { id: string; day: string };
type Context = { previous?: MealResponse[] };

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation<void, Error, Args, Context>({
    mutationFn: (args) => deleteMeal(args.id),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) =>
        old?.filter((m) => m.id !== args.id),
      );
      return { previous };
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      }
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/useDeleteMeal.ts
git commit -m "feat(mobile): useDeleteMeal hook"
```

---

## Phase 3 — Profile Context

### Task 8: ProfileProvider

**Files:**
- Create: `apps/mobile/lib/profile/profile-context.tsx`
- Create: `apps/mobile/lib/profile/types.ts`

- [ ] **Step 1: Confirmar shape de `/me`**

Run:
```bash
grep -n "GET /me\|/me'" apps/server/src/routes/me.ts | head
```
Verificar quais campos `GET /me` retorna. Expectativa: `id, full_name, timezone, day_start_hour, locale, ...`.

Se confirmado, criar `types.ts`:

```ts
// apps/mobile/lib/profile/types.ts
export type Profile = {
  id: string;
  full_name: string;
  timezone: string;
  day_start_hour: number;
  locale: string;
  // Outros campos do /me — manter loose, só campos críticos tipados aqui.
  [k: string]: unknown;
};
```

- [ ] **Step 2: Implementar Context**

```tsx
// apps/mobile/lib/profile/profile-context.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "@/lib/api";
import type { Profile } from "./types";

type State =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  | { status: "missing" }
  | { status: "error"; message: string };

const ProfileContext = createContext<State>({ status: "loading" });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = (await getMe()) as Profile | null;
        if (cancelled) return;
        setState(me ? { status: "ready", profile: me } : { status: "missing" });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "profile_load_failed",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <ProfileContext.Provider value={state}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Profile {
  const state = useContext(ProfileContext);
  if (state.status !== "ready") {
    // Guard upstream should prevent this. Failing loudly beats silent
    // fallbacks that hide real bugs (e.g., screen rendering before profile).
    throw new Error(`useProfile called while status=${state.status}`);
  }
  return state.profile;
}

export function useProfileState(): State {
  return useContext(ProfileContext);
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/profile/
git commit -m "feat(mobile): ProfileContext for the (app) group"
```

---

## Phase 4 — Routing

### Task 9: Criar `(app)` group com layout

**Files:**
- Create: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Implementar layout do group**

```tsx
// apps/mobile/app/(app)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { ProfileProvider, useProfileState } from "@/lib/profile/profile-context";

function GuardedStack() {
  const state = useProfileState();

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2DD4BF" />
      </View>
    );
  }
  if (state.status === "missing") {
    return <Redirect href="/(onboarding)" />;
  }
  if (state.status === "error") {
    // Bouncing to root lets the orchestrator (app/index.tsx) show its
    // existing retry UI instead of duplicating it here.
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AppLayout() {
  return (
    <ProfileProvider>
      <GuardedStack />
    </ProfileProvider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/_layout.tsx
git commit -m "feat(mobile): (app) group layout with ProfileProvider"
```

---

### Task 10: Atualizar `app/index.tsx` para apontar para `/(app)`

**Files:**
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: Substituir o placeholder pelo Redirect**

Localizar o bloco no final de [apps/mobile/app/index.tsx](../../../apps/mobile/app/index.tsx) que renderiza o placeholder "Fitbrother / Conta ativa / Dashboard em breve" (linhas 78–87) e substituir por:

```tsx
  // profile.kind === "present"
  return <Redirect href="/(app)" />;
```

Remover também o estado `profile.kind === "present"` se houver branch específica — o redirect substitui a renderização.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Verificação manual**

Run: `cd apps/mobile && npm run dev`. Logar com conta onboarded.
Expected: app entra no `/(app)` e mostra loading spinner (porque a tela `/(app)/index.tsx` ainda não existe — vai dar erro de rota não encontrada). Aceitável neste ponto; próximo task cria a Home.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat(mobile): redirect onboarded users to (app) group"
```

---

### Task 11: Placeholders Friends + Profile

**Files:**
- Create: `apps/mobile/app/(app)/friends.tsx`
- Create: `apps/mobile/app/(app)/profile.tsx`

- [ ] **Step 1: Friends placeholder**

```tsx
// apps/mobile/app/(app)/friends.tsx
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function FriendsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color="#1E293B" />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Amigos</Text>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-base font-sans-medium text-neutral-500">
          Amigos chegam no próximo update.
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Profile placeholder**

```tsx
// apps/mobile/app/(app)/profile.tsx
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color="#1E293B" />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Perfil</Text>
      </View>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-base font-sans-medium text-neutral-500">
          Perfil completo chega no próximo update.
        </Text>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          accessibilityLabel="Sair"
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center rounded-full border border-neutral-300 px-6 active:bg-neutral-100"
        >
          <Text className="text-sm font-sans-semibold text-neutral-700">Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/friends.tsx apps/mobile/app/(app)/profile.tsx
git commit -m "feat(mobile): placeholders for Friends and Profile screens"
```

---

## Phase 5 — Domain components

### Task 12: `ErrorBanner`

**Files:**
- Create: `apps/mobile/components/domain/ErrorBanner.tsx`

- [ ] **Step 1: Implementar**

```tsx
// apps/mobile/components/domain/ErrorBanner.tsx
import { Pressable, Text, View } from "react-native";
import { AlertTriangle, WifiOff, X, Zap } from "lucide-react-native";

export type ErrorBannerVariant =
  | "quota_exceeded"
  | "offline"
  | "server_error"
  | "network";

type Props = {
  variant: ErrorBannerVariant;
  onDismiss: () => void;
};

const COPY: Record<ErrorBannerVariant, { title: string; body: string }> = {
  quota_exceeded: {
    title: "Limite diário de IA atingido",
    body: "Você pode voltar amanhã ou adicionar manualmente (em breve).",
  },
  offline: {
    title: "Sem conexão",
    body: "Verifique sua internet e tente novamente.",
  },
  server_error: {
    title: "Algo deu errado",
    body: "Tente novamente em instantes.",
  },
  network: {
    title: "Erro de rede",
    body: "Sua refeição não foi salva. Tente de novo.",
  },
};

export function ErrorBanner({ variant, onDismiss }: Props) {
  const { title, body } = COPY[variant];
  const Icon = variant === "quota_exceeded" ? Zap : variant === "offline" ? WifiOff : AlertTriangle;
  return (
    <View className="mx-4 mt-2 flex-row items-start gap-3 rounded-2xl bg-warning-50 p-4">
      <Icon size={20} color="#F59E0B" />
      <View className="flex-1">
        <Text className="text-sm font-sans-semibold text-neutral-800">{title}</Text>
        <Text className="mt-0.5 text-sm font-sans text-neutral-600">{body}</Text>
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityLabel="Fechar aviso"
        accessibilityRole="button"
        className="min-h-[44px] min-w-[44px] items-center justify-center"
      >
        <X size={18} color="#64748B" />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/ErrorBanner.tsx
git commit -m "feat(mobile): ErrorBanner with quota/network variants"
```

---

### Task 13: `EmptyMealsState`

**Files:**
- Create: `apps/mobile/components/domain/EmptyMealsState.tsx`

- [ ] **Step 1: Implementar**

```tsx
// apps/mobile/components/domain/EmptyMealsState.tsx
import { Text, View } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";

export function EmptyMealsState() {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <UtensilsCrossed size={64} color="#CBD5E1" />
      <Text className="text-center text-lg font-sans-bold text-neutral-800">
        Nenhuma refeição hoje
      </Text>
      <Text className="text-center text-sm font-sans text-neutral-500">
        Diga sua primeira refeição lá embaixo ↓
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/EmptyMealsState.tsx
git commit -m "feat(mobile): EmptyMealsState component"
```

---

### Task 14: `MealCardSkeleton`

**Files:**
- Create: `apps/mobile/components/domain/MealCardSkeleton.tsx`

- [ ] **Step 1: Implementar com shimmer Reanimated**

```tsx
// apps/mobile/components/domain/MealCardSkeleton.tsx
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

function Shimmer({ width, height }: { width: number | string; height: number }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: 8, backgroundColor: "#E2E8F0" }, style]}
    />
  );
}

export function MealCardSkeleton() {
  return (
    <View className="mx-4 mt-3 gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Shimmer width={140} height={16} />
        <Shimmer width={48} height={14} />
      </View>
      <Shimmer width="90%" height={14} />
      <View className="h-px bg-neutral-100" />
      <Shimmer width={200} height={14} />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/MealCardSkeleton.tsx
git commit -m "feat(mobile): MealCardSkeleton with Reanimated shimmer"
```

---

### Task 15: `HomeHeader`

**Files:**
- Create: `apps/mobile/components/domain/HomeHeader.tsx`

- [ ] **Step 1: Implementar**

```tsx
// apps/mobile/components/domain/HomeHeader.tsx
import { Pressable, Text, View } from "react-native";
import { User, Users } from "lucide-react-native";
import { useRouter } from "expo-router";

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeHeader({ name }: { name: string }) {
  const router = useRouter();
  const firstName = name.split(" ")[0] ?? name;
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
      <View className="flex-1">
        <Text className="text-sm font-sans text-neutral-500">{greetingFor(new Date())},</Text>
        <Text className="text-2xl font-sans-extrabold text-neutral-800">{firstName}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => router.push("/(app)/friends")}
          accessibilityLabel="Amigos"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Users size={22} color="#1E293B" />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/profile")}
          accessibilityLabel="Perfil"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <User size={22} color="#1E293B" />
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx
git commit -m "feat(mobile): HomeHeader with greeting and friends/profile icons"
```

---

### Task 16: `MealCard`

**Files:**
- Create: `apps/mobile/components/domain/MealCard.tsx`

- [ ] **Step 1: Implementar**

```tsx
// apps/mobile/components/domain/MealCard.tsx
import { Pressable, Text, View } from "react-native";
import type { MealResponse } from "@fitbrother/shared";

const MEAL_TYPE_LABEL: Record<MealResponse["meal_type"], string> = {
  breakfast: "🍳 Café da manhã",
  lunch: "🍽 Almoço",
  snack: "🥪 Lanche",
  dinner: "🌙 Jantar",
  other: "🍴 Refeição",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function summarizeItems(items: MealResponse["items"]): string {
  if (items.length === 0) return "—";
  return items.map((i) => i.description).join(" · ");
}

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type Props = {
  meal: MealResponse;
  onPress?: () => void;
};

export function MealCard({ meal, onPress }: Props) {
  const isReview = meal.review_required;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Refeição ${MEAL_TYPE_LABEL[meal.meal_type]}, ${Math.round(meal.total_kcal)} kcal`}
      className={[
        "mx-4 mt-3 rounded-2xl bg-white p-4 shadow-sm",
        isReview ? "border-[1.5px] border-warning-500" : "",
      ].join(" ")}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-sans-semibold text-neutral-800">
          {MEAL_TYPE_LABEL[meal.meal_type]}
        </Text>
        <View className="flex-row items-center gap-2">
          {isReview && (
            <View className="rounded-full bg-warning-50 px-2 py-0.5">
              <Text className="text-xs font-sans-semibold text-warning-500">Revisar</Text>
            </View>
          )}
          <Text style={NUM} className="text-sm font-sans text-neutral-500">
            {formatTime(meal.consumed_at)}
          </Text>
        </View>
      </View>
      <Text numberOfLines={2} className="mt-1 text-base font-sans-medium text-neutral-800">
        {summarizeItems(meal.items)}
      </Text>
      <View className="my-3 h-px bg-neutral-100" />
      <Text style={NUM} className="text-sm font-sans text-neutral-500">
        {Math.round(meal.total_kcal)} kcal · {Math.round(meal.total_protein_g)}g P ·{" "}
        {Math.round(meal.total_carbs_g)}g C · {Math.round(meal.total_fat_g)}g G
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/MealCard.tsx
git commit -m "feat(mobile): MealCard with review_required variant"
```

---

### Task 17: `MealCardSwipeable`

**Files:**
- Create: `apps/mobile/components/domain/MealCardSwipeable.tsx`

- [ ] **Step 1: Implementar wrapper com Swipeable do gesture-handler**

```tsx
// apps/mobile/components/domain/MealCardSwipeable.tsx
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Trash2 } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { MealCard } from "./MealCard";

type Props = {
  meal: MealResponse;
  onPress?: () => void;
  onDelete: () => void;
};

export function MealCardSwipeable({ meal, onPress, onDelete }: Props) {
  const ref = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View className="mr-4 mt-3 items-center justify-center">
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          ref.current?.close();
          onDelete();
        }}
        accessibilityLabel="Excluir refeição"
        accessibilityRole="button"
        className="min-h-[44px] items-center justify-center rounded-2xl bg-danger-500 px-5 py-3"
      >
        <Trash2 size={20} color="#FFFFFF" />
        <Text className="mt-1 text-xs font-sans-semibold text-white">Excluir</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable ref={ref} renderRightActions={renderRightActions} overshootRight={false}>
      <MealCard meal={meal} onPress={onPress} />
    </Swipeable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/MealCardSwipeable.tsx
git commit -m "feat(mobile): MealCardSwipeable with left-swipe delete"
```

---

### Task 18: `MealComposer`

**Files:**
- Create: `apps/mobile/components/domain/MealComposer.tsx`

- [ ] **Step 1: Implementar**

```tsx
// apps/mobile/components/domain/MealComposer.tsx
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Loader2, Mic, Send } from "lucide-react-native";
import * as Haptics from "expo-haptics";

type Props = {
  onSend: (text: string) => void;
  onMicPress: () => void;
  disabled?: boolean;
  processing?: boolean;
};

export function MealComposer({ onSend, onMicPress, disabled, processing }: Props) {
  const [text, setText] = useState("");
  const hasText = text.trim().length > 0;
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (processing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = 0;
    }
  }, [processing, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSend = () => {
    const value = text.trim();
    if (!value || disabled || processing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setText("");
    onSend(value);
  };

  const handleMic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onMicPress();
  };

  return (
    <View className="border-t border-neutral-200 bg-white px-3 py-2">
      <View className="flex-row items-end gap-2">
        <View className="flex-1 rounded-2xl bg-neutral-100 px-4 py-2">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="O que você comeu?"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={2000}
            editable={!disabled && !processing}
            className="max-h-32 text-base font-sans text-neutral-800"
          />
        </View>
        <Pressable
          onPress={processing ? undefined : hasText ? handleSend : handleMic}
          accessibilityLabel={hasText ? "Enviar refeição" : "Gravar áudio"}
          accessibilityRole="button"
          disabled={disabled || processing}
          className={[
            "min-h-[44px] min-w-[44px] items-center justify-center rounded-full",
            disabled || processing
              ? "bg-neutral-200"
              : hasText
                ? "bg-primary-400 active:bg-primary-500"
                : "bg-primary-400 active:bg-primary-500",
          ].join(" ")}
        >
          {processing ? (
            <Animated.View style={spinStyle}>
              <Loader2 size={20} color="#FFFFFF" />
            </Animated.View>
          ) : hasText ? (
            <Send size={20} color="#FFFFFF" />
          ) : (
            <Mic size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/MealComposer.tsx
git commit -m "feat(mobile): MealComposer with mic↔send swap"
```

---

## Phase 6 — Screens

### Task 19: Home `(app)/index.tsx`

**Files:**
- Create: `apps/mobile/app/(app)/index.tsx`

- [ ] **Step 1: Implementar Home**

```tsx
// apps/mobile/app/(app)/index.tsx
import { useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { useMealsForDay } from "@/lib/hooks/useMealsForDay";
import { useCreateMealText, newClientMealId, type OptimisticMeal } from "@/lib/hooks/useCreateMealText";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { QuotaExceededError } from "@/lib/api/meals";
import { HomeHeader } from "@/components/domain/HomeHeader";
import { MealCard } from "@/components/domain/MealCard";
import { MealCardSwipeable } from "@/components/domain/MealCardSwipeable";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { MealComposer } from "@/components/domain/MealComposer";
import { EmptyMealsState } from "@/components/domain/EmptyMealsState";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";

function detectLocale(): string {
  const tag = Localization.getLocales()[0]?.languageTag;
  return tag ?? "pt-BR";
}

export default function HomeScreen() {
  const router = useRouter();
  const profile = useProfile();
  const day = nutritionalToday(profile);
  const mealsQuery = useMealsForDay(day);
  const createMeal = useCreateMealText();
  const deleteMeal = useDeleteMeal();
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);

  const items = mealsQuery.data ?? [];

  const handleSend = (text: string) => {
    setBanner(null);
    createMeal.mutate(
      {
        client_meal_id: newClientMealId(),
        text,
        locale: detectLocale(),
        day,
      },
      {
        onError: (err) => {
          if (err instanceof QuotaExceededError) {
            setBanner("quota_exceeded");
          } else if (err.message === "request_timeout") {
            setBanner("offline");
          } else if (err.message.startsWith("request_failed_5")) {
            setBanner("server_error");
          } else {
            setBanner("network");
          }
        },
      },
    );
  };

  const handleMic = () => {
    // M2.4 hookup. For now: visual feedback only. The Haptic is handled by
    // MealComposer.
  };

  const handleDelete = (id: string) => {
    deleteMeal.mutate(
      { id, day },
      {
        onError: () => setBanner("network"),
      },
    );
  };

  const renderItem = useMemo(
    () =>
      ({ item }: { item: OptimisticMeal }) => {
        if (item.__status === "processing") return <MealCardSkeleton />;
        return (
          <MealCardSwipeable
            meal={item}
            onPress={() => router.push(`/(app)/meal/${item.id}`)}
            onDelete={() => handleDelete(item.id)}
          />
        );
      },
    [router, day],
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <HomeHeader name={profile.full_name} />
        {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}
        {mealsQuery.isLoading ? (
          <View className="flex-1" />
        ) : items.length === 0 ? (
          <EmptyMealsState />
        ) : (
          <FlatList
            data={items as OptimisticMeal[]}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
        <MealComposer
          onSend={handleSend}
          onMicPress={handleMic}
          disabled={banner === "quota_exceeded"}
          processing={createMeal.isPending}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Verificação manual (iOS sim + backend rodando)**

Em terminais separados:
```bash
# Terminal A
cd apps/server && npm run dev

# Terminal B
cd apps/mobile && npm run dev
```
Logar com conta onboarded. Confirmar:
- Home aparece, EmptyMealsState visível.
- Digitar "1 banana e 200g de frango grelhado" + tap send → MealCardSkeleton imediato → card real em ~3-8s.
- Pull-to-refresh? FlatList não tem ainda — aceitável, está no escopo do M3.
- Tap no card → erro de rota não encontrada (próximo task cria o detalhe).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/index.tsx
git commit -m "feat(mobile): Home with composer, list, optimistic create"
```

---

### Task 20: Detalhe `(app)/meal/[id].tsx`

**Files:**
- Create: `apps/mobile/app/(app)/meal/[id].tsx`

- [ ] **Step 1: Implementar detalhe básico**

```tsx
// apps/mobile/app/(app)/meal/[id].tsx
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { getMeal } from "@/lib/api/meals";
import { useConfirmMeal } from "@/lib/hooks/useConfirmMeal";
import { useDeleteMeal } from "@/lib/hooks/useDeleteMeal";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useProfile();
  const confirm = useConfirmMeal();
  const remove = useDeleteMeal();

  const query = useQuery({
    queryKey: ["meal", id],
    queryFn: () => getMeal(id!),
    enabled: Boolean(id),
  });

  if (query.isLoading || !id) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color="#2DD4BF" />
      </SafeAreaView>
    );
  }
  if (query.isError || !query.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 px-6">
        <Text className="text-base font-sans text-neutral-600">Refeição não encontrada.</Text>
      </SafeAreaView>
    );
  }

  const meal = query.data;
  const day = nutritionalDay(new Date(meal.consumed_at), profile);

  const handleConfirm = () => {
    confirm.mutate({ id: meal.id, day });
  };

  const handleDelete = () => {
    Alert.alert("Excluir refeição?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          remove.mutate({ id: meal.id, day });
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color="#1E293B" />
        </Pressable>
        <Text className="ml-2 flex-1 text-xl font-sans-bold text-neutral-800">Refeição</Text>
        <Pressable
          onPress={handleDelete}
          accessibilityLabel="Excluir refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Trash2 size={20} color="#EF4444" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mx-4 mt-2 rounded-2xl bg-white p-4 shadow-sm">
          <Text style={NUM} className="text-3xl font-sans-extrabold text-neutral-800">
            {Math.round(meal.total_kcal)} kcal
          </Text>
          <Text style={NUM} className="mt-2 text-sm font-sans text-neutral-500">
            {Math.round(meal.total_protein_g)}g P · {Math.round(meal.total_carbs_g)}g C ·{" "}
            {Math.round(meal.total_fat_g)}g G
          </Text>
        </View>

        <Text className="ml-4 mt-5 text-xs font-sans-semibold uppercase text-neutral-500">
          Itens
        </Text>
        <View className="mx-4 mt-2 gap-2">
          {meal.items.map((item) => (
            <View key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <Text className="text-base font-sans-medium text-neutral-800">{item.description}</Text>
              <Text style={NUM} className="mt-1 text-sm font-sans text-neutral-500">
                {item.quantity} {item.unit} · {Math.round(item.kcal)} kcal
              </Text>
            </View>
          ))}
        </View>

        {meal.review_required && (
          <Pressable
            onPress={handleConfirm}
            disabled={confirm.isPending}
            accessibilityRole="button"
            accessibilityLabel="Confirmar refeição"
            className="mx-4 mt-6 min-h-[44px] items-center justify-center rounded-full bg-primary-400 px-6 py-3 active:bg-primary-500 disabled:opacity-60"
          >
            <Text className="text-base font-sans-semibold text-white">
              {confirm.isPending ? "Confirmando…" : "Confirmar"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Verificação manual**

Após criar uma refeição na Home, tap no card:
- Detalhe abre com calorias + items.
- Botão Confirmar aparece só se `review_required=true` (forçar isso baixando `confidence` no LLM ou inserindo um item ambíguo).
- Botão Excluir mostra Alert de confirmação → deleta → volta pra Home → card não aparece mais.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/meal/[id].tsx
git commit -m "feat(mobile): meal detail with confirm/delete"
```

---

## Phase 7 — Polish & verification

### Task 21: Verificação ponta a ponta + ajustes

**Files:**
- (apenas verificação; ajustes pontuais conforme necessário)

- [ ] **Step 1: Subir backend + mobile**

```bash
# Terminal A
cd apps/server && npm run dev

# Terminal B
cd apps/mobile && npm run dev
```

- [ ] **Step 2: Rodar golden path (§7.1 do spec)**

1. Logar com conta onboarded → Home com EmptyMealsState.
2. "1 banana e 200g de frango grelhado" → send → Skeleton imediato → card real ~3-8s.
3. Tap no card → detalhe lista items, totais corretos.
4. Voltar pra Home → swipe-left no card → Excluir → some.
5. Header Users → /(app)/friends placeholder ok.
6. Header User → /(app)/profile placeholder + botão Sair.
7. Tap no Mic com input vazio → haptic Light (sem ação visível extra além disso). Anotar pro M2.4 adicionar feedback explícito.
8. Segundo POST idêntico no mesmo dia → log do server mostra `cache_hit: true` (rodar `tail` no log do server e confirmar).

- [ ] **Step 3: Testar quota_exceeded**

Parar o server, no `apps/server/.env` setar `AI_CAP_LLM_TOKENS=10`, restart:
```bash
cd apps/server && npm run dev
```
No app, mandar 1-2 refeições até a tabela `ai_usage` exceder. Próximo POST: ErrorBanner amarelo aparece, botão send desabilitado.

Restaurar valor default depois.

- [ ] **Step 4: Testar Expo Web**

```bash
cd apps/mobile && npm run web
```
Path 1-6 deve funcionar. Haptics são no-op em web (try/catch já cobre).

- [ ] **Step 5: Lint do CLAUDE.md (checklist mental)**

Em todos os arquivos novos:
- [ ] Sem `font-medium`, `font-semibold`, `font-bold` (grep: `rg "font-(medium|semibold|bold)" apps/mobile/components/domain apps/mobile/app/\(app\)`).
- [ ] Sem hex inline no JSX (procurar `#[0-9A-Fa-f]{3,8}` fora de `lib/colors.ts` e arquivos com SVG/Reanimated).
- [ ] `tabular-nums` em todo número.
- [ ] `accessibilityLabel` em todo icon-only Pressable.
- [ ] `min-h-[44px]` ou `hitSlop` em todo Pressable interativo.

Comandos rápidos:
```bash
rg "font-(medium|semibold|bold)" apps/mobile/components/domain apps/mobile/app/\(app\)
rg "#[0-9A-Fa-f]{6}" apps/mobile/components/domain apps/mobile/app/\(app\) | grep -v ".test."
```
Expected: zero matches no primeiro; segundo só deve mostrar refs explicadas (ícones lucide recebem cor via prop `color`, mas idealmente via `colors.ts`).

> Caso aparecem hex inline em props de ícone lucide: aceitável temporariamente pra MVP (lucide recebe `color` string, não classNames). Documentar em comentário onde usar.

- [ ] **Step 6: Commit dos ajustes (se houver)**

Se alguma regra do CLAUDE.md falhou, corrigir e commitar:
```bash
git add apps/mobile/
git commit -m "fix(mobile): align M2.3 components with CLAUDE.md rules"
```

---

### Task 22: Atualizar PLAN.md / docs

**Files:**
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Marcar M2.3 como concluído no PLAN.md**

Na seção "M2 — Catálogo `foods` + registro IA no app", adicionar nota ao final da §"Mobile — capture-first":

```markdown
**Status M2.3 (texto):** ✅ concluído em <data> via PR #<n>. Áudio segue em M2.4.
```

(Texto exato fica a critério; manter consistência com o estilo das outras notas do PLAN.)

- [ ] **Step 2: Commit**

```bash
git add docs/PLAN.md
git commit -m "docs: mark M2.3 (text capture) as done"
```

---

## Self-review checklist (já validado)

**Spec coverage:**
- §3.1 Roteamento → Tasks 9, 10, 11
- §3.2 Data layer → Tasks 1, 2, 3, 4, 5, 6, 7
- §3.3 Componentes → Tasks 12–18
- §3.4 State strategy → Task 1 (config) + Tasks 4-7 (hooks)
- §4 Fluxos críticos → Tasks 5, 6, 7 (hooks) + Tasks 19, 20 (consumers)
- §5 Estados de erro → Task 12 (ErrorBanner) + Task 19 (mapping no Home)
- §6 Conformidade CLAUDE.md → Task 21 step 5
- §7 Testes/verificação → Task 21
- §8 Out of scope → respeitado (sem audio/manual/rings/realtime)
- §9 Critério de aceite → Task 21 step 2

**Type consistency:**
- `MealResponse`, `PatchMealRequest`, `OptimisticMeal` consistentes.
- `mealsForDayKey(day)` reutilizado em todos os hooks de mutation.
- `client_meal_id` gerado apenas via `newClientMealId()` → passado em args.

**Placeholders:** nenhum step contém TBD/TODO/"similar to X" sem código.
