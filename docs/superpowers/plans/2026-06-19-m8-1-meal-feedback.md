# M8.1 — Feedback imediato da refeição (piggyback) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Após registrar uma refeição, mostrar uma frase curta de feedback da IA ("Ótima fonte de proteína 💪") sem nenhuma chamada extra de LLM — a mesma extração que calcula macros já devolve o feedback.

**Architecture:** O `feedback` entra no `MealExtractionSchema` e na function-declaration do Gemini (piggyback). É persistido em `meals.ai_feedback` via a RPC `create_meal_with_items` (um campo a mais no payload). O cache global de extração passa a guardar o feedback; bumpar `LLM_PROMPT_VERSION` invalida o cache antigo. Mobile exibe no detalhe da refeição.

**Tech Stack:** Supabase (Postgres RPC), Fastify + zod, Gemini function calling, Expo Router, `@fitbrother/shared`.

**Base:** branch `feat/m8-ai-analysis` (spec já commitada). Migrations até `0048`. Verificação: check SQL rolled-back + `typecheck`/`lint`; mobile e2e manual.

---

## File Structure
- `supabase/migrations/0049_meals_ai_feedback.sql` — coluna `ai_feedback` + RPC atualizada.
- `scripts/checks/m8-1-feedback.sql` + `.sh` — check.
- `packages/shared/src/schemas.ts` — `feedback` no `MealExtractionSchema`; `ai_feedback` no `MealResponseSchema`.
- `packages/shared/src/prompt-version.ts` — bump `LLM_PROMPT_VERSION` → `"v2"`.
- `apps/server/src/services/llm/gemini.ts` — `feedback` na declaration + prompt.
- `apps/server/src/routes/meals.ts` — `ai_feedback` nos 3 payloads + no `MEAL_DETAIL_SELECT`.
- `packages/db-types/index.ts` — regenerado.
- `apps/mobile/app/(app)/meal/[id]/index.tsx` — exibe o feedback.

---

## Task 1: Migration `0049` — coluna + RPC

**Files:** Create `supabase/migrations/0049_meals_ai_feedback.sql`, `scripts/checks/m8-1-feedback.sql`, `scripts/checks/m8-1-feedback.sh`

- [ ] **Step 1: Write the failing check**

`scripts/checks/m8-1-feedback.sql`:
```sql
-- M8.1 feedback — checks SQL.
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: coluna meals.ai_feedback existe.
SELECT 'check_1_column' AS check,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'meals' AND column_name = 'ai_feedback') AS pass;

-- Check 2: RPC create_meal_with_items persiste ai_feedback do payload.
DO $$
DECLARE u uuid := gen_random_uuid(); m uuid := gen_random_uuid(); fb text;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.profiles (user_id, timezone) VALUES (u, 'UTC');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.create_meal_with_items(jsonb_build_object(
    'id', m, 'source', 'app_text', 'raw_input', 'ovos',
    'meal_type', 'breakfast', 'confidence', 0.9,
    'ai_feedback', 'Ótima fonte de proteína',
    'items', jsonb_build_array(jsonb_build_object(
      'description','Ovos','quantity',2,'unit','unit',
      'kcal',140,'protein_g',12,'carbs_g',1,'fat_g',10))
  ));
  RESET ROLE;
  SELECT ai_feedback INTO fb FROM public.meals WHERE id = m;
  IF fb IS DISTINCT FROM 'Ótima fonte de proteína' THEN
    RAISE EXCEPTION 'check_2_FAIL: ai_feedback=%', fb;
  END IF;
  RAISE NOTICE 'check_2_pass: RPC persiste ai_feedback';
END $$;

ROLLBACK;
```

- [ ] **Step 2: Run → fails** (`column "ai_feedback" does not exist`)

Run: `docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m8-1-feedback.sql`

- [ ] **Step 3: Write the migration**

`supabase/migrations/0049_meals_ai_feedback.sql`:
```sql
-- M8.1 — Feedback imediato da refeição (piggyback na extração). Coluna nova +
-- a RPC create_meal_with_items passa a persistir payload->>'ai_feedback'.
ALTER TABLE public.meals ADD COLUMN ai_feedback text;

CREATE OR REPLACE FUNCTION public.create_meal_with_items(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  uid              uuid := auth.uid();
  v_meal_id        uuid := (payload->>'id')::uuid;
  v_source         meal_source := (payload->>'source')::meal_source;
  v_raw_input      text := payload->>'raw_input';
  v_audio_path     text := NULLIF(payload->>'audio_path', '');
  v_meal_type      meal_type := COALESCE((payload->>'meal_type')::meal_type, 'other');
  v_consumed_at    timestamptz := COALESCE((payload->>'consumed_at')::timestamptz, now());
  v_confidence     numeric := NULLIF(payload->>'confidence', '')::numeric;
  v_review_required boolean := COALESCE(v_confidence < 0.6, false);
  v_ai_feedback    text := NULLIF(payload->>'ai_feedback', '');
  v_inserted_id    uuid;
  v_item           jsonb;
  v_day            date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'create_meal_with_items requires authenticated user';
  END IF;
  IF v_meal_id IS NULL THEN
    RAISE EXCEPTION 'create_meal_with_items requires payload.id (client UUID)';
  END IF;
  IF v_source IS NULL THEN
    RAISE EXCEPTION 'create_meal_with_items requires payload.source';
  END IF;

  INSERT INTO public.meals (
    id, user_id, source, raw_input, audio_path, meal_type,
    consumed_at, confidence, review_required, ai_feedback
  )
  VALUES (
    v_meal_id, uid, v_source, v_raw_input, v_audio_path, v_meal_type,
    v_consumed_at, v_confidence, v_review_required, v_ai_feedback
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('id', v_meal_id, 'already_existed', true);
  END IF;

  PERFORM set_config('fitbrother.bulk_insert', 'on', true);
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO public.meal_items (
      meal_id, food_id, description, quantity, unit,
      kcal, protein_g, carbs_g, fat_g, density_assumed
    )
    VALUES (
      v_meal_id,
      NULLIF(v_item->>'food_id', '')::uuid,
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit')::unit,
      (v_item->>'kcal')::numeric,
      (v_item->>'protein_g')::numeric,
      (v_item->>'carbs_g')::numeric,
      (v_item->>'fat_g')::numeric,
      COALESCE((v_item->>'density_assumed')::bool, false)
    );
  END LOOP;
  PERFORM set_config('fitbrother.bulk_insert', 'off', true);

  PERFORM public.fitbrother_recompute_meal_totals(v_meal_id);

  IF NOT v_review_required THEN
    v_day := public.fitbrother_nutritional_day(uid, v_consumed_at);
    PERFORM public.fitbrother_recompute_daily_summary(uid, v_day);
  END IF;

  RETURN jsonb_build_object(
    'id', v_meal_id,
    'already_existed', false,
    'review_required', v_review_required,
    'day', public.fitbrother_nutritional_day(uid, v_consumed_at)
  );
END;
$$;
```

- [ ] **Step 4: Apply + run check → passa**

Run: `npm run db:reset && docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m8-1-feedback.sql`
Expected: check_1 `pass=t`, NOTICE `check_2_pass`.

- [ ] **Step 5: Commit**

`scripts/checks/m8-1-feedback.sh` (mesmo molde do m7-3):
```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$ROOT"
echo "── M8.1 feedback checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m8-1-feedback.sql
echo "── done ──"
```
```bash
chmod +x scripts/checks/m8-1-feedback.sh
git add supabase/migrations/0049_meals_ai_feedback.sql scripts/checks/m8-1-feedback.* docs/superpowers/plans/2026-06-19-m8-1-meal-feedback.md
git commit -m "feat(m8.1): meals.ai_feedback + RPC persiste feedback"
```

---

## Task 2: Shared schemas + bump prompt version

**Files:** `packages/shared/src/schemas.ts`, `packages/shared/src/prompt-version.ts`

- [ ] **Step 1: Add `feedback` to MealExtractionSchema**

Em `schemas.ts`, no `MealExtractionSchema`:
```ts
export const MealExtractionSchema = z.object({
  meal_type: MealTypeSchema,
  items: z.array(MealItemExtractionSchema).min(1),
  confidence: z.number().min(0).max(1),
  feedback: z.string().max(200).default(""),
});
```

- [ ] **Step 2: Add `ai_feedback` to MealResponseSchema**

No `MealResponseSchema` (logo após `review_required: z.boolean(),`):
```ts
  ai_feedback: z.string().nullable(),
```

- [ ] **Step 3: Bump prompt version**

`prompt-version.ts`: `export const LLM_PROMPT_VERSION = "v2";`

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck`
```bash
git add packages/shared/src/schemas.ts packages/shared/src/prompt-version.ts
git commit -m "feat(m8.1): feedback no MealExtraction/MealResponse + bump LLM_PROMPT_VERSION v2"
```

---

## Task 3: Gemini — feedback na extração

**Files:** `apps/server/src/services/llm/gemini.ts`

- [ ] **Step 1: Add `feedback` to the function declaration**

Em `extractMealFunctionDeclaration.parameters.properties`, adicionar após `confidence`:
```ts
      confidence: { type: SchemaType.NUMBER },
      feedback: {
        type: SchemaType.STRING,
        description:
          "Frase curta (<=200 chars), calorosa e específica, em português brasileiro, comentando a refeição com base nos macros (ex: 'Ótima fonte de proteína 💪', 'Bem leve, mas faltou proteína'). Sem julgamento moralista.",
      },
```
E em `required` do objeto raiz, adicionar `"feedback"`:
```ts
    required: ["meal_type", "items", "confidence", "feedback"],
```

- [ ] **Step 2: Add feedback guidance to SYSTEM_PROMPT**

Acrescentar ao final do `SYSTEM_PROMPT`:
```
\n\nAlém da extração, gere "feedback": uma frase curta (<=200 caracteres), em português brasileiro, calorosa e específica, comentando a refeição a partir dos macros estimados. Seja parceiro, não professor. Nunca culpabilize comida.
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck && npm run lint`
```bash
git add apps/server/src/services/llm/gemini.ts
git commit -m "feat(m8.1): Gemini retorna feedback junto da extração"
```

---

## Task 4: Routes — threading ai_feedback + select

**Files:** `apps/server/src/routes/meals.ts`

- [ ] **Step 1: Add `ai_feedback` to `MEAL_DETAIL_SELECT`**

```ts
const MEAL_DETAIL_SELECT = `
  id, source, raw_input, audio_path, meal_type, consumed_at,
  total_kcal, total_protein_g, total_carbs_g, total_fat_g,
  confidence, review_required, ai_feedback, created_at, deleted_at,
  items:meal_items(
    id, food_id, description, quantity, unit,
    kcal, protein_g, carbs_g, fat_g, density_assumed
  )
`;
```

- [ ] **Step 2: Pass `ai_feedback` in all 3 create payloads**

Nas três chamadas `supabase.rpc("create_meal_with_items", { payload: { ... } })` (text, audio, photo), adicionar ao objeto `payload`, junto de `confidence`:
```ts
        confidence: extraction.output.confidence,
        ai_feedback: extraction.output.feedback || null,
        items: applied,
```

- [ ] **Step 3: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
```bash
git add apps/server/src/routes/meals.ts
git commit -m "feat(m8.1): persistir ai_feedback nos 3 fluxos de criação + select"
```

---

## Task 5: Regen db-types

**Files:** `packages/db-types/index.ts`
- [ ] Run: `npm run db:types`
- [ ] Run: `npm run typecheck` (confirma server bate com schema gerado).
- [ ] Commit: `git add packages/db-types/index.ts && git commit -m "chore(m8.1): regen db-types (meals.ai_feedback)"`

---

## Task 6: Mobile — exibir feedback no detalhe

**Files:** `apps/mobile/app/(app)/meal/[id]/index.tsx`

- [ ] **Step 1: Render the feedback block**

Logo abaixo do bloco de macros (após a linha que mostra `…g P · …g C · …g G`, perto da linha 174), adicionar:
```tsx
        {meal.ai_feedback ? (
          <View className="mt-4 rounded-2xl bg-primary-50 p-4">
            <Text className="text-sm font-sans-medium text-primary-700">{meal.ai_feedback}</Text>
          </View>
        ) : null}
```
> Confirme o nome da variável da refeição no escopo (`meal`) e que `meal.ai_feedback` está tipado — após a Task 2 o `MealResponseSchema` inclui `ai_feedback`. Se a tela usar outro nome de schema/parse pro meal, ajuste para consumir o campo novo.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`

- [ ] **Step 3: Manual e2e (device)**

Registrar "2 ovos e café" → no detalhe da refeição aparece a frase de feedback. Registrar de novo o MESMO texto → continua aparecendo (veio do cache de extração, agora com feedback). Registrar algo sem feedback (improvável) → tela não quebra.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/meal/[id]/index.tsx"
git commit -m "feat(m8.1): exibir feedback da IA no detalhe da refeição"
```

---

## Verificação final
- [ ] `npm run db:reset && ./scripts/checks/m8-1-feedback.sh` → checks passam.
- [ ] `npm run typecheck && npm run lint` → limpos.
- [ ] e2e manual: feedback aparece ao registrar (texto/áudio/foto).
- [ ] Atualizar `docs/PLAN.md` §M8 com **Status M8.1**.

**Feito quando:** registrar uma refeição mostra uma frase de feedback coerente da IA, sem chamada extra de LLM; ausência de feedback não quebra o registro; o cache de extração segue funcionando (agora carregando o feedback).
