# M3.2 Edit + History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar M3 adicionando edit de refeições (modal full-screen) + tela de history paginada com drill-down até daily detail e meal detail.

**Architecture:** Backend ganha 1 endpoint range (`GET /me/daily-summaries`); restante reutiliza `PATCH /meals/:id` (M2). Mobile adiciona 5 componentes (MacroBar, HistoryDayCard, HistoryEmptyDayCard, EditMealModal), 3 rotas (history/index, history/[day], meal/[id]/edit), 2 hooks (`useDailySummaries` infinite query, `useUpdateMeal` mutation), e estende API client. Empty days no history são preenchidos client-side por motivos de UX + DB enxuto.

**Tech Stack:** React Native 0.81 / Expo SDK 54 / Expo Router 4 / Reanimated 4 / NativeWind v4 / @tanstack/react-query 5 / Fastify 5 / Supabase / Zod.

**Spec base:** [docs/superpowers/specs/2026-05-25-m3-2-edit-history-design.md](../specs/2026-05-25-m3-2-edit-history-design.md)

**Branch:** `m3-2-edit-history` (já criada com spec commitada em `733b9ad`).

---

## File Structure

### Created
- `packages/shared/src/schemas.ts` — adicionar `DailySummariesResponseSchema` (modify)
- `apps/server/src/routes/me.ts` — adicionar handler `GET /me/daily-summaries` (modify)
- `apps/mobile/lib/api/me.ts` — adicionar `fetchDailySummaries` (modify)
- `apps/mobile/lib/api/meals.ts` — adicionar `patchMeal` (modify)
- `apps/mobile/lib/hooks/useDailySummaries.ts` — infinite query (new)
- `apps/mobile/lib/hooks/useUpdateMeal.ts` — mutation (new)
- `apps/mobile/components/domain/MacroBar.tsx` — animated horizontal bar (new)
- `apps/mobile/components/domain/HistoryDayCard.tsx` — card com hero kcal + 3 MacroBars (new)
- `apps/mobile/components/domain/HistoryEmptyDayCard.tsx` — motivational card (new)
- `apps/mobile/components/domain/EditMealModal.tsx` — full-screen modal (new)
- `apps/mobile/app/(app)/history/index.tsx` — history list (new)
- `apps/mobile/app/(app)/history/[day].tsx` — daily detail (new)
- `apps/mobile/app/(app)/meal/[id]/edit.tsx` — modal route wrapper (new)
- `scripts/checks/m3-2-history.sh` + `.sql` — smoke checks (new)

### Modified
- `apps/mobile/components/domain/HomeHeader.tsx` — adicionar Calendar icon
- `apps/mobile/app/(app)/meal/[id].tsx` — adicionar Pencil button no header
- `docs/PLAN.md` — status M3.2

---

## Task 1: Shared schema `DailySummariesResponseSchema`

**Files:**
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Adicionar schema após `DailySummaryResponseSchema`**

Em `packages/shared/src/schemas.ts`, encontrar o bloco:

```ts
export const DailySummaryResponseSchema = z.object({
  summary: DailySummarySchema,
});
export type DailySummaryResponse = z.infer<typeof DailySummaryResponseSchema>;
```

Adicionar logo após:

```ts
export const DailySummariesResponseSchema = z.object({
  summaries: z.array(DailySummarySchema),
});
export type DailySummariesResponse = z.infer<typeof DailySummariesResponseSchema>;
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/shared
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat(shared): DailySummariesResponseSchema for history range"
```

---

## Task 2: Backend `GET /me/daily-summaries`

**Files:**
- Modify: `apps/server/src/routes/me.ts`

- [ ] **Step 1: Adicionar imports + schema de query**

No topo de `apps/server/src/routes/me.ts`, garantir que estes imports estão presentes (alguns já podem existir):

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DailySummarySchema, type DailySummary } from "@fitbrother/shared";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
```

Logo após `dailySummaryQuerySchema` existente, adicionar:

```ts
const dailySummariesQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
});
```

- [ ] **Step 2: Adicionar handler dentro de meRoutes**

Logo antes do `}` que fecha a função `meRoutes`, adicionar:

```ts
app.get("/me/daily-summaries", { preHandler: [authRequired] }, async (req, reply) => {
  const parsed = dailySummariesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
  }
  const { from, to } = parsed.data;
  const daysDiff = Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
  if (daysDiff < 0) return reply.code(400).send({ error: "from_after_to" });
  if (daysDiff > 31) return reply.code(400).send({ error: "range_too_large" });

  const supabase = supabaseForRequest(req);
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: false });

  if (error) {
    req.log.error({ err: error }, "daily_summaries_query_failed");
    return reply.code(500).send({ error: error.message });
  }

  return reply.send({
    summaries: (data ?? []).map((row) => DailySummarySchema.parse(row)),
  });
});
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/server
```

Expected: sem erros.

- [ ] **Step 4: Restart dev server + smoke**

Se o server estiver rodando, mate e suba:

```bash
cd /home/pedrobritto/development/fitbrother/apps/server && npm run dev
```

(use `run_in_background: true`)

Aguarde 4s e teste:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health
```

Expected: `200`. Sem JWT em `/me/daily-summaries?from=2026-05-18&to=2026-05-24` deve dar `401`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/me/daily-summaries?from=2026-05-18&to=2026-05-24"
```

Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/me.ts
git commit -m "feat(server): GET /me/daily-summaries with 31d cap"
```

---

## Task 3: Mobile API — `fetchDailySummaries`

**Files:**
- Modify: `apps/mobile/lib/api/me.ts`

- [ ] **Step 1: Adicionar função**

Em `apps/mobile/lib/api/me.ts`, importar `DailySummariesResponseSchema` no topo (junto com os existentes do `@fitbrother/shared`):

```ts
import {
  DailySummariesResponseSchema,
  DailySummaryResponseSchema,
  type DailySummary,
} from "@fitbrother/shared";
```

E adicionar a função no fim do arquivo (mantendo `fetchDailySummary` que já existe):

```ts
export async function fetchDailySummaries(
  from: string,
  to: string,
): Promise<DailySummary[]> {
  const res = await authedFetch(
    `/me/daily-summaries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  const body = await parseOrThrow(res);
  return DailySummariesResponseSchema.parse(body).summaries;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/api/me.ts
git commit -m "feat(mobile): fetchDailySummaries api client"
```

---

## Task 4: Mobile API — `patchMeal`

**Files:**
- Modify: `apps/mobile/lib/api/meals.ts`

- [ ] **Step 1: Adicionar import + função**

Em `apps/mobile/lib/api/meals.ts`, o import do `@fitbrother/shared` provavelmente já inclui `MealResponse`. Adicionar `PatchMealRequest`:

```ts
import type { MealResponse, PatchMealRequest } from "@fitbrother/shared";
```

E adicionar a função (lugar lógico: depois de `confirmMeal` ou de outra que toque PATCH/POST `/meals/:id`):

```ts
export async function patchMeal(id: string, patch: PatchMealRequest): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/api/meals.ts
git commit -m "feat(mobile): patchMeal api client"
```

---

## Task 5: Hook `useDailySummaries` (infinite query)

**Files:**
- Create: `apps/mobile/lib/hooks/useDailySummaries.ts`

- [ ] **Step 1: Criar o hook**

Criar `apps/mobile/lib/hooks/useDailySummaries.ts`:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDailySummaries } from "@/lib/api/me";

const WEEK_DAYS = 7;

function addDays(iso: string, n: number): string {
  // Trabalhamos com strings YYYY-MM-DD pra evitar fuso. UTC-anchored interno
  // só pra somar dias; o resultado volta como ISO calendar date.
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DailySummariesPageParam = { from: string; to: string };

export const dailySummariesHistoryKey = ["daily-summaries-history"] as const;

export function useDailySummaries(todayIso: string) {
  return useInfiniteQuery({
    queryKey: dailySummariesHistoryKey,
    initialPageParam: {
      from: addDays(todayIso, -(WEEK_DAYS - 1)),
      to: todayIso,
    } satisfies DailySummariesPageParam,
    queryFn: ({ pageParam }) => fetchDailySummaries(pageParam.from, pageParam.to),
    getNextPageParam: (_last, _all, lastParam) =>
      ({
        from: addDays(lastParam.from, -WEEK_DAYS),
        to: addDays(lastParam.from, -1),
      }) satisfies DailySummariesPageParam,
    enabled: Boolean(todayIso),
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/useDailySummaries.ts
git commit -m "feat(mobile): useDailySummaries infinite query (week-by-week)"
```

---

## Task 6: Hook `useUpdateMeal`

**Files:**
- Create: `apps/mobile/lib/hooks/useUpdateMeal.ts`

- [ ] **Step 1: Criar o hook**

Criar `apps/mobile/lib/hooks/useUpdateMeal.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PatchMealRequest } from "@fitbrother/shared";
import { patchMeal } from "@/lib/api/meals";
import { mealDetailKey, mealsForDayKey } from "./useMealsForDay";
import { dailySummaryKey } from "./useDailySummary";
import { dailySummariesHistoryKey } from "./useDailySummaries";

export function useUpdateMeal(mealId: string, day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PatchMealRequest) => patchMeal(mealId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealDetailKey(mealId) });
      qc.invalidateQueries({ queryKey: mealsForDayKey(day) });
      qc.invalidateQueries({ queryKey: dailySummaryKey(day) });
      qc.invalidateQueries({ queryKey: dailySummariesHistoryKey });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/useUpdateMeal.ts
git commit -m "feat(mobile): useUpdateMeal mutation hook"
```

---

## Task 7: `MacroBar` component

**Files:**
- Create: `apps/mobile/components/domain/MacroBar.tsx`

- [ ] **Step 1: Criar o componente**

Criar `apps/mobile/components/domain/MacroBar.tsx`:

```tsx
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";

type MacroColor = "protein" | "carbs" | "fat";

type Props = {
  value: number;
  max: number | null;
  color: MacroColor;
  label: string;
};

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function fillColor(c: MacroColor): string {
  switch (c) {
    case "protein":
      return colors.protein[500];
    case "carbs":
      return colors.carbs[500];
    case "fat":
      return colors.fat[500];
  }
}

export function MacroBar({ value, max, color, label }: Props) {
  const ratio = !max || max <= 0 ? 0 : Math.min(value / max, 1);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(ratio, {
      duration: Motion.duration.slow,
      easing: Motion.easing.decelerate,
    });
  }, [progress, ratio]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="flex-row items-center gap-2">
      <Text className="font-sans-medium text-xs text-neutral-600 w-16">{label}</Text>
      <View className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        <Animated.View
          style={[fillStyle, { backgroundColor: fillColor(color) }]}
          className="h-full rounded-full"
        />
      </View>
      <Text className="font-sans-medium text-xs text-neutral-700 w-20 text-right" style={NUM}>
        {max ? `${Math.round(value)}/${Math.round(max)}g` : `${Math.round(value)}g`}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/MacroBar.tsx
git commit -m "feat(mobile): MacroBar component (horizontal animated bar)"
```

---

## Task 8: `HistoryDayCard` component

**Files:**
- Create: `apps/mobile/components/domain/HistoryDayCard.tsx`

- [ ] **Step 1: Criar o componente**

Criar `apps/mobile/components/domain/HistoryDayCard.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Flame } from "lucide-react-native";
import type { DailySummary } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { MacroBar } from "./MacroBar";

type Props = {
  summary: DailySummary;
};

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

function formatDayHeader(day: string): string {
  // day = "YYYY-MM-DD" — usa UTC anchor pra evitar shift de fuso.
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HistoryDayCard({ summary }: Props) {
  const router = useRouter();
  const heroLabel = summary.goal_kcal
    ? `${fmtInt(summary.kcal)} / ${fmtInt(summary.goal_kcal)} kcal`
    : `${fmtInt(summary.kcal)} kcal`;
  const mealsLabel = `${summary.meals_count} ${summary.meals_count === 1 ? "refeição" : "refeições"}`;

  return (
    <View className="mx-4 mt-3">
      <Text className="ml-1 mb-2 text-xs font-sans-semibold uppercase text-neutral-500">
        {formatDayHeader(summary.day)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes de ${formatDayHeader(summary.day)}, ${heroLabel}, ${mealsLabel}`}
        onPress={() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push({ pathname: "/(app)/history/[day]" as any, params: { day: summary.day } })
        }
        style={shadows.card}
        className="rounded-2xl bg-white p-4 active:opacity-80"
      >
        <View className="flex-row items-center justify-between">
          <Text style={NUM} className="text-xl font-sans-bold text-neutral-800">
            {heroLabel}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {summary.goal_hit ? <Flame size={14} color={colors.streak?.[500] ?? "#F97316"} /> : null}
            <Text className="text-xs font-sans-medium text-neutral-500" style={NUM}>
              {mealsLabel}
            </Text>
          </View>
        </View>
        <View className="mt-3 gap-1.5">
          <MacroBar
            value={summary.protein_g}
            max={summary.goal_protein_g}
            color="protein"
            label="proteína"
          />
          <MacroBar
            value={summary.carbs_g}
            max={summary.goal_carbs_g}
            color="carbs"
            label="carboidrato"
          />
          <MacroBar value={summary.fat_g} max={summary.goal_fat_g} color="fat" label="gordura" />
        </View>
      </Pressable>
    </View>
  );
}
```

> Nota: `colors.streak` pode não existir ainda; `colors.streak?.[500] ?? "#F97316"` faz fallback pra orange. Sem riscos de quebrar typecheck (optional chain).

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/HistoryDayCard.tsx
git commit -m "feat(mobile): HistoryDayCard (hero kcal + 3 MacroBars + tap to drill)"
```

---

## Task 9: `HistoryEmptyDayCard` component

**Files:**
- Create: `apps/mobile/components/domain/HistoryEmptyDayCard.tsx`

- [ ] **Step 1: Criar o componente**

Criar `apps/mobile/components/domain/HistoryEmptyDayCard.tsx`:

```tsx
import { Text, View } from "react-native";
import { MoonStar } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

type Props = {
  day: string;
};

function formatDayHeader(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HistoryEmptyDayCard({ day }: Props) {
  return (
    <View className="mx-4 mt-3">
      <Text className="ml-1 mb-2 text-xs font-sans-semibold uppercase text-neutral-400">
        {formatDayHeader(day)}
      </Text>
      <View
        style={[shadows.card, { opacity: 0.65 }]}
        className="rounded-2xl bg-white p-4 items-center"
        accessibilityLabel={`Nenhuma refeição registrada em ${formatDayHeader(day)}`}
      >
        <MoonStar size={20} color={colors.neutral[400]} />
        <Text className="mt-2 text-sm font-sans-medium text-neutral-600">
          Nenhuma refeição registrada
        </Text>
        <Text className="mt-1 text-xs font-sans text-neutral-500 text-center">
          Que tal não deixar passar mais um dia?
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/HistoryEmptyDayCard.tsx
git commit -m "feat(mobile): HistoryEmptyDayCard (motivational copy for gap days)"
```

---

## Task 10: HomeHeader Calendar icon

**Files:**
- Modify: `apps/mobile/components/domain/HomeHeader.tsx`

- [ ] **Step 1: Adicionar Calendar à esquerda dos icons existentes**

Em `apps/mobile/components/domain/HomeHeader.tsx`:

Substituir o import:

```ts
import { User, Users } from "lucide-react-native";
```

por:

```ts
import { Calendar, User, Users } from "lucide-react-native";
```

E dentro do `<View className="flex-row items-center gap-2">`, adicionar o Pressable do Calendar **antes** do Users:

```tsx
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => router.push("/(app)/history")}
          accessibilityLabel="Histórico"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Calendar size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/friends")}
          accessibilityLabel="Amigos"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <Users size={22} color={colors.neutral[800]} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/(app)/profile")}
          accessibilityLabel="Perfil"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
        >
          <User size={22} color={colors.neutral[800]} />
        </Pressable>
      </View>
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx
git commit -m "feat(mobile): Calendar icon in HomeHeader (entry to /history)"
```

---

## Task 11: History list screen `app/(app)/history/index.tsx`

**Files:**
- Create: `apps/mobile/app/(app)/history/index.tsx`

- [ ] **Step 1: Criar o arquivo**

Criar `apps/mobile/app/(app)/history/index.tsx`:

```tsx
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { DailySummary } from "@fitbrother/shared";
import { useDailySummaries } from "@/lib/hooks/useDailySummaries";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { HistoryDayCard } from "@/components/domain/HistoryDayCard";
import { HistoryEmptyDayCard } from "@/components/domain/HistoryEmptyDayCard";

type DayEntry =
  | { type: "filled"; day: string; summary: DailySummary }
  | { type: "empty"; day: string };

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function expandWeek(from: string, summaries: DailySummary[]): DayEntry[] {
  const byDay = new Map(summaries.map((s) => [s.day, s]));
  const out: DayEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i);
    const summary = byDay.get(day);
    out.push(summary ? { type: "filled", day, summary } : { type: "empty", day });
  }
  return out.reverse(); // newest first within week
}

export default function HistoryScreen() {
  const router = useRouter();
  const profile = useProfile();
  const today = nutritionalToday(profile);
  const query = useDailySummaries(today);

  const entries = useMemo<DayEntry[]>(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap((page, pageIdx) => {
      const param = query.data.pageParams[pageIdx] as { from: string; to: string };
      return expandWeek(param.from, page);
    });
  }, [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 text-xl font-sans-bold text-neutral-800">Histórico</Text>
      </View>
      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[400]} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.day}
          renderItem={({ item }) =>
            item.type === "filled" ? (
              <HistoryDayCard summary={item.summary} />
            ) : (
              <HistoryEmptyDayCard day={item.day} />
            )
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color={colors.primary[400]} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/history/index.tsx
git commit -m "feat(mobile): history/index.tsx with infinite-week scroll"
```

---

## Task 12: History daily detail `app/(app)/history/[day].tsx`

**Files:**
- Create: `apps/mobile/app/(app)/history/[day].tsx`

- [ ] **Step 1: Criar o arquivo**

Criar `apps/mobile/app/(app)/history/[day].tsx`:

```tsx
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MealResponse } from "@fitbrother/shared";
import { useMealsForDay } from "@/lib/hooks/useMealsForDay";
import { useDailySummary } from "@/lib/hooks/useDailySummary";
import { colors } from "@/lib/colors";
import { TodaySummaryHeader } from "@/components/domain/TodaySummaryHeader";
import { MealCard } from "@/components/domain/MealCard";

function formatDayHeader(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function HistoryDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const summaryQuery = useDailySummary(day ?? "");
  const mealsQuery = useMealsForDay(day ?? "");

  if (!day) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <Text className="text-base font-sans text-neutral-600">Dia inválido.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 flex-1 text-xl font-sans-bold text-neutral-800">
          {formatDayHeader(day)}
        </Text>
      </View>
      {mealsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[400]} />
        </View>
      ) : (
        <FlatList<MealResponse>
          ListHeaderComponent={<TodaySummaryHeader summary={summaryQuery.data} />}
          data={mealsQuery.data ?? []}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View className="mx-4 mt-3">
              <MealCard
                meal={item}
                onPress={() =>
                  router.push({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    pathname: "/(app)/meal/[id]" as any,
                    params: { id: item.id },
                  })
                }
              />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View className="mx-4 mt-8 items-center">
              <Text className="text-sm font-sans text-neutral-500">
                Nenhuma refeição neste dia.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/history/\[day\].tsx
git commit -m "feat(mobile): history/[day].tsx (read-only daily detail)"
```

---

## Task 13: `EditMealModal` component

**Files:**
- Create: `apps/mobile/components/domain/EditMealModal.tsx`

- [ ] **Step 1: Criar o componente**

Criar `apps/mobile/components/domain/EditMealModal.tsx`:

```tsx
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, Trash2, X } from "lucide-react-native";
import {
  PatchMealItemSchema,
  type MealResponse,
  type PatchMealRequest,
} from "@fitbrother/shared";
import { useUpdateMeal } from "@/lib/hooks/useUpdateMeal";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

type Unit = MealResponse["items"][number]["unit"];
const UNIT_OPTIONS: Unit[] = ["g", "ml", "unit", "slice", "cup", "tbsp", "tsp"];
const UNIT_LABEL: Record<Unit, string> = {
  g: "g",
  ml: "ml",
  unit: "un",
  slice: "fatia",
  cup: "xíc",
  tbsp: "c. sopa",
  tsp: "c. chá",
};

type ItemDraft = {
  id?: string;
  description: string;
  quantity: number;
  unit: Unit;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type State = { items: ItemDraft[]; dirty: boolean };

type Action =
  | { type: "init"; items: ItemDraft[] }
  | { type: "update_item"; index: number; patch: Partial<ItemDraft> }
  | { type: "add_item" }
  | { type: "remove_item"; index: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "init":
      return { items: action.items, dirty: false };
    case "update_item": {
      const items = state.items.map((it, i) =>
        i === action.index ? { ...it, ...action.patch } : it,
      );
      return { items, dirty: true };
    }
    case "add_item":
      return {
        items: [
          ...state.items,
          {
            description: "",
            quantity: 1,
            unit: "unit",
            kcal: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
          },
        ],
        dirty: true,
      };
    case "remove_item":
      return {
        items: state.items.filter((_, i) => i !== action.index),
        dirty: true,
      };
  }
}

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type Props = {
  meal: MealResponse;
  day: string;
};

export function EditMealModal({ meal, day }: Props) {
  const router = useRouter();
  const update = useUpdateMeal(meal.id, day);

  const [state, dispatch] = useReducer(reducer, {
    items: meal.items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      kcal: it.kcal,
      protein_g: it.protein_g,
      carbs_g: it.carbs_g,
      fat_g: it.fat_g,
    })),
    dirty: false,
  });
  const [errorIndexes, setErrorIndexes] = useState<Set<number>>(new Set());

  const totals = useMemo(() => {
    return state.items.reduce(
      (acc, it) => ({
        kcal: acc.kcal + it.kcal,
        protein_g: acc.protein_g + it.protein_g,
        carbs_g: acc.carbs_g + it.carbs_g,
        fat_g: acc.fat_g + it.fat_g,
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
  }, [state.items]);

  const handleClose = () => {
    if (!state.dirty) {
      router.back();
      return;
    }
    Alert.alert("Descartar alterações?", "Você não salvou os ajustes.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => router.back() },
    ]);
  };

  const handleSave = () => {
    const errors = new Set<number>();
    state.items.forEach((it, i) => {
      const parsed = PatchMealItemSchema.safeParse(it);
      if (!parsed.success) errors.add(i);
    });
    if (errors.size > 0) {
      setErrorIndexes(errors);
      const list = Array.from(errors)
        .map((i) => i + 1)
        .join(", ");
      Alert.alert(
        "Campos inválidos",
        `Item${errors.size > 1 ? "s" : ""} ${list} tem campos inválidos.`,
      );
      return;
    }
    setErrorIndexes(new Set());

    const patch: PatchMealRequest = {
      items: state.items.map((it) => ({
        id: it.id,
        description: it.description.trim(),
        quantity: it.quantity,
        unit: it.unit,
        kcal: it.kcal,
        protein_g: it.protein_g,
        carbs_g: it.carbs_g,
        fat_g: it.fat_g,
      })),
    };

    update.mutate(patch, {
      onSuccess: () => router.back(),
      onError: () =>
        Alert.alert("Não foi possível salvar", "Tente novamente em instantes."),
    });
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    dispatch({ type: "update_item", index, patch });
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={handleClose}
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <X size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="flex-1 text-center text-base font-sans-bold text-neutral-800">
          Editar refeição
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!state.dirty || update.isPending}
          accessibilityLabel="Salvar alterações"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[64px] items-center justify-center px-3 disabled:opacity-50"
        >
          {update.isPending ? (
            <ActivityIndicator size="small" color={colors.primary[400]} />
          ) : (
            <Text className="text-base font-sans-semibold text-primary-500">Salvar</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {state.items.map((item, idx) => (
          <ItemEditor
            key={item.id ?? `new-${idx}`}
            item={item}
            hasError={errorIndexes.has(idx)}
            canDelete={state.items.length > 1}
            onChange={(patch) => updateItem(idx, patch)}
            onRemove={() => dispatch({ type: "remove_item", index: idx })}
          />
        ))}

        <Pressable
          onPress={() => dispatch({ type: "add_item" })}
          accessibilityRole="button"
          accessibilityLabel="Adicionar item"
          className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 py-3"
        >
          <Plus size={18} color={colors.neutral[600]} />
          <Text className="text-base font-sans-medium text-neutral-600">Adicionar item</Text>
        </Pressable>

        <View
          style={shadows.card}
          className="mx-4 mt-5 rounded-2xl bg-white p-4"
          accessibilityLabel={`Totais: ${Math.round(totals.kcal)} kcal`}
        >
          <Text className="text-xs font-sans-semibold uppercase text-neutral-500">Totais</Text>
          <Text style={NUM} className="mt-1 text-2xl font-sans-bold text-neutral-800">
            {Math.round(totals.kcal)} kcal
          </Text>
          <Text style={NUM} className="mt-1 text-sm font-sans text-neutral-500">
            {Math.round(totals.protein_g)}g P · {Math.round(totals.carbs_g)}g C ·{" "}
            {Math.round(totals.fat_g)}g G
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ItemEditorProps = {
  item: ItemDraft;
  hasError: boolean;
  canDelete: boolean;
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove: () => void;
};

function ItemEditor({ item, hasError, canDelete, onChange, onRemove }: ItemEditorProps) {
  return (
    <View
      style={shadows.card}
      className={`mx-4 mt-3 rounded-2xl bg-white p-4 ${hasError ? "border border-danger-500" : ""}`}
    >
      <TextInput
        value={item.description}
        onChangeText={(t) => onChange({ description: t })}
        placeholder="Descrição"
        accessibilityLabel="Descrição do item"
        maxLength={60}
        className="text-base font-sans-medium text-neutral-800"
      />

      <View className="mt-3 flex-row items-center gap-2">
        <NumberInput
          label="Qtd"
          value={item.quantity}
          onChange={(n) => onChange({ quantity: n })}
        />
        <UnitPicker value={item.unit} onChange={(u) => onChange({ unit: u })} />
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <NumberInput label="kcal" value={item.kcal} onChange={(n) => onChange({ kcal: n })} />
        <NumberInput label="P (g)" value={item.protein_g} onChange={(n) => onChange({ protein_g: n })} />
        <NumberInput label="C (g)" value={item.carbs_g} onChange={(n) => onChange({ carbs_g: n })} />
        <NumberInput label="G (g)" value={item.fat_g} onChange={(n) => onChange({ fat_g: n })} />
      </View>

      <Pressable
        onPress={onRemove}
        disabled={!canDelete}
        accessibilityLabel="Remover item"
        accessibilityRole="button"
        className="mt-3 self-end min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-30"
      >
        <Trash2 size={18} color={colors.danger[500]} />
      </Pressable>
    </View>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    // sync if external value changes
    setText(String(value));
  }, [value]);
  return (
    <View className="flex-1">
      <Text className="text-xs font-sans-medium text-neutral-500">{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          const parsed = t === "" ? 0 : Number(t.replace(",", "."));
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        keyboardType="decimal-pad"
        accessibilityLabel={`${label}, valor numérico`}
        style={NUM}
        className="mt-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-base font-sans-medium text-neutral-800"
      />
    </View>
  );
}

function UnitPicker({
  value,
  onChange,
}: {
  value: Unit;
  onChange: (u: Unit) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View className="relative">
      <Text className="text-xs font-sans-medium text-neutral-500">Unidade</Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityLabel="Escolher unidade"
        accessibilityRole="button"
        className="mt-1 min-w-[80px] rounded-lg border border-neutral-200 bg-white px-3 py-1.5"
      >
        <Text className="text-base font-sans-medium text-neutral-800">{UNIT_LABEL[value]}</Text>
      </Pressable>
      {open ? (
        <View
          style={shadows.card}
          className="absolute left-0 top-16 z-50 w-32 rounded-lg bg-white"
        >
          {UNIT_OPTIONS.map((u) => (
            <Pressable
              key={u}
              onPress={() => {
                onChange(u);
                setOpen(false);
              }}
              accessibilityRole="button"
              className="px-3 py-2 active:bg-neutral-50"
            >
              <Text className="text-base font-sans-medium text-neutral-800">{UNIT_LABEL[u]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros. Se reclamar de `border-danger-500` (tailwind), confirme que tem `danger.500` em `apps/mobile/tailwind.config.ts` (já está presente no projeto desde M2.4).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/EditMealModal.tsx
git commit -m "feat(mobile): EditMealModal with useReducer state + validation"
```

---

## Task 14: Modal route `app/(app)/meal/[id]/edit.tsx`

**Files:**
- Create: `apps/mobile/app/(app)/meal/[id]/edit.tsx`

- [ ] **Step 1: Verificar estrutura de pasta**

Confirmar que existe `apps/mobile/app/(app)/meal/[id].tsx` (já existe desde M2). O Expo Router permite ter um arquivo `[id].tsx` E uma pasta `[id]/` no mesmo nível — a pasta cria sub-rotas. Como queremos `/meal/:id/edit`, vamos criar:

```bash
ls /home/pedrobritto/development/fitbrother/apps/mobile/app/\(app\)/meal/
```

Espera-se ver `[id].tsx`. Vamos adicionar `[id]/` como diretório irmão.

> **Importante:** Expo Router em versões recentes permite ter `[id].tsx` (arquivo) + `[id]/` (pasta) coexistindo. Quando você acessa `/meal/abc` → cai em `[id].tsx`. Quando acessa `/meal/abc/edit` → cai em `[id]/edit.tsx`. Se der conflito, alternativa: mover `[id].tsx` pra `[id]/index.tsx`.

Se a coexistência falhar (Expo Router 4.x pode ter quirks), faça **isso primeiro**:

```bash
mkdir -p /home/pedrobritto/development/fitbrother/apps/mobile/app/\(app\)/meal/\[id\]
mv /home/pedrobritto/development/fitbrother/apps/mobile/app/\(app\)/meal/\[id\].tsx \
   /home/pedrobritto/development/fitbrother/apps/mobile/app/\(app\)/meal/\[id\]/index.tsx
```

Re-rode o app e valide que `/meal/abc` ainda funciona antes de prosseguir.

- [ ] **Step 2: Criar a rota modal**

Criar `apps/mobile/app/(app)/meal/[id]/edit.tsx`:

```tsx
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/lib/api/meals";
import { mealDetailKey } from "@/lib/hooks/useMealsForDay";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalDay } from "@/lib/time/nutritional-day";
import { colors } from "@/lib/colors";
import { EditMealModal } from "@/components/domain/EditMealModal";

export default function EditMealRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile();

  const query = useQuery({
    queryKey: mealDetailKey(id ?? ""),
    queryFn: () => getMeal(id!),
    enabled: Boolean(id),
  });

  return (
    <>
      <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
      {query.isLoading || !query.data ? (
        <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
          {query.isError ? (
            <Text className="text-base font-sans text-neutral-600">
              Refeição não encontrada.
            </Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary[400]} />
          )}
        </SafeAreaView>
      ) : (
        <EditMealModal
          meal={query.data}
          day={nutritionalDay(new Date(query.data.consumed_at), profile)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/meal/
git commit -m "feat(mobile): meal/[id]/edit modal route"
```

---

## Task 15: Add Pencil button in `meal/[id].tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/meal/[id].tsx` (ou `[id]/index.tsx` se Task 14 moveu)

- [ ] **Step 1: Importar Pencil**

Localize a linha de imports:

```ts
import { ChevronLeft, Trash2 } from "lucide-react-native";
```

Substituir por:

```ts
import { ChevronLeft, Pencil, Trash2 } from "lucide-react-native";
```

- [ ] **Step 2: Adicionar Pressable de Pencil no header, antes do Trash2**

Localize:

```tsx
        <Pressable
          onPress={handleDelete}
          disabled={remove.isPending}
          accessibilityLabel="Excluir refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center disabled:opacity-50"
        >
          <Trash2 size={20} color={colors.danger[500]} />
        </Pressable>
```

Adicionar **antes** desse bloco:

```tsx
        <Pressable
          onPress={() =>
            router.push({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pathname: "/(app)/meal/[id]/edit" as any,
              params: { id: meal.id },
            })
          }
          accessibilityLabel="Editar refeição"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Pencil size={20} color={colors.neutral[800]} />
        </Pressable>
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/pedrobritto/development/fitbrother
npm run typecheck -w @fitbrother/mobile
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/meal/
git commit -m "feat(mobile): Pencil button in meal detail opens edit modal"
```

---

## Task 16: Smoke checks SQL + HTTP

**Files:**
- Create: `scripts/checks/m3-2-history.sh`
- Create: `scripts/checks/m3-2-history.sql`

- [ ] **Step 1: Criar SQL com assertions**

Criar `scripts/checks/m3-2-history.sql`:

```sql
-- M3.2 backend smoke checks. Rodado via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m3-2-history.sql

\set ON_ERROR_STOP on

-- Check 1: daily_summaries tem PK (user_id, day) — confirma que ORDER BY day DESC com WHERE user_id usa index.
SELECT 'check_1_daily_summaries_pk' AS check,
       COUNT(*) = 1 AS pass
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_summaries'
  AND indexdef LIKE '%(user_id, day)%';

-- Check 2: nenhuma daily_summary tem day no futuro (sanity).
SELECT 'check_2_no_future_days' AS check,
       NOT EXISTS (SELECT 1 FROM public.daily_summaries WHERE day > current_date + interval '1 day') AS pass;
```

- [ ] **Step 2: Criar bash script**

Criar `scripts/checks/m3-2-history.sh`:

```bash
#!/usr/bin/env bash
# M3.2 backend smoke checks — SQL via psql + HTTP via curl com JWT real.
# Pré-condições: supabase local up, server em :3000.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── M3.2 checks ──"

# Checks 1-2: SQL
echo "[1-2] SQL checks via psql..."
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m3-2-history.sql

# Check 3: 401 sem JWT.
echo "[3] GET /me/daily-summaries sem JWT..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/me/daily-summaries?from=2026-05-18&to=2026-05-24")
if [[ "$HTTP" != "401" ]]; then
  echo "  FAIL: expected 401, got $HTTP"; exit 1
fi
echo "  PASS"

JWT="${TEST_USER_JWT:-}"

# Check 4: range > 31d → 400.
echo "[4] range > 31 days → 400..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp4.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=2026-01-01&to=2026-03-01")
  if [[ "$HTTP" != "400" ]]; then
    echo "  FAIL: expected 400, got $HTTP"; cat /tmp/m32-resp4.json; exit 1
  fi
  if ! grep -q 'range_too_large' /tmp/m32-resp4.json; then
    echo "  FAIL: expected range_too_large error"; cat /tmp/m32-resp4.json; exit 1
  fi
  echo "  PASS"
fi

# Check 5: from > to → 400.
echo "[5] from > to → 400..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp5.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=2026-05-25&to=2026-05-20")
  if [[ "$HTTP" != "400" ]]; then
    echo "  FAIL: expected 400, got $HTTP"; cat /tmp/m32-resp5.json; exit 1
  fi
  if ! grep -q 'from_after_to' /tmp/m32-resp5.json; then
    echo "  FAIL: expected from_after_to error"; cat /tmp/m32-resp5.json; exit 1
  fi
  echo "  PASS"
fi

# Check 6: from inválido → 400.
echo "[6] from=invalid → 400..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp6.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=blah&to=2026-05-25")
  if [[ "$HTTP" != "400" ]]; then
    echo "  FAIL: expected 400, got $HTTP"; cat /tmp/m32-resp6.json; exit 1
  fi
  echo "  PASS"
fi

# Check 7: range válido → 200 + array.
echo "[7] GET /me/daily-summaries?from=...&to=... → 200..."
if [[ -z "$JWT" ]]; then
  echo "  SKIPPED: TEST_USER_JWT not set"
else
  HTTP=$(curl -s -o /tmp/m32-resp7.json -w "%{http_code}" \
    -H "Authorization: Bearer $JWT" \
    "http://localhost:3000/me/daily-summaries?from=2026-05-18&to=2026-05-25")
  if [[ "$HTTP" != "200" ]]; then
    echo "  FAIL: expected 200, got $HTTP"; cat /tmp/m32-resp7.json; exit 1
  fi
  if ! grep -q '"summaries"' /tmp/m32-resp7.json; then
    echo "  FAIL: response missing summaries field"; cat /tmp/m32-resp7.json; exit 1
  fi
  echo "  PASS"
fi

echo "── all checks done ──"
```

- [ ] **Step 3: Marcar executável e rodar**

```bash
chmod +x /home/pedrobritto/development/fitbrother/scripts/checks/m3-2-history.sh
cd /home/pedrobritto/development/fitbrother
./scripts/checks/m3-2-history.sh
```

Expected: checks 1-2 PASS, check 3 PASS (401), checks 4-7 SKIPPED (sem JWT) ou PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/checks/m3-2-history.sh scripts/checks/m3-2-history.sql
git commit -m "test(m3.2): SQL + HTTP smoke checks for daily-summaries"
```

---

## Task 17: Update `docs/PLAN.md` with M3.2 status

**Files:**
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Adicionar nota de status no fim da seção M3**

Encontrar a linha (próxima ao fim da seção M3):

```
**Status M3.1 (rings + realtime):** ✅ implementado em 2026-05-24 via branch `m3-1-dashboard`. ...
```

Adicionar logo após (com linha em branco antes):

```markdown

**Status M3.2 (edit + history):** ✅ implementado em 2026-05-25 via branch `m3-2-edit-history`. EditMealModal full-screen com useReducer, validação via PatchMealItemSchema, add/remove items, totais derivados. History list paginada por semana via useInfiniteQuery + `GET /me/daily-summaries` (cap 31d). HistoryDayCard com hero kcal + 3 MacroBars + meals_count. HistoryEmptyDayCard (visual motivacional, sem CTA — backfill em M3.3). Drill-down: history → history/[day] (read-only) → meal/[id] (com edit/delete). Calendar icon no HomeHeader. M3 completo.
```

- [ ] **Step 2: Commit**

```bash
git add docs/PLAN.md
git commit -m "docs(plan): mark M3.2 (edit + history) as implemented"
```

---

## Task 18: Push branch + abrir PR

- [ ] **Step 1: Push**

```bash
cd /home/pedrobritto/development/fitbrother
git push -u origin m3-2-edit-history
```

- [ ] **Step 2: Criar PR via gh**

```bash
gh pr create --title "M3.2 — Edit inline + History" --body "$(cat <<'EOF'
## Summary
- EditMealModal full-screen acessado via Pencil button no meal/[id] — edita items (descrição, qtd, unidade, kcal, macros), add/remove, totais derivados
- History list paginada por semana (`useInfiniteQuery`) com 1 endpoint novo `GET /me/daily-summaries?from&to` (cap 31d)
- HistoryDayCard com hero kcal + 3 MacroBars + meals_count; HistoryEmptyDayCard motivacional pros dias sem registro
- Drill-down completo: history → history/[day] (read-only) → meal/[id] (edit/delete)
- Calendar icon no HomeHeader como entry point
- MacroBar component finalmente implementado (deferred do M3.1)

## Spec + Plan
- [docs/superpowers/specs/2026-05-25-m3-2-edit-history-design.md](docs/superpowers/specs/2026-05-25-m3-2-edit-history-design.md)
- [docs/superpowers/plans/2026-05-25-m3-2-edit-history.md](docs/superpowers/plans/2026-05-25-m3-2-edit-history.md)

## Out of scope (M3.3)
- Backfill (registrar refeição em dia passado a partir do empty-day card)
- DateTime picker pra consumed_at no edit
- Edit de meal_type
- Realtime na history

## Test plan
- [ ] `./scripts/checks/m3-2-history.sh` passa (2 SQL + 5 HTTP checks)
- [ ] Expo Go: Pencil button no meal abre modal, edit qty + Save → MealCard reflete em <1s
- [ ] Modal: descartar com dirty → Alert nativo
- [ ] Modal: remover items até restar 1 → delete fica desabilitado
- [ ] Modal: adicionar item → Save → backend cria
- [ ] Modal: macros negativos → Alert no submit
- [ ] HomeHeader Calendar → /history abre com 7 dias mais recentes
- [ ] Scroll fim → +7 dias carregam
- [ ] Dia sem refeição → empty card aparece (motivacional)
- [ ] Tap em dia com refeições → /history/[day] abre
- [ ] Dentro de history/[day], tap em meal → meal/[id] → edit → save → volta pra history/[day] atualizado

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Reportar URL ao usuário**

---

## Self-review notes

- **Spec coverage:**
  - Backend endpoint → Task 1 (shared schema) + Task 2 (Fastify handler).
  - API client → Tasks 3 + 4.
  - Hooks → Tasks 5 + 6.
  - Components → Tasks 7 (MacroBar), 8 (HistoryDayCard), 9 (HistoryEmptyDayCard), 13 (EditMealModal).
  - Routes → Tasks 11 (history/index), 12 (history/[day]), 14 (meal/[id]/edit).
  - Modifications → Tasks 10 (HomeHeader) + 15 (meal/[id] Pencil).
  - Smoke checks → Task 16.
  - Docs + PR → Tasks 17 + 18.

- **Placeholder scan**: cada step tem código ou comando concreto. Nenhum "TBD" / "TODO" / "implement later".

- **Type consistency**:
  - `DailySummariesResponseSchema` (Task 1) usada em `fetchDailySummaries` (Task 3) + `useDailySummaries` (Task 5).
  - `PatchMealRequest` (existing in shared) usada em `patchMeal` (Task 4) + `useUpdateMeal` (Task 6) + `EditMealModal` (Task 13).
  - `dailySummariesHistoryKey` exportada de `useDailySummaries` (Task 5), importada em `useUpdateMeal` (Task 6).
  - `Unit = MealResponse["items"][number]["unit"]` inferido em `EditMealModal` — bate com `UnitSchema` em shared.

- **Risk: Expo Router co-existence of `[id].tsx` + `[id]/` directory** — Task 14 step 1 cobre fallback (mover para `[id]/index.tsx`).

- **Sem novas migrations.** Backend só adiciona endpoint, sem mudança de schema. M2 ja contém o `PATCH /meals/:id` necessário.
