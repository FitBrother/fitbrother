# M3.3 — Backfill (registrar refeições em dias passados)

**Data:** 2026-05-25
**Branch alvo:** `m3-3-backfill`
**PR esperado:** único
**Dependências:** M3.2 mergeado (history/[day], EditMealModal, useDailySummaries com cutoff)

---

## Goal

Permitir que o usuário registre uma refeição em um dia **passado** dentro de uma janela de 7 dias, usando o mesmo composer natural-language (texto + áudio + LLM) já estabelecido no Home. Sem mover refeições existentes; sem reconstrução de histórico antigo.

## Non-goals (explicit)

- **Mover refeição existente entre dias** — server já aceita PATCH consumed_at; UI não expõe. Permanece como está.
- **Backfill via WhatsApp** — webhook continua usando `now()` por design.
- **Backfill em massa / import CSV** — sem caso de uso.
- **Notificar usuário que esqueceu de registrar** — feature de gamificação (M5).
- **Estender janela além de 7 dias** — decisão consciente: backfill é "esqueci essa semana", não "reconstruir 3 meses".

---

## Architecture

### Frontend (Expo Router)

Nova rota modal `app/(app)/history/[day]/new.tsx`. Mesmo padrão de `meal/[id]/edit.tsx` já estabelecido em M3.2 (`Stack.Screen options={{ presentation: "modal", headerShown: false }}`).

Estrutura final:

```
app/(app)/history/
  [day]/
    index.tsx          (já existe — adiciona botão "+ Registrar refeição")
    new.tsx            (NOVO modal route)
```

Componentes novos:

- **`BackfillContextBar`** — barra fina abaixo do header, mostra `"Sex, 23 mai · 12:30 ▼"`. Tap no horário abre time picker.
- **`HistoryEmptyDayCard`** — vira tapável (envolve com Pressable, navega pra `/history/[day]`).

Componentes modificados:

- **`MealComposer`** — ganha prop opcional `consumedAt?: string`. Quando presente, envia no body do `POST /meals/text|audio`.
- **`history/[day]/index.tsx`** — header ganha botão CTA "+ Registrar refeição", visível apenas quando `day !== today && day >= today - 6` no fuso do usuário.

### Backend (Fastify)

O server **já aceita** `consumed_at` opcional em `POST /meals/text` e `POST /meals/audio` (schema `CreateMealTextRequestSchema` / `CreateMealAudioRequestSchema` em [packages/shared/src/schemas.ts](packages/shared/src/schemas.ts)). A única mudança é **validar o bound da janela**.

Em `apps/server/src/routes/meals.ts`, depois do parse Zod e antes da chamada da RPC `create_meal_*`, adicionar bloco de validação que:

1. Computa o dia nutricional do `consumed_at` via RPC `fitbrother_nutritional_day(uid, ts)` — já usada na mesma rota.
2. Computa o dia nutricional de hoje via RPC `fitbrother_today(uid)` — já usada em `me.ts`.
3. Calcula `minDay = today - 6 dias`.
4. Se `backfillDay < minDay || backfillDay > today`, retorna `400 backfill_window_exceeded` com `{ error, window: { from, to } }`.

Sem migration. Trigger de `daily_summaries` já recalcula corretamente pra qualquer dia.

### Mobile data flow

A mutation de create no composer **já** invalida `mealsForDay(today)` e `dailySummaryToday`. Pra backfill:

- Quando `consumedAt` está presente no `onSuccess`, invalidar adicionalmente:
  - `mealsForDayKey(backfillDay)` — pra o `history/[day]` refletir o novo meal
  - `dailySummariesHistoryKey` — pra o infinite scroll do `/history` refletir a mudança de macros do dia
- Realtime channel já entrega o update de `daily_summaries(backfillDay)` por filtro de `user_id`. Home Today ignora (assina só hoje). History invalida na sucesso da mutation — Realtime + invalidate convergem no mesmo estado.

---

## Component contracts

### `MealComposer` (modificação)

```tsx
type MealComposerProps = {
  consumedAt?: string;          // ISO timestamp; quando presente, enviado no body
  onSuccess?: () => void;       // callback após mutation success (ex.: router.back)
};
```

- Sem `consumedAt`: comportamento atual (server usa `now()`).
- Com `consumedAt`: passa no body. Invalidação extra de queries do dia backfillado (ver acima).
- Sem mudança em validação local. Server é fonte de verdade do bound.

### `BackfillContextBar` (novo)

```tsx
type BackfillContextBarProps = {
  day: string;                  // YYYY-MM-DD
  consumedAt: string;           // ISO timestamp
  onChangeConsumedAt: (iso: string) => void;
};
```

- Renderiza `formatDayLong(day)` (ex.: "Sex, 23 mai") + horário tapável (ex.: "12:30 ▼").
- Tap no horário abre `<DateTimePicker mode="time" />` (já presente no projeto; confirmar lib no plan).
- A data (day) **não é editável** nessa barra — é fixa pelo route param. Pra mudar de dia, usuário fecha e abre noutro `/history/[day]/new`.

### `history/[day]/new.tsx` (novo)

```tsx
// Esqueleto:
const { day } = useLocalSearchParams<{ day: string }>();
const profile = useProfile();
const [consumedAt, setConsumedAt] = useState(() =>
  defaultConsumedAtForDay(day, profile)   // 12:00 no fuso do usuário
);

return (
  <View className="flex-1 bg-neutral-50">
    <Stack.Screen options={{ presentation: "modal", headerShown: false }} />
    <ModalHeader title={formatDayLong(day)} onClose={() => router.back()} />
    <BackfillContextBar day={day} consumedAt={consumedAt} onChangeConsumedAt={setConsumedAt} />
    <MealComposer consumedAt={consumedAt} onSuccess={() => router.back()} />
  </View>
);
```

**`defaultConsumedAtForDay(day, profile)`** — retorna ISO `${day}T12:00:00` convertido pro fuso do `profile.timezone`. Helper novo em `apps/mobile/lib/dateMath.ts` (consolidando `addDays` que hoje vive inline em `useDailySummaries.ts`).

### `HistoryEmptyDayCard` (modificação)

Envolver o conteúdo atual num `Pressable` com:
- `onPress={() => router.push({ pathname: "/(app)/history/[day]", params: { day } })}`
- `accessibilityLabel="Ver dia {day} (sem refeições registradas)"`
- Mantém visual: opacity 0.65, MoonStar icon, copy motivacional ("Nenhuma refeição registrada / Que tal não deixar passar mais um dia?").

### `history/[day]/index.tsx` (modificação)

Adicionar no header (ou abaixo dele, decisão de UI no plan):

```tsx
const canBackfill = day !== today && day >= addDaysIso(today, -6);
{canBackfill && (
  <Pressable
    onPress={() => router.push(`/history/${day}/new` as any)}
    className="..."
    accessibilityLabel="Registrar refeição neste dia"
  >
    <Plus />
    <Text>Registrar refeição</Text>
  </Pressable>
)}
```

---

## Bound (janela de 7 dias)

**Definição canônica:** dia válido para backfill ↔ `day ∈ [today-6, today-1]` no fuso do usuário.

- `today` é o dia nutricional atual via `fitbrother_today(uid)`.
- Hoje é excluído da CTA pq pra hoje a entrada é o composer do Home (sem `consumed_at`).
- Server aceita `consumed_at` resolvendo pra `today` normalmente (caso o usuário force via URL ou caso de borda); equivale a um meal sem backfill.

**Comparação entre data e cutoff:** strings `YYYY-MM-DD` comparam corretamente lexicograficamente. Mesmo padrão já usado em `useDailySummaries.ts:clampFrom`.

---

## Server validation (detalhe)

Em ambos `POST /meals/text` e `POST /meals/audio`:

```ts
if (consumed_at) {
  const { data: backfillDay, error: dayErr } = await supabase.rpc(
    "fitbrother_nutritional_day",
    { p_user_id: userId, p_ts: consumed_at }
  );
  if (dayErr || !backfillDay) {
    return reply.code(500).send({ error: "nutritional_day_failed" });
  }

  const { data: today, error: todayErr } = await supabase.rpc(
    "fitbrother_today",
    { p_user_id: userId }
  );
  if (todayErr || !today) {
    return reply.code(500).send({ error: "today_lookup_failed" });
  }

  const minDay = addDaysIso(today as string, -6);
  if ((backfillDay as string) < minDay || (backfillDay as string) > today) {
    return reply.code(400).send({
      error: "backfill_window_exceeded",
      window: { from: minDay, to: today },
    });
  }
}
```

**`addDaysIso`** — novo helper em `apps/server/src/lib/dateMath.ts` (espelho do que existe no mobile). Função pura, sem dependência de timezone — opera em strings `YYYY-MM-DD`.

**Por que validar no server, não só no client:**
- Defesa em profundidade.
- Cliente desatualizado / forjado.
- Bound consistente entre clientes.

**Sobre `meals.created_at`:** continua sendo `now()` no insert (rastro de quando o registro foi feito). Só `consumed_at` recebe a data passada. Auditoria: `created_at - consumed_at > 0` identifica um backfill.

---

## Error handling

| Server response | Copy mobile |
|---|---|
| `400 backfill_window_exceeded` | "Só é possível registrar refeições dos últimos 7 dias. Atualize o histórico." |
| `400 ai_quota_exceeded` (já existe) | (já tratado) "Limite diário de IA atingido." |
| `4xx/5xx outros` | (já tratado) banner genérico |

**Caso de borda — meia-noite atravessa com modal aberto:**
Server retorna `400 backfill_window_exceeded`. Mobile mostra a copy acima. Usuário fecha modal, history scroll atualiza automaticamente quando volta (já que invalidação foi disparada pela tentativa).

**Caso de borda — `consumed_at` no futuro:**
`backfillDay > today` → `400 backfill_window_exceeded` (mesmo bound). Copy não precisa ser específica.

**Caso de borda — duplo tap em "Registrar":**
Composer atual já gera novo `client_meal_id` por submissão; idempotência ON CONFLICT da RPC cobre retry transparente.

---

## Smoke checks (test plan)

Sem SQL novo (sem migration). Apenas HTTP em `scripts/checks/m3-3-backfill.sh`:

1. `POST /meals/text` com `consumed_at = today - 8d` (fora da janela) → `400 backfill_window_exceeded`.
2. `POST /meals/text` com `consumed_at = today - 3d` (dentro da janela) → `201` + meal criado.
3. `POST /meals/text` sem `consumed_at` → `201` (regressão check do happy path atual).
4. `POST /meals/text` com `consumed_at` em formato inválido → `400` (Zod cobre).
5. `GET /me/meals?day=today-3d` após (2) → contém o meal criado.
6. `GET /me/daily-summaries?from=today-6&to=today` após (2) → summary do dia backfillado tem kcal > 0.

Smoke do mobile é manual — feature pequena demais pra valer e2e nova.

---

## Out of scope (recap)

- Mover meal existente entre dias.
- Backfill via WhatsApp.
- Backfill em massa.
- Notificação proativa "vc esqueceu ontem".
- Edição de meal_type no `BackfillContextBar` (composer já infere via LLM).

---

## Files touched (resumo)

**Server:**
- `apps/server/src/routes/meals.ts` — validação backfill window em ambos os POST.
- `apps/server/src/lib/dateMath.ts` — novo, helper `addDaysIso`.

**Shared:**
- Nenhuma mudança em `packages/shared/src/schemas.ts`. Schemas já aceitam `consumed_at` opcional.

**Mobile:**
- `apps/mobile/app/(app)/history/[day]/new.tsx` — novo modal route.
- `apps/mobile/app/(app)/history/[day]/index.tsx` — botão CTA "+ Registrar".
- `apps/mobile/components/domain/BackfillContextBar.tsx` — novo.
- `apps/mobile/components/domain/HistoryEmptyDayCard.tsx` — wrap em Pressable + navega.
- `apps/mobile/components/domain/MealComposer.tsx` — prop opcional `consumedAt`, invalidações extras.
- `apps/mobile/lib/dateMath.ts` — consolida `addDays` (hoje inline em `useDailySummaries.ts`) + adiciona `defaultConsumedAtForDay`.

**Scripts:**
- `scripts/checks/m3-3-backfill.sh` — smoke HTTP.
