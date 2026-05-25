# M3.2 — Edit inline + History — Design

**Status:** Draft · 2026-05-25
**Owner:** @Pebritto
**Milestone:** M3.2 (parte 2 de 2 — fecha M3 junto com M3.1 já merged)

## Contexto

M3.1 entregou dashboard rings + Realtime na Home. M3.2 fecha o M3:

1. **Edit inline** em refeições já registradas (`meal/[id].tsx`).
2. **History** — lista paginada de dias anteriores com drill-down.

Backend já tem o essencial:
- `PATCH /meals/:id` (M2) aceita `meal_type`, `consumed_at`, `items[]` (full replace).
- `GET /meals?day=YYYY-MM-DD` (M2) lista refeições do dia.
- `daily_summaries` (M2) já populada via trigger.

Mobile precisa de:
- `EditMealModal` (full-screen) + plumbing pro PATCH existente.
- Tela `history/index.tsx` paginada.
- Tela `history/[day].tsx` read-only.
- Componentes: `MacroBar` (deferred do M3.1), `HistoryDayCard`, `HistoryEmptyDayCard`.

Backend ganha **1 endpoint novo**: `GET /me/daily-summaries?from&to`.

## Goals

1. Permitir editar items de uma refeição (qty, unit, descrição, macros) e adicionar/remover items.
2. Mostrar history paginada com card visual por dia (hero kcal + 3 MacroBars + count refeições).
3. Mostrar dias sem refeições como empty cards motivacionais.
4. Drill-down: card → lista de refeições do dia → detalhe da refeição (com edit).
5. Server-side filtering por range pra otimizar leitura.

## Non-goals

- **Backfill** (registrar refeição em dia passado) — fica pra M3.3.
- **Edit de `meal_type` / `consumed_at`** — backend aceita mas UI não expõe nesse PR.
- **Re-extração via IA no edit** — manual only; user que quer re-extrair deleta + cria.
- **Audio no edit** — só texto e números.
- **Mensal calendar view** — só lista cards.
- **Realtime na history** — refetch on focus basta.
- **StreakCounter / goal_hit visual rico** — só badge simples por enquanto.

## Decisões tomadas no brainstorm

| Decisão | Escolha | Razão |
|---|---|---|
| Scope split | PR único M3.2 inteiro | Edit + History são independentes mas fecham M3 numa rodada |
| Edit UX | Modal full-screen | Isolamento de contexto, save/cancel explícitos |
| Edit scope | Médio: qty + unit + desc + macros + add/remove items | Backend já aceita esse payload; cobre caso comum |
| History entry | Ícone Calendar no HomeHeader | Consistente com pattern sem tab bar |
| History list | Card por dia com hero kcal + 3 MacroBars + count | Visual rico, aproveita MacroBar deferred |
| Day card tap | Abre `history/[day].tsx` read-only | Drill-down natural em 3 níveis |
| Pagination | Infinite scroll por semana, recent first | Funciona bem com FlatList + onEndReached |
| Backend approach | `GET /me/daily-summaries?from&to` via Fastify | Consistência com M3.1 |
| Empty days | UI fills client-side com `HistoryEmptyDayCard` | DB só armazena dados reais; visual distinto motivacional |
| Backfill | Out of scope (M3.3) | Complexidade adicional não justifica adiar M3.2 |

## Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│                       Mobile                              │
│                                                            │
│  Home (app/(app)/index.tsx)                                │
│  └─ HomeHeader gains Calendar icon → push /history         │
│                                                            │
│  History (app/(app)/history/)                              │
│  ├─ index.tsx — FlatList of cards, infinite by week        │
│  │   ├─ HistoryDayCard (filled)                            │
│  │   └─ HistoryEmptyDayCard (gap-filled client-side)       │
│  │       └─ tap filled → push /history/[day]               │
│  └─ [day].tsx — read-only daily detail                     │
│      ├─ TodaySummaryHeader (reused) — rings for that day   │
│      └─ FlatList of MealCard (no swipe-to-delete)          │
│          └─ tap → push /(app)/meal/[id]                    │
│                                                            │
│  Meal Detail (app/(app)/meal/[id].tsx)                     │
│  ├─ Header gains Pencil icon → opens EditMealModal         │
│  └─ EditMealModal (presentation="fullScreenModal")         │
│      ├─ useReducer local state (items + dirty)             │
│      └─ Save → useUpdateMeal mutation → PATCH /meals/:id   │
│                                                            │
│  Hooks                                                     │
│  ├─ useDailySummaries(from, to)  — infinite query          │
│  └─ useUpdateMeal(mealId)         — PATCH                  │
└──────────────────────────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    Server (Fastify)                       │
│                                                            │
│  GET /me/daily-summaries?from&to (new)                     │
│   → SELECT * FROM daily_summaries                          │
│     WHERE user_id=auth.uid()                               │
│       AND day BETWEEN $from AND $to                        │
│     ORDER BY day DESC                                      │
│  Cap range: 31 days. Sparse: real rows only.               │
│                                                            │
│  PATCH /meals/:id (existing M2)                            │
│   → UPDATE meals (meal_type, consumed_at if provided)      │
│   → DELETE FROM meal_items WHERE meal_id=:id               │
│   → INSERT INTO meal_items (...) [full replace]            │
│   → trigger recomputes meals.total_* + daily_summaries     │
└──────────────────────────────────────────────────────────┘
```

## Backend

### Nova rota — `apps/server/src/routes/me.ts`

`GET /me/daily-summaries?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Contract:**
- `200 OK` → `{ summaries: DailySummary[] }` (ordem `day DESC`).
- `400` invalid query (formato, `from > to`, range > 31d).
- `401` sem JWT.
- `500` DB error.

**Implementação:**

```ts
const dailySummariesQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
});

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

### Por que sem `generate_series` server-side

Versão anterior do design tentava preencher dias vazios via `RPC + generate_series + LATERAL JOIN nutrition_goals`. Refinamento: **UI preenche gaps client-side com card visual próprio** (`HistoryEmptyDayCard`). DB só armazena dados reais (zero overhead nos dias vazios), server query é trivial (1 SELECT range), e empty-day card pode ser visualmente distinto pra motivar registro.

### Shared package — `packages/shared/src/schemas.ts`

Adicionar:

```ts
export const DailySummariesResponseSchema = z.object({
  summaries: z.array(DailySummarySchema),
});
export type DailySummariesResponse = z.infer<typeof DailySummariesResponseSchema>;
```

### `PATCH /meals/:id` (existing — sem mudança)

Já aceita o payload necessário (vide `apps/server/src/routes/meals.ts:247-290`). Items são full-replace (DELETE all + INSERT). Trigger `meal_items` recompõe `meals.total_*` e enfileira recompute de `daily_summaries`.

## Mobile

### API client

`apps/mobile/lib/api/me.ts` (extensão):

```ts
import { DailySummariesResponseSchema, type DailySummary } from "@fitbrother/shared";

export async function fetchDailySummaries(from: string, to: string): Promise<DailySummary[]> {
  const res = await authedFetch(
    `/me/daily-summaries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  const body = await parseOrThrow(res);
  return DailySummariesResponseSchema.parse(body).summaries;
}
```

`apps/mobile/lib/api/meals.ts` (extensão):

```ts
import type { PatchMealRequest } from "@fitbrother/shared";

export async function patchMeal(id: string, patch: PatchMealRequest): Promise<MealResponse> {
  const res = await authedFetch(`/meals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const body = (await parseOrThrow(res)) as { meal: MealResponse };
  return body.meal;
}
```

### Hooks

**`apps/mobile/lib/hooks/useDailySummaries.ts` (new):**

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDailySummaries } from "@/lib/api/me";

const WEEK_DAYS = 7;

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type PageParam = { from: string; to: string };

export function useDailySummaries(todayIso: string) {
  return useInfiniteQuery({
    queryKey: ["daily-summaries-history"],
    initialPageParam: {
      from: addDays(todayIso, -(WEEK_DAYS - 1)),
      to: todayIso,
    } satisfies PageParam,
    queryFn: ({ pageParam }) => fetchDailySummaries(pageParam.from, pageParam.to),
    getNextPageParam: (_last, _all, lastParam) => ({
      from: addDays(lastParam.from, -WEEK_DAYS),
      to: addDays(lastParam.from, -1),
    }),
  });
}
```

**`apps/mobile/lib/hooks/useUpdateMeal.ts` (new):**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PatchMealRequest } from "@fitbrother/shared";
import { patchMeal } from "@/lib/api/meals";
import { mealDetailKey, mealsForDayKey } from "./useMealsForDay";
import { dailySummaryKey } from "./useDailySummary";

export function useUpdateMeal(mealId: string, day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PatchMealRequest) => patchMeal(mealId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealDetailKey(mealId) });
      qc.invalidateQueries({ queryKey: mealsForDayKey(day) });
      qc.invalidateQueries({ queryKey: dailySummaryKey(day) });
      qc.invalidateQueries({ queryKey: ["daily-summaries-history"] });
    },
  });
}
```

### Componente: `MacroBar.tsx` (deferred do M3.1)

`apps/mobile/components/domain/MacroBar.tsx`. Spec do DESIGN_SYSTEM §12.2:

```tsx
type Props = {
  value: number;
  max: number | null;
  color: "protein" | "carbs" | "fat";
  label: string;
};

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
          style={[fillStyle, { backgroundColor: colorFor(color) }]}
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

### Componente: `HistoryDayCard.tsx` (new)

Composição visual:
- Header (data formatada pt-BR, ex.: "qua, 22 mai 2026")
- Card body:
  - Linha 1: `XXXX / YYYY kcal` (font-sans-bold text-xl tabular-nums) | "N refeições" (right)
  - 3× `MacroBar` (proteína, carboidrato, gordura)
  - Badge `🔥` no canto se `goal_hit=true`
- Tap action: `router.push(\`/(app)/history/${day}\`)`.

### Componente: `HistoryEmptyDayCard.tsx` (new)

- Header igual (data formatada)
- Card body com opacity 0.65:
  - Ícone neutral (lucide `MoonStar` ou `CloudOff`)
  - Texto: "Nenhuma refeição registrada"
  - Subtexto: "Que tal não deixar passar mais um dia?"
- Sem tap action (visual only no M3.2).

### Componente: `EditMealModal.tsx` (new)

`apps/mobile/components/domain/EditMealModal.tsx`. Renderiza via Expo Router modal:

```tsx
// app/(app)/meal/[id].tsx — adiciona Pencil button
<Pressable onPress={() => router.push(`/(app)/meal/${id}/edit`)}>
  <Pencil size={20} />
</Pressable>

// app/(app)/meal/[id]/edit.tsx — novo arquivo, presentation="modal"
export default function EditMealRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditMealModal mealId={id} />;
}
```

Estado via `useReducer`:

```ts
type ItemDraft = {
  id?: string;          // undefined = novo item
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
```

Render:
- Header: `[✕] Editar refeição [Salvar]`. ✕ verifica `dirty` → Alert nativo "Descartar alterações?".
- ScrollView com cards de items. Cada card: TextInput descrição, qty, unit picker, kcal, P/C/G (3 TextInputs numéricos).
- Botão `[🗑]` em cada item (desabilita se items.length === 1).
- Botão `[+ Adicionar item]` no fim.
- Totais derivados (`useMemo` sobre `items`) em footer.

Validação no Save:
- Cada item parseado via `PatchMealItemSchema` do shared.
- Se algum falha → Alert "Item N tem campos inválidos" + highlight border red.

Mutation:
- `useUpdateMeal(mealId, day)` chama `patchMeal({ items })`.
- Loading: botão Salvar mostra spinner; ScrollView/inputs desabilitados.
- Success: `router.back()` (fecha modal), volta pra `/(app)/meal/[id]` atualizado.
- Error: Alert "Não foi possível salvar. Tente novamente." Estado preservado.

### Tela `app/(app)/history/index.tsx` (new)

```tsx
import { useDailySummaries } from "@/lib/hooks/useDailySummaries";
import { useProfile } from "@/lib/profile/profile-context";
import { nutritionalToday } from "@/lib/time/nutritional-day";

export default function HistoryScreen() {
  const profile = useProfile();
  const today = nutritionalToday(profile);
  const query = useDailySummaries(today);

  const entries = useMemo(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap((page, pageIdx) => {
      const param = query.data.pageParams[pageIdx] as { from: string; to: string };
      return expandWeek(param.from, param.to, page);
    });
  }, [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <ScreenHeader title="Histórico" onBack={() => router.back()} />
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
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator /> : null}
      />
    </SafeAreaView>
  );
}
```

`expandWeek` helper:

```ts
type DayEntry =
  | { type: "filled"; day: string; summary: DailySummary }
  | { type: "empty"; day: string };

function expandWeek(from: string, to: string, summaries: DailySummary[]): DayEntry[] {
  const byDay = new Map(summaries.map((s) => [s.day, s]));
  const out: DayEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i);
    const summary = byDay.get(day);
    out.push(summary ? { type: "filled", day, summary } : { type: "empty", day });
  }
  return out.reverse(); // newest first within week
}
```

### Tela `app/(app)/history/[day].tsx` (new)

Read-only daily detail. Reusa `TodaySummaryHeader` (M3.1) passando `summary` daquele dia, e lista de `MealCard` sem swipe-to-delete.

```tsx
export default function HistoryDayScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const summaryQuery = useDailySummary(day!);
  const mealsQuery = useMealsForDay(day!);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <ScreenHeader title={formatDayHeader(day!)} onBack={() => router.back()} />
      <FlatList
        ListHeaderComponent={<TodaySummaryHeader summary={summaryQuery.data} />}
        data={mealsQuery.data ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MealCard
            meal={item}
            onPress={() => router.push(`/(app)/meal/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}
```

`MealCard` (sem `MealCardSwipeable`) reusa o existente já que ele recebe `onPress` opcional.

### HomeHeader Calendar icon

`apps/mobile/components/domain/HomeHeader.tsx` (modificação): adicionar `Calendar` lucide icon à esquerda do `Users`. Tap → `router.push("/(app)/history")`.

## Routing

Estrutura final do Expo Router:

```
app/(app)/
├─ index.tsx                  # Home (M2/M3.1)
├─ friends.tsx
├─ profile.tsx
├─ history/
│  ├─ index.tsx               # NEW (M3.2)
│  └─ [day].tsx               # NEW (M3.2)
└─ meal/
   ├─ [id].tsx                # adicionar Pencil button (M3.2)
   └─ [id]/edit.tsx           # NEW route com modal presentation (M3.2)
```

## Edge cases

| # | Cenário | Comportamento |
|---|---|---|
| 1 | User remove TODOS items no edit | UI desabilita delete no último; Alert se tentar via outro caminho |
| 2 | Validação falha em múltiplos items | Alert "Item N e M inválidos" + highlight border red |
| 3 | Edit em meal com `review_required=true` | Permitido; mantém review_required até POST /confirm |
| 4 | Fechar modal com dirty=true | Alert nativo "Descartar alterações? [Cancelar][Descartar]" |
| 5 | PATCH falha (500, timeout) | Botão Save volta idle, Alert, state local preserved |
| 6 | Refeição deletada por outro device durante edit | PATCH 404 → mesma UX do #5 |
| 7 | User edita macros pra negativo | Cliente valida `nonnegative` no submit |
| 8 | User sem nenhum daily_summaries | History mostra 7 empty cards + scroll cria mais |
| 9 | Range com 0 rows reais | Todos cards são `HistoryEmptyDayCard` |
| 10 | Scroll passa data de criação da conta | Sem cutoff; aceitável (empty cards leves) |
| 11 | `summary.goal_kcal=null` | Card mostra "X kcal" sem `/Y`; MacroBars sem fill |
| 12 | Day rollover durante history scroll | History é fixa em datas, nada muda |
| 13 | Edit numa refeição via history → volta | Mutation invalida `daily-summaries-history` → history list atualiza |

## Testing

### Backend smoke checks (`scripts/checks/m3-2-history.sh`)

1. `GET /me/daily-summaries?from=2026-05-18&to=2026-05-24` → 200 + `{ summaries: [...] }`.
2. Range > 31 days → 400 `range_too_large`.
3. `from > to` → 400 `from_after_to`.
4. Missing `from` ou `to` → 400.
5. `from=invalid-date` → 400.
6. RLS: user A's JWT pede summaries do range que tem rows de user B → retorna apenas rows do A.

### Mobile smoke (manual)

1. **Edit**: abrir meal/[id] → Pencil → modal abre → alterar quantity de 1 item → Salvar → MealCard reflete em <1s.
2. **Edit**: descartar com dirty → Alert aparece, fecha sem mudar dados.
3. **Edit**: remover items até restar 1 → botão delete fica desabilitado.
4. **Edit**: adicionar 1 item → Save → backend cria, total_kcal soma.
5. **Edit**: macros negativos → Alert no submit, não salva.
6. **History**: Home → Calendar icon → tela abre com 7 dias recentes.
7. **History**: scroll fim → +7 dias carregam.
8. **History**: dia sem refeição → empty card aparece.
9. **History**: tap dia com refeições → daily detail abre.
10. **History daily detail**: tap meal → meal/[id] → edit → save → volta pra daily detail → MealCard atualizado.

## "Feito quando"

- Modal de edit funcional: muda quantity, descrição, unidade, macros; adiciona; remove item → salva → totais corretos.
- Header de meal/[id] tem Pencil icon que abre modal.
- HomeHeader tem Calendar icon que abre /history.
- /history mostra cards paginados por semana, com infinite scroll funcional.
- Empty-day card aparece em dias sem registros.
- /history/[day] lista refeições read-only com rings daquele dia.
- Tap em refeição na history → vai pro mesmo /(app)/meal/[id] que tem edit.
- 6 backend smoke checks passando.
- TypeScript clean, lint clean.

## Arquivos críticos (M3.2)

- **Backend:** `apps/server/src/routes/me.ts` (extensão GET /me/daily-summaries).
- **Shared:** `packages/shared/src/schemas.ts` (adicionar DailySummariesResponseSchema).
- **Mobile API:**
  - `apps/mobile/lib/api/me.ts` (+ fetchDailySummaries).
  - `apps/mobile/lib/api/meals.ts` (+ patchMeal).
- **Mobile hooks:**
  - `apps/mobile/lib/hooks/useDailySummaries.ts` (new, infinite query).
  - `apps/mobile/lib/hooks/useUpdateMeal.ts` (new, mutation).
- **Mobile components:**
  - `apps/mobile/components/domain/MacroBar.tsx` (new, animated horizontal bar).
  - `apps/mobile/components/domain/HistoryDayCard.tsx` (new).
  - `apps/mobile/components/domain/HistoryEmptyDayCard.tsx` (new).
  - `apps/mobile/components/domain/EditMealModal.tsx` (new).
  - `apps/mobile/components/domain/HomeHeader.tsx` (modify, +Calendar icon).
- **Mobile routes:**
  - `apps/mobile/app/(app)/history/index.tsx` (new).
  - `apps/mobile/app/(app)/history/[day].tsx` (new).
  - `apps/mobile/app/(app)/meal/[id].tsx` (modify, +Pencil button).
  - `apps/mobile/app/(app)/meal/[id]/edit.tsx` (new, modal route).
- **Tests:** `scripts/checks/m3-2-history.sh` + `.sql`.

## Decisões em aberto

Nenhuma. Todas resolvidas no brainstorm.

## Riscos

| Risco | Mitigação |
|---|---|
| Modal de edit fica grande (state, validation, UI) | Manter `useReducer` puro + componentes pequenos (ItemCardEditor, UnitPicker). Cap em ~300 LoC pro modal. |
| Performance da infinite query em low-end | Range é pequeno (7 days/page), cards leves. Validar em smoke test. |
| Empty days motivacionais ficam "spam" pra user novo | Acceptable trade-off — também serve de onboarding ("registre seu primeiro dia"). |
| Conflito edit simultâneo (2 devices editando mesma refeição) | Last-write-wins via PATCH; raro o suficiente pra não justificar locking. |
