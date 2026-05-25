# M3.1 — Dashboard (Home rings + Realtime) — Design

**Status:** Draft · 2026-05-24
**Owner:** @Pebritto
**Milestone:** M3.1 (parte 1 de 2 — M3.2 cobre edit inline + history)

## Contexto

M2 entregou registro de refeição (texto + áudio) com triggers que mantêm `daily_summaries` atualizada por usuário/dia. Hoje a Home (`apps/mobile/app/(app)/index.tsx`) mostra cabeçalho + lista de meals + composer no rodapé — nenhum sinal visual de progresso vs meta.

M3.1 introduz o **dashboard nutricional do dia**: um ring central com calorias e três rings menores com macros (proteína, carboidrato, gordura), atualizados em **tempo real** via Supabase Realtime quando dados mudam (próprio device ou outro device do mesmo usuário).

M3.2 (escopo separado) cobre edição inline em `meal/[id].tsx` e a tela `app/history/index.tsx`.

## Goals

1. Mostrar progresso visual do dia nutricional (kcal + 3 macros) na Home.
2. Refletir mudanças (insert/update/delete de meal) em <1s sem refresh manual.
3. Suportar multi-device: ação em device A reflete em B em <2s.
4. Manter consistência com a boundary `day_start_hour` definida em M2.

## Non-goals

- Edit inline de meal (M3.2).
- Tela de history navegável (M3.2).
- `MacroBar` component (§12.2 do DESIGN_SYSTEM) — útil só em listas densas; fica pra M3.2.
- StreakCounter funcional (M5).
- Otimização de bundle/animações além do que Reanimated 4 já oferece.

## Decisões tomadas no brainstorm

| Decisão | Escolha | Razão |
|---|---|---|
| Split do M3 | M3.1 (rings+realtime) + M3.2 (edit+history) | PRs menores, valor visual entra primeiro |
| Realtime now? | Sim, full spec | M5 (cron streak) e multi-device justificam |
| Centro do ring | Hero `1850` + `/ 2200 kcal`; macros `78g` + label | Mais legível; preserva número absoluto em destaque |
| Scroll behavior | `ListHeaderComponent` (scroll com lista) | Não come 200pt fixos; pattern Strava/MFP |
| Abordagem backend | Spec-style completo: view + RPC + Fastify + publication | Consistência com `/meals/*` via Fastify; deixa `vw_today_summary` pronta pra M3.2 |
| `MacroBar` no M3.1 | Defer pra M3.2 | Não tem consumidor em rings-only |

## Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│                       Mobile (Expo)                       │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  app/(app)/index.tsx                               │   │
│  │  ├─ HomeHeader                                     │   │
│  │  ├─ ErrorBanner                                    │   │
│  │  ├─ Animated.FlatList                              │   │
│  │  │   ├─ ListHeaderComponent: TodaySummaryHeader    │   │
│  │  │   │   ├─ ProgressRing hero (160, calories)      │   │
│  │  │   │   └─ Row(ProgressRing×3, 80 each)           │   │
│  │  │   └─ items: MealCardSwipeable[]                 │   │
│  │  └─ MealComposer (rodapé)                          │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  Hooks                                                     │
│  ├─ useDailySummary(day)            → GET /me/daily-summary
│  ├─ useDailySummaryRealtime(uid,day) → channel ds:<uid>:<day>
│  └─ useMealsRealtime(uid,day)       → channel meals:<uid>:<day>
└──────────────────────────────────────────────────────────┘
                   │ HTTPS                  │ WSS
                   ▼                        ▼
┌──────────────────────────────────────────────────────────┐
│                Server (Fastify) / Supabase                │
│                                                            │
│  Fastify ── GET /me/daily-summary[?day=YYYY-MM-DD]        │
│             → SELECT vw_today_summary OR daily_summaries  │
│                                                            │
│  Supabase Realtime ── publication "supabase_realtime"     │
│             include: daily_summaries, meals               │
│             filter via RLS (security_invoker view)        │
└──────────────────────────────────────────────────────────┘
```

## Database

### Migration `0022_daily_summary_helpers.sql`

```sql
-- M3.1. "Hoje" do user respeitando timezone + day_start_hour.
-- Wrapper sobre fitbrother_nutritional_day (0014) sem ts argument.
CREATE OR REPLACE FUNCTION public.fitbrother_today(p_user_id uuid)
RETURNS date
LANGUAGE sql STABLE
AS $$
  SELECT public.fitbrother_nutritional_day(p_user_id, now());
$$;

-- View: row de daily_summaries para o dia "hoje" do user autenticado.
-- security_invoker=true → RLS de daily_summaries aplica ao caller (não à dona).
-- Retorna 0 rows se user não tem refeições hoje.
CREATE OR REPLACE VIEW public.vw_today_summary
WITH (security_invoker = true)
AS
  SELECT ds.*
  FROM public.daily_summaries ds
  WHERE ds.user_id = auth.uid()
    AND ds.day = public.fitbrother_today(auth.uid());
```

### Migration `0023_realtime_publication.sql`

```sql
-- Habilita Realtime (Logical Replication) em daily_summaries + meals.
-- Filtro de eventos por user_id acontece no cliente (canal Postgres Changes
-- com filter=user_id=eq.<id>); RLS valida que apenas rows do user vão pro
-- subscriber correto.
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_summaries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meals;
```

## Shared package

### `packages/shared/src/schemas/daily-summary.ts`

```ts
import { z } from "zod";

export const DailySummarySchema = z.object({
  user_id: z.string().uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  goal_kcal: z.number().nullable(),
  goal_protein_g: z.number().nullable(),
  goal_carbs_g: z.number().nullable(),
  goal_fat_g: z.number().nullable(),
  goal_hit: z.boolean(),
  meals_count: z.number().int(),
  updated_at: z.string(),
});

export type DailySummary = z.infer<typeof DailySummarySchema>;

export const DailySummaryResponseSchema = z.object({
  summary: DailySummarySchema,
});
```

Exporta também via `packages/shared/src/index.ts`.

## Backend (Fastify)

### `apps/server/src/routes/me.ts` — nova rota

`GET /me/daily-summary` (auth required, query `day` opcional).

**Contract:**

- `200 OK` → `{ summary: DailySummary }`
- `401` se sem JWT (middleware existente)
- `500` em erro de DB

**Comportamento:**

1. Se `?day=YYYY-MM-DD` válido → query `daily_summaries` direto por `(user_id, day)`.
2. Se sem `day` → query `vw_today_summary` (DB resolve "hoje").
3. Se row não existe → resposta "empty" preservando shape: zeros nos macros consumidos, snapshot da meta vigente (lookup em `nutrition_goals`), `goal_hit=false`, `meals_count=0`, `updated_at=now()`.

**Implementação:**

```ts
fastify.get<{ Querystring: { day?: string } }>(
  "/me/daily-summary",
  { preHandler: requireAuth, schema: { querystring: z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }) } },
  async (req, reply) => {
    const userId = req.user.id;
    const day = req.query.day;

    const client = supabaseAsUser(req); // helper já existente em apps/server/src/lib/supabase.ts
    const { data, error } = day
      ? await client.from("daily_summaries").select("*").eq("day", day).maybeSingle()
      : await client.from("vw_today_summary").select("*").maybeSingle();

    if (error) throw error;
    if (data) return reply.send({ summary: DailySummarySchema.parse(data) });

    // Empty fallback — preserva shape com goal snapshot.
    const resolvedDay = day ?? (await resolveTodayForUser(client, userId));
    const goals = await loadGoalsForDay(client, userId, resolvedDay);
    return reply.send({
      summary: {
        user_id: userId,
        day: resolvedDay,
        kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
        goal_kcal: goals?.kcal ?? null,
        goal_protein_g: goals?.protein_g ?? null,
        goal_carbs_g: goals?.carbs_g ?? null,
        goal_fat_g: goals?.fat_g ?? null,
        goal_hit: false,
        meals_count: 0,
        updated_at: new Date().toISOString(),
      } satisfies DailySummary,
    });
  },
);
```

Onde `resolveTodayForUser` faz `select fitbrother_today($1)` via RPC e `loadGoalsForDay` faz `SELECT kcal, protein_g, carbs_g, fat_g FROM nutrition_goals WHERE user_id=$1 AND effective_from<=$2 AND (effective_to IS NULL OR effective_to>=$2) ORDER BY effective_from DESC LIMIT 1`.

## Mobile

### `apps/mobile/lib/api/me.ts`

Adiciona:

```ts
import { DailySummaryResponseSchema, type DailySummary } from "@fitbrother/shared";

export async function fetchDailySummary(day: string): Promise<DailySummary> {
  const res = await authedFetch(`/me/daily-summary?day=${encodeURIComponent(day)}`);
  const body = await parseOrThrow(res);
  return DailySummaryResponseSchema.parse(body).summary;
}
```

### `apps/mobile/lib/hooks/useDailySummary.ts` (novo)

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchDailySummary } from "@/lib/api/me";

export const dailySummaryKey = (day: string) => ["daily-summary", day] as const;

export function useDailySummary(day: string) {
  return useQuery({
    queryKey: dailySummaryKey(day),
    queryFn: () => fetchDailySummary(day),
    enabled: Boolean(day),
  });
}
```

### `apps/mobile/lib/hooks/useDailySummaryRealtime.ts` (novo)

```ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dailySummaryKey } from "./useDailySummary";

export function useDailySummaryRealtime(userId: string | undefined, day: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId || !day) return;
    const channel = supabase
      .channel(`ds:${userId}:${day}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "daily_summaries", filter: `user_id=eq.${userId}` },
        (payload) => {
          if ((payload.new as { day?: string }).day === day) {
            qc.invalidateQueries({ queryKey: dailySummaryKey(day) });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, day, qc]);
}
```

> O filtro Postgres aceita apenas `user_id=eq.<id>`. `day` é filtrado JS-side porque UPDATEs em dias passados (edição de meal antigo) também chegam ao canal.

### `apps/mobile/lib/hooks/useMealsRealtime.ts` (novo)

Análogo, mas escuta `*` (INSERT, UPDATE, DELETE) em `meals` filtrando por `user_id`. Invalida `mealsForDayKey(day)` quando `payload.new.user_id === userId` (insert/update) ou `payload.old.user_id === userId` (delete). Também invalida `dailySummaryKey(day)` como aceleração — o UPDATE de daily_summaries chega assíncrono após o trigger.

### Componente `ProgressRing.tsx` (novo)

`apps/mobile/components/domain/ProgressRing.tsx`. Props conforme DESIGN_SYSTEM §12.1:

```ts
type Props = {
  value: number;
  max: number | null;
  color: "protein" | "carbs" | "fat" | "calories";
  size?: number;          // default 80; hero 160
  strokeWidth?: number;   // default 8; hero 14
  label?: string;         // "proteína" etc
  centerTop?: string;     // valor formatado (ex: "78g", "1850")
  centerBottom?: string;  // sublabel (ex: "proteína", "/ 2200 kcal")
  accessibilityLabel?: string;
};
```

Render: `Svg` com 2 `Circle` (track + progress). Animação via Reanimated 4 — `useSharedValue(value)`, `useDerivedValue` computa `strokeDashoffset`, animação `withTiming(target, { duration: Motion.duration.slow=420ms, easing: Easing.bezier(0.0, 0.0, 0.2, 1) })`. Usa `Animated.Circle` (export de `react-native-svg` compatível com Reanimated) ou `setNativeProps` se necessário.

Cor mapeada via `lib/colors.ts` (espelho JS dos tokens). Track sempre `colors.neutral[100]`.

**Overshoot:** quando `value > max`, ring fecha 360°; centro mostra valor real sem truncar. Sem warning visual no M3.1.

**`max=null` ou 0:** renderiza só o track, sem progresso; centro mostra apenas o valor consumido.

### Componente `TodaySummaryHeader.tsx` (novo)

`apps/mobile/components/domain/TodaySummaryHeader.tsx`. Composição apenas — consome `DailySummary` via prop, renderiza:

```
View (px-6 pt-4 pb-6 items-center gap-6)
├─ ProgressRing hero
│    value=summary.kcal, max=summary.goal_kcal
│    color="calories" size={160} strokeWidth={14}
│    centerTop=fmt(summary.kcal) (ex: "1850")
│    centerBottom={summary.goal_kcal ? `/ ${fmt(summary.goal_kcal)} kcal` : "kcal"}
│
└─ View (flex-row justify-around w-full px-2)
   ├─ ProgressRing color="protein"  value/max/label="proteína"
   ├─ ProgressRing color="carbs"    value/max/label="carboidrato"
   └─ ProgressRing color="fat"      value/max/label="gordura"
```

Cada macro ring: `size=80`, `strokeWidth=8`, `centerTop="78g"`, `centerBottom=label`. Formatação numérica via `tabular-nums` no `Text` interno (CLAUDE.md regra UI #2).

### Integração na Home

`apps/mobile/app/(app)/index.tsx`:

1. Importa `useDailySummary`, `useDailySummaryRealtime`, `useMealsRealtime`, `TodaySummaryHeader`.
2. Após `useMealsForDay`, chama `const summaryQuery = useDailySummary(day)`.
3. Chama `useDailySummaryRealtime(userId, day)` e `useMealsRealtime(userId, day)` (no-op se sem `userId`).
4. `Animated.FlatList` recebe `ListHeaderComponent={<TodaySummaryHeader summary={summaryQuery.data} />}` — componente trata `undefined` (renderiza rings em "loading state": valor=0, sem animação).
5. **Empty state**: quando `items.length === 0`, ainda renderiza `TodaySummaryHeader` no topo (com summary zerado retornado pelo server) seguido por `EmptyMealsState` logo abaixo. Sem rings em estado vazio é menos informativo do que rings em 0/meta visível.

## Edge cases

| # | Cenário | Comportamento |
|---|---|---|
| 1 | User sem `nutrition_goals` ativo | `goal_*=null`; ring renderiza só track; centro mostra apenas valor consumido |
| 2 | Realtime desconectado | supabase-js reconecta com backoff; foreground triggera invalidate via React Query default |
| 3 | Hot reload duplicando channel | `removeChannel` no cleanup do `useEffect` resolve; composition do channel name garante unicidade |
| 4 | UPDATE no-op (recompute idêntico) | Realtime envia evento; refetch é O(1) na PK; aceitável |
| 5 | Race optimistic insert × Realtime echo | Mutation resolve substitui optimistic pelo payload server; Realtime adiciona daily_summaries update — sem dedup necessário |
| 6 | Animação durante navegação | Reanimated cancela no unmount |
| 7 | Day rollover (boundary cruza) | `nutritionalToday(profile)` muda `day`; query keys mudam → React Query refetch + channel re-subscribe |
| 8 | `value > max` | Ring fecha 360°, centro mostra valor real, cor neutra |

## Testing

### Backend (Vitest + supabase-js)

`apps/server/src/routes/__tests__/me.daily-summary.test.ts`:

1. `vw_today_summary` retorna 0 rows para user novo sem meals.
2. `vw_today_summary` retorna row correta após criar meal hoje.
3. `vw_today_summary` respeita `day_start_hour` (user com `day_start_hour=4`, meal às 03:00 ainda conta como ontem).
4. RLS: user A não lê row do user B (criar 2 users, JWT separados, validar).
5. `GET /me/daily-summary` sem query → resolve "hoje" via DB function.
6. `GET /me/daily-summary?day=2026-05-20` retorna row específica do dia.
7. `GET /me/daily-summary` retorna shape empty com goal snapshot quando user sem refeições.

### Mobile — smoke manual

1. Home com refeições renderiza rings corretos.
2. Deletar meal → ring atualiza em <1s.
3. Adicionar meal (texto e áudio) → ring atualiza após processing.
4. Multi-device: Expo Go + simulator com mesmo user — INSERT em A reflete em B em <2s.
5. Empty state mostra rings em 0 + meta.
6. Pull-to-refresh refetch também daily-summary.

> ProgressRing animação não tem unit test (Reanimated não tem boa story de teste). Confiança via smoke.

## "Feito quando"

- Home renderiza hero kcal + 3 rings macro com dados corretos pro dia.
- Adicionar/deletar meal atualiza rings em <1s na mesma sessão.
- Multi-device: INSERT em device A reflete em B em <2s sem ação manual.
- Empty state (0 meals) mostra rings em zero + meta visível.
- 7 testes backend passando.
- TypeScript clean, lint clean.

## Arquivos críticos (M3.1)

- **Migrations:** `supabase/migrations/0022_daily_summary_helpers.sql`, `0023_realtime_publication.sql`
- **Shared:** `packages/shared/src/schemas/daily-summary.ts` (+ export no index)
- **Backend:** `apps/server/src/routes/me.ts` (extensão)
- **Mobile:**
  - `apps/mobile/lib/api/me.ts` (extensão: `fetchDailySummary`)
  - `apps/mobile/lib/hooks/useDailySummary.ts` (novo)
  - `apps/mobile/lib/hooks/useDailySummaryRealtime.ts` (novo)
  - `apps/mobile/lib/hooks/useMealsRealtime.ts` (novo)
  - `apps/mobile/components/domain/ProgressRing.tsx` (novo)
  - `apps/mobile/components/domain/TodaySummaryHeader.tsx` (novo)
  - `apps/mobile/app/(app)/index.tsx` (integração)
- **Tests:** `apps/server/src/routes/__tests__/me.daily-summary.test.ts` (novo)

## Decisões em aberto

Nenhuma. Todas resolvidas no brainstorm.

## Risco

| Risco | Mitigação |
|---|---|
| Animação Reanimated + react-native-svg `Animated.Circle` pode ter quirks em SDK 54 | Fallback: usar `setNativeProps` direto no `Circle.ref` se Reanimated não funcionar bem |
| Realtime publication impacta perf do Postgres local | Negligível em dev (1 user). Em prod (M6) revisitar com métricas. |
| Channel cleanup falha em hot reload provocando subscriptions órfãs | `removeChannel` + composition de nome único por `(userId, day)` |
