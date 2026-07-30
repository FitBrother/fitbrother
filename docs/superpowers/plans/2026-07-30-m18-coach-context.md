# M18 — Contexto para IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feedback de refeição e insights de período passam a considerar objetivo, restrições, barreiras e `soft_mode` do usuário — não só macros — via um `CoachContext` compacto injetado nos prompts do Gemini.

**Architecture:** `buildCoachContext` (puro, `packages/shared`) monta o objeto compacto a partir de dados já carregados; `loadCoachContext` (`apps/server`) faz as queries de banco e chama a função pura, espelhando o padrão `computeTargets`/`buildTargetsInput` do M15. O hash de cache de extração passa a incluir o contexto pra não vazar feedback de um usuário pro prompt cacheado de outro.

**Tech Stack:** TypeScript, Vitest (`packages/shared`), Supabase Postgres, Gemini function-calling (`@google/generative-ai`).

## Global Constraints

- `nutrition_goals`/`anthropometrics` continuam append-only — nenhuma migration nova faz `UPDATE`/`DELETE` em linha existente.
- Toda tabela/coluna nova é nullable ou tem default — sem quebra de dado existente.
- Sem Vitest em `apps/server` (só `packages/shared` tem) — verificação de código server-side é smoke test manual, não suíte automatizada.
- Cores/tipografia/hit-target não se aplicam (sem UI nova neste milestone, exceto o campo já existente `training_days_per_week` no `onboardingStore`).
- `soft_mode = true` nunca deixa `metas`/`consumido_hoje` chegarem ao prompt — a chave precisa estar **ausente** do objeto, não `undefined`/zerada.

---

## Task 1: `buildCoachContext` — tipos + função pura + tabela de tom (TDD)

**Files:**
- Create: `packages/shared/src/coach/types.ts`
- Create: `packages/shared/src/coach/build-coach-context.ts`
- Create: `packages/shared/src/coach/build-coach-context.test.ts`
- Create: `packages/shared/src/coach/index.ts`

**Interfaces:**
- Produces: `CoachContext`, `CoachContextInput` (types), `buildCoachContext(input: CoachContextInput): CoachContext`, `coachContextToneInstruction(ctx: CoachContext): string` — consumidos pela Task 5 (`loadCoachContext`) e Task 6 (`gemini.ts`).

- [ ] **Step 1: `types.ts`**

```ts
import type { Goal } from "../targets/types.js";

export type CoachContext = {
  objetivo: Goal;
  metas?: { kcal: number; prot: number; carb: number; gord: number };
  restricoes: string[];
  odeia?: string;
  barreira_principal?: string;
  come_fora?: string;
  treino?: { dias_semana: number; forca: boolean };
  modo_suave: boolean;
  consumido_hoje?: { kcal: number; prot: number; carb: number; gord: number };
};

export type CoachContextInput = {
  goal: Goal;
  soft_mode: boolean;
  current_goals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  onboarding_context: Record<string, unknown>;
  training_days_per_week: number | null;
  strength_training: boolean | null;
  today_consumption: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
};
```

- [ ] **Step 2: Escrever os testes que falham (`build-coach-context.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { buildCoachContext, coachContextToneInstruction } from "./build-coach-context.js";
import type { CoachContextInput } from "./types.js";

const BASE_INPUT: CoachContextInput = {
  goal: "lose",
  soft_mode: false,
  current_goals: { kcal: 1850, protein_g: 140, carbs_g: 180, fat_g: 55 },
  onboarding_context: {},
  training_days_per_week: null,
  strength_training: null,
  today_consumption: { kcal: 1200, protein_g: 95, carbs_g: 110, fat_g: 40 },
};

describe("buildCoachContext", () => {
  it("omite metas e consumido_hoje quando soft_mode é true", () => {
    const ctx = buildCoachContext({ ...BASE_INPUT, soft_mode: true });
    expect(ctx.modo_suave).toBe(true);
    expect("metas" in ctx).toBe(false);
    expect("consumido_hoje" in ctx).toBe(false);
  });

  it("inclui metas e consumido_hoje quando soft_mode é false", () => {
    const ctx = buildCoachContext(BASE_INPUT);
    expect(ctx.metas).toEqual({ kcal: 1850, prot: 140, carb: 180, gord: 55 });
    expect(ctx.consumido_hoje).toEqual({ kcal: 1200, prot: 95, carb: 110, gord: 40 });
  });

  it("filtra 'Nenhuma' da lista de restrições", () => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { dietary_restrictions: ["Sem lactose", "Nenhuma"] },
    });
    expect(ctx.restricoes).toEqual(["Sem lactose"]);
  });

  it("barreira_principal fica ausente quando main_barriers está vazio", () => {
    const ctx = buildCoachContext({ ...BASE_INPUT, onboarding_context: { main_barriers: [] } });
    expect(ctx.barreira_principal).toBeUndefined();
  });

  it("barreira_principal é o primeiro item de main_barriers", () => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { main_barriers: ["Fins de semana", "Falta de tempo"] },
    });
    expect(ctx.barreira_principal).toBe("Fins de semana");
  });

  it("treino fica ausente quando training_days_per_week e strength_training são null", () => {
    const ctx = buildCoachContext(BASE_INPUT);
    expect(ctx.treino).toBeUndefined();
  });

  it("treino usa default 0/false pro campo que estiver null", () => {
    const ctx = buildCoachContext({ ...BASE_INPUT, strength_training: true });
    expect(ctx.treino).toEqual({ dias_semana: 0, forca: true });
  });
});

describe("coachContextToneInstruction", () => {
  const CASES: Array<[string, string]> = [
    ["Falta de tempo", "sugestões executáveis em <10 min"],
    ["Fins de semana", "antecipar, dar folga planejada, não punir retroativamente"],
    ["Ansiedade / comer emocional", 'nunca moralizar comida; sem "bom/ruim"'],
    ["Desisto rápido", "reforçar consistência acima de precisão"],
    ["Não sei o que comer", "sempre terminar com uma sugestão concreta"],
    [
      "Comer fora com frequência",
      "sugerir versões mais equilibradas de pratos comuns em restaurante/delivery, nunca como proibição de comer fora",
    ],
  ];

  it.each(CASES)("retorna a instrução certa pra '%s'", (barreira, esperado) => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { main_barriers: [barreira] },
    });
    expect(coachContextToneInstruction(ctx)).toBe(esperado);
  });

  it("retorna string vazia quando barreira_principal está ausente", () => {
    const ctx = buildCoachContext(BASE_INPUT);
    expect(coachContextToneInstruction(ctx)).toBe("");
  });

  it("retorna string vazia pra barreira não reconhecida", () => {
    const ctx = buildCoachContext({
      ...BASE_INPUT,
      onboarding_context: { main_barriers: ["Barreira inventada"] },
    });
    expect(coachContextToneInstruction(ctx)).toBe("");
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm run test --workspace packages/shared`
Expected: FAIL — `build-coach-context.js` não existe ainda.

- [ ] **Step 4: Implementar `build-coach-context.ts`**

```ts
import type { CoachContext, CoachContextInput } from "./types.js";

const BARRIER_TONE: Record<string, string> = {
  "Falta de tempo": "sugestões executáveis em <10 min",
  "Fins de semana": "antecipar, dar folga planejada, não punir retroativamente",
  "Ansiedade / comer emocional": 'nunca moralizar comida; sem "bom/ruim"',
  "Desisto rápido": "reforçar consistência acima de precisão",
  "Não sei o que comer": "sempre terminar com uma sugestão concreta",
  "Comer fora com frequência":
    "sugerir versões mais equilibradas de pratos comuns em restaurante/delivery, nunca como proibição de comer fora",
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function buildCoachContext(input: CoachContextInput): CoachContext {
  const restricoes = asStringArray(input.onboarding_context.dietary_restrictions).filter(
    (r) => r !== "Nenhuma",
  );
  const barreira_principal = asStringArray(input.onboarding_context.main_barriers)[0];
  const odeia = asString(input.onboarding_context.disliked_foods);
  const come_fora = asString(input.onboarding_context.eats_out_frequency);

  const treino =
    input.training_days_per_week !== null || input.strength_training !== null
      ? {
          dias_semana: input.training_days_per_week ?? 0,
          forca: input.strength_training ?? false,
        }
      : undefined;

  const context: CoachContext = {
    objetivo: input.goal,
    restricoes,
    modo_suave: input.soft_mode,
    ...(barreira_principal !== undefined ? { barreira_principal } : {}),
    ...(odeia !== undefined ? { odeia } : {}),
    ...(come_fora !== undefined ? { come_fora } : {}),
    ...(treino !== undefined ? { treino } : {}),
  };

  if (!input.soft_mode) {
    if (input.current_goals) {
      context.metas = {
        kcal: input.current_goals.kcal,
        prot: input.current_goals.protein_g,
        carb: input.current_goals.carbs_g,
        gord: input.current_goals.fat_g,
      };
    }
    if (input.today_consumption) {
      context.consumido_hoje = {
        kcal: input.today_consumption.kcal,
        prot: input.today_consumption.protein_g,
        carb: input.today_consumption.carbs_g,
        gord: input.today_consumption.fat_g,
      };
    }
  }

  return context;
}

export function coachContextToneInstruction(ctx: CoachContext): string {
  if (!ctx.barreira_principal) return "";
  return BARRIER_TONE[ctx.barreira_principal] ?? "";
}
```

- [ ] **Step 5: Rodar os testes de novo e confirmar que passam**

Run: `npm run test --workspace packages/shared`
Expected: PASS — todos os testes de `build-coach-context.test.ts` (16 casos: 7 de `buildCoachContext` + 6 tabelas de tom + 2 casos extras de `coachContextToneInstruction`, totalizando 15 — confira a contagem real na saída do Vitest).

- [ ] **Step 6: `index.ts` do módulo**

```ts
export * from "./types.js";
export * from "./build-coach-context.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/coach
git commit -m "feat(shared): buildCoachContext puro + tabela de tom por barreira (M18)"
```

---

## Task 2: Exportar o módulo `coach` + `training_days_per_week` no `OnboardingPayloadSchema`

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/schemas.ts`

**Interfaces:**
- Consumes: `packages/shared/src/coach/index.ts` (Task 1).
- Produces: `CoachContext`/`buildCoachContext`/`coachContextToneInstruction` acessíveis via `@fitbrother/shared`; `OnboardingPayload.training_days_per_week?: number` — consumido pela Task 3 (migration) e Task 4 (mobile).

- [ ] **Step 1: `packages/shared/src/index.ts`**

```ts
export * from "./schemas.js";
export * from "./prompt-version.js";
export * from "./copy/goals.js";
export * from "./targets/index.js";
export * from "./coach/index.js";
export type { LLMProvider } from "./llm/provider.js";
```

- [ ] **Step 2: `OnboardingPayloadSchema` (`packages/shared/src/schemas.ts`)**

Adicione `training_days_per_week` no bloco de campos opcionais já existente do M16 (logo depois de `strength_training`):

```ts
  strength_training: z.boolean().optional(),
  training_days_per_week: z.number().int().min(0).max(7).optional(),
  is_pregnant_or_lactating: z.boolean().optional(),
```

- [ ] **Step 3: Build + typecheck**

Run: `npm run build --workspace packages/shared && npm run typecheck --workspace packages/shared`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/schemas.ts
git commit -m "feat(shared): exporta módulo coach + training_days_per_week no payload (M18)"
```

---

## Task 3: Migrations — `training_days_per_week` + `complete_onboarding_impl` v4

**Files:**
- Create: `supabase/migrations/0065_anthropometrics_training_days.sql`
- Create: `supabase/migrations/0066_complete_onboarding_v4.sql`
- Reference: `supabase/migrations/0064_complete_onboarding_v3.sql` (não editar — só `CREATE OR REPLACE` na 0066)

**Interfaces:**
- Produces: `anthropometrics.training_days_per_week smallint` (nullable), consumida pela Task 5 (`loadCoachContext`) e persistida pela RPC.

- [ ] **Step 1: `0065_anthropometrics_training_days.sql`**

```sql
-- M18: frequência de treino, coletada no bloco `training` do onboarding (M16)
-- mas nunca persistida — ficava só no estado local do app, sem consumidor.
-- Agora alimenta buildCoachContext (packages/shared/src/coach).
ALTER TABLE public.anthropometrics
  ADD COLUMN training_days_per_week smallint;
```

- [ ] **Step 2: `0066_complete_onboarding_v4.sql`**

Leia `supabase/migrations/0064_complete_onboarding_v3.sql` inteiro antes de
escrever este passo — a 0066 faz `CREATE OR REPLACE` da mesma função,
preservando 100% do que a 0064 já faz, só adicionando
`training_days_per_week` ao `INSERT` de `anthropometrics` (bloco "2.
anthropometrics"):

```sql
-- M18: complete_onboarding_impl persiste training_days_per_week (coletado
-- no bloco `training` do onboarding desde o M16, sem consumidor até agora).
-- Preserva integralmente o que 0064 (M16, onboarding_context/soft_mode/
-- delete de onboarding_progress), 0060 (M15, targets em TS), 0038
-- (username/avatar_url/phone_e164) e 0024 (effective_from) já corrigiam.
CREATE OR REPLACE FUNCTION public.complete_onboarding_impl(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  uid               uuid := auth.uid();
  v_birth_date      date  := (payload->>'birth_date')::date;
  v_sex             sex   := (payload->>'sex')::sex;
  v_activity_level  activity_level := (payload->>'activity_level')::activity_level;
  v_goal            goal  := (payload->>'goal')::goal;
  v_weight_kg       numeric := (payload->>'weight_kg')::numeric;
  v_height_cm       numeric := (payload->>'height_cm')::numeric;
  v_policy_version  text  := COALESCE(payload->'consents'->>'policy_version', 'v1.0');
  v_phone_e164      text := NULLIF(payload->>'phone_e164', '');
  v_targets         jsonb := payload->'targets';
  v_soft_mode       boolean := COALESCE((payload->>'soft_mode')::boolean, false);
  v_anthro_id       uuid;
  v_goal_id         uuid;
  v_effective_from  date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires authenticated user';
  END IF;

  IF v_targets IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires payload.targets (computed by computeTargets)';
  END IF;

  -- 1. profiles ------------------------------------------------------------
  INSERT INTO public.profiles (
    user_id, full_name, username, avatar_url, birth_date, sex,
    activity_level, goal, timezone, day_start_hour, locale, lgpd_consent_at,
    onboarding_context, soft_mode
  )
  VALUES (
    uid,
    payload->>'full_name',
    NULLIF(payload->>'username', '')::citext,
    NULLIF(payload->>'avatar_url', ''),
    v_birth_date,
    v_sex,
    v_activity_level,
    v_goal,
    payload->>'timezone',
    COALESCE((payload->>'day_start_hour')::smallint, 0),
    COALESCE(payload->>'locale', 'pt-BR'),
    now(),
    COALESCE(payload->'onboarding_context', '{}'::jsonb),
    v_soft_mode
  );

  IF v_phone_e164 IS NOT NULL THEN
    INSERT INTO public.profiles_private (user_id, phone_e164)
    VALUES (uid, v_phone_e164);
  END IF;

  -- 2. anthropometrics (bmr/tdee chegam prontos de computeTargets;
  --    flags de saúde, peso-alvo/ritmo e frequência de treino vêm do
  --    payload — M15/M16/M18) --------------------------------------------
  INSERT INTO public.anthropometrics (
    user_id, weight_kg, height_cm, bmr_kcal, tdee_kcal,
    target_weight_kg, rate_kg_per_week,
    strength_training, is_pregnant_or_lactating, has_kidney_disease,
    has_type1_diabetes, uses_glp1, tca_screening_positive,
    training_days_per_week
  )
  VALUES (
    uid,
    v_weight_kg,
    v_height_cm,
    (v_targets->>'bmr_kcal')::numeric,
    (v_targets->>'tdee_kcal')::numeric,
    NULLIF(payload->>'target_weight_kg', '')::numeric,
    NULLIF(payload->>'rate_kg_per_week', '')::numeric,
    (payload->>'strength_training')::boolean,
    (payload->>'is_pregnant_or_lactating')::boolean,
    (payload->>'has_kidney_disease')::boolean,
    (payload->>'has_type1_diabetes')::boolean,
    (payload->>'uses_glp1')::boolean,
    (payload->>'tca_screening_positive')::boolean,
    NULLIF(payload->>'training_days_per_week', '')::smallint
  )
  RETURNING id INTO v_anthro_id;

  -- 3. nutrition_goals (kcal/macros já computados; effective_from pelo dia
  --    nutricional do usuário, não CURRENT_DATE do servidor — 0024) --------
  v_effective_from := public.fitbrother_nutritional_day(uid, now());

  INSERT INTO public.nutrition_goals (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g, fiber_g,
    tdee_source, warnings, blocked
  )
  VALUES (
    uid,
    v_effective_from,
    (v_targets->>'kcal')::numeric,
    (v_targets->>'protein_g')::numeric,
    (v_targets->>'carbs_g')::numeric,
    (v_targets->>'fat_g')::numeric,
    (v_targets->>'fiber_g')::numeric,
    COALESCE(v_targets->>'tdee_source', 'declared'),
    COALESCE(v_targets->'warnings', '[]'::jsonb),
    COALESCE((v_targets->>'blocked')::boolean, false)
  )
  RETURNING id INTO v_goal_id;

  -- 4. subscriptions (defaults: free / active) ------------------------------
  INSERT INTO public.subscriptions (user_id) VALUES (uid);

  -- 5. consent_log (terms / privacy / ai_processing) ------------------------
  INSERT INTO public.consent_log (user_id, scope, policy_version)
  VALUES
    (uid, 'terms',         v_policy_version),
    (uid, 'privacy',       v_policy_version),
    (uid, 'ai_processing', v_policy_version);

  -- 6. onboarding_progress não tem mais o que retomar: a conta existe -------
  DELETE FROM public.onboarding_progress WHERE user_id = uid;

  RETURN jsonb_build_object(
    'user_id',           uid,
    'anthropometric_id', v_anthro_id,
    'nutrition_goal_id', v_goal_id,
    'tdee_kcal',         v_targets->>'tdee_kcal',
    'kcal',              v_targets->>'kcal',
    'protein_g',         v_targets->>'protein_g',
    'carbs_g',           v_targets->>'carbs_g',
    'fat_g',             v_targets->>'fat_g',
    'fiber_g',           v_targets->>'fiber_g',
    'warnings',          v_targets->'warnings',
    'blocked',           v_targets->>'blocked',
    'block_reason',      v_targets->>'block_reason',
    'soft_mode',         v_soft_mode
  );
END;
$$;
```

- [ ] **Step 3: Aplicar e verificar**

Run: `npx supabase db reset`
Expected: as 66 migrations aplicam sem erro.

- [ ] **Step 4: Smoke test SQL em transação (rollback)**

```sql
BEGIN;

DO $$
DECLARE
  u uuid := gen_random_uuid();
  result jsonb;
  anthro record;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  result := public.complete_onboarding(jsonb_build_object(
    'full_name', 'Teste M18',
    'birth_date', '1994-01-01',
    'sex', 'female',
    'weight_kg', 70,
    'height_cm', 165,
    'activity_level', 'moderate',
    'goal', 'maintain',
    'timezone', 'America/Sao_Paulo',
    'day_start_hour', 0,
    'training_days_per_week', 4,
    'consents', jsonb_build_object('terms', true, 'privacy', true, 'ai_processing', true, 'policy_version', 'v1.0'),
    'targets', jsonb_build_object(
      'bmr_kcal', 1400, 'tdee_kcal', 2170, 'tdee_source', 'declared',
      'kcal', 2170, 'protein_g', 112, 'carbs_g', 250, 'fat_g', 60,
      'fiber_g', 30, 'warnings', '[]'::jsonb, 'blocked', false
    )
  ));

  RESET ROLE;

  SELECT * INTO anthro FROM public.anthropometrics WHERE user_id = u;
  IF anthro.training_days_per_week IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'check_FAIL: training_days_per_week = %, esperado 4', anthro.training_days_per_week;
  END IF;

  RAISE NOTICE 'ALL CHECKS PASSED';
END $$;

ROLLBACK;
```

Run contra o Postgres local (`docker exec -i <container> psql -U postgres -d postgres < arquivo.sql`, mesmo padrão do M15/M16).
Expected: `NOTICE: ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0065_anthropometrics_training_days.sql supabase/migrations/0066_complete_onboarding_v4.sql
git commit -m "feat(db): training_days_per_week persistido no onboarding (M18)"
```

---

## Task 4: Mobile — `training_days_per_week` no `toPayload()`

**Files:**
- Modify: `apps/mobile/lib/stores/onboardingStore.ts`

**Interfaces:**
- Consumes: `training_days_per_week` (já existe no `OnboardingState`/`INITIAL` desde o M16).
- Produces: `toPayload()` inclui `training_days_per_week` no objeto retornado — consumido pelo endpoint `POST /onboarding/complete` (schema já aceita desde a Task 2).

- [ ] **Step 1: Adicionar a linha em `toPayload()`**

No objeto retornado por `toPayload()`, logo abaixo de `strength_training: s.strength_training,`:

```ts
      strength_training: s.strength_training,
      training_days_per_week: s.training_days_per_week,
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/stores/onboardingStore.ts
git commit -m "feat(mobile): envia training_days_per_week no payload de onboarding (M18)"
```

---

## Task 5: `loadCoachContext` (`apps/server`)

**Files:**
- Create: `apps/server/src/services/coach-context.ts`

**Interfaces:**
- Consumes: `buildCoachContext`, `CoachContext`, `CoachContextInput` (Task 1, via `@fitbrother/shared`).
- Produces: `loadCoachContext(client: SupabaseClient, userId: string): Promise<CoachContext>` — consumido pelas Tasks 7, 8, 9.

- [ ] **Step 1: Implementar**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCoachContext, type CoachContext } from "@fitbrother/shared";

/**
 * Monta o CoachContext de um usuário a partir do banco. Funciona tanto com
 * um client autenticado (rota HTTP, RLS já escopa por auth.uid()) quanto
 * com o client de service-role (job de insights, sem sessão de usuário) —
 * por isso toda query filtra explicitamente por user_id, sem depender de
 * views que assumem auth.uid() (ex.: vw_today_summary).
 */
export async function loadCoachContext(
  client: SupabaseClient,
  userId: string,
): Promise<CoachContext> {
  const [profileQ, anthroQ, goalQ, todayQ] = await Promise.all([
    client
      .from("profiles")
      .select("goal, soft_mode, onboarding_context")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("anthropometrics")
      .select("training_days_per_week, strength_training")
      .eq("user_id", userId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("nutrition_goals")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .is("effective_to", null)
      .maybeSingle(),
    client.rpc("fitbrother_today", { p_user_id: userId }),
  ]);

  if (profileQ.error) throw new Error(`coach_context_profile_failed: ${profileQ.error.message}`);
  if (!profileQ.data) throw new Error("coach_context_profile_not_found");

  const today = todayQ.data as string | null;
  let todayConsumption: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null =
    null;
  if (today) {
    const { data: summary } = await client
      .from("daily_summaries")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    if (summary) {
      todayConsumption = {
        kcal: summary.kcal,
        protein_g: summary.protein_g,
        carbs_g: summary.carbs_g,
        fat_g: summary.fat_g,
      };
    }
  }

  return buildCoachContext({
    goal: profileQ.data.goal,
    soft_mode: profileQ.data.soft_mode,
    onboarding_context: (profileQ.data.onboarding_context ?? {}) as Record<string, unknown>,
    training_days_per_week: anthroQ.data?.training_days_per_week ?? null,
    strength_training: anthroQ.data?.strength_training ?? null,
    current_goals: goalQ.data,
    today_consumption: todayConsumption,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/coach-context.ts
git commit -m "feat(server): loadCoachContext monta CoachContext a partir do banco (M18)"
```

---

## Task 6: `LLMProvider` ganha `context` + `gemini.ts` injeta nos 2 prompts

**Files:**
- Modify: `packages/shared/src/llm/provider.ts`
- Modify: `apps/server/src/services/llm/gemini.ts`

**Interfaces:**
- Consumes: `CoachContext`, `coachContextToneInstruction` (Task 1).
- Produces: `LLMProvider.extractMeal(input: {text, locale, context})`,
  `LLMProvider.generateInsight(input: {periodType, locale, data, context})`,
  `extractMealImageWithGemini(input: {base64, mimeType, locale, context})` —
  consumidos pelas Tasks 7, 8, 9.

- [ ] **Step 1: `packages/shared/src/llm/provider.ts`**

```ts
import type { MealExtraction, InsightContent } from "../schemas.js";
import type { CoachContext } from "../coach/types.js";

export interface LLMProvider {
  readonly name: "gemini" | "openai";
  extractMeal(input: { text: string; locale: string; context: CoachContext }): Promise<{
    output: MealExtraction;
    usage: { inputTokens: number; outputTokens: number; costCents: number };
  }>;
  generateInsight(input: {
    periodType: "day" | "week" | "month";
    locale: string;
    data: unknown;
    context: CoachContext;
  }): Promise<{
    output: InsightContent;
    usage: { inputTokens: number; outputTokens: number; costCents: number };
  }>;
}
```

- [ ] **Step 2: Typecheck do pacote (deve falhar — `gemini.ts` ainda não implementa a assinatura nova)**

Run: `npm run typecheck --workspace packages/shared`
Expected: PASS (o pacote em si compila — a interface só afeta quem a implementa, e `gemini.ts` fica em `apps/server`).

Run: `npm run typecheck --workspace apps/server`
Expected: FAIL — `gemini.ts` não implementa `context` ainda. Confirma que o passo seguinte é necessário.

- [ ] **Step 3: `gemini.ts` — atualizar `SYSTEM_PROMPT`, `extractFromGeminiContent`, `geminiProvider.extractMeal`, `extractMealImageWithGemini`**

Adicione ao final de `SYSTEM_PROMPT` (depois da frase sobre "feedback"):

```
Ajuste o tom do campo "feedback" ao contexto do usuário fornecido no início da mensagem, seguindo a instrução de tom quando houver uma. Nunca mencione números de calorias/macros que não estejam explicitamente em "metas" ou "consumido_hoje" no contexto — se essas chaves não vierem, o usuário está em modo suave e não deve ver nenhum número.
```

Troque `extractFromGeminiContent` pra aceitar um prefixo de contexto:

```ts
async function extractFromGeminiContent(
  parts: Array<string | { inlineData: { data: string; mimeType: string } }>,
) {
```

(assinatura não muda — quem monta `parts` já inclui o bloco de contexto como uma string a mais no array, feito no passo seguinte).

Troque `geminiProvider.extractMeal`:

```ts
  async extractMeal({ text, locale, context }) {
    const contextBlock = `Contexto do usuário (JSON): ${JSON.stringify(context)}\n${coachContextToneInstruction(context)}`;
    return extractFromGeminiContent([`${contextBlock}\n\nLocale: ${locale}\n\nRefeição: ${text}`]);
  },
```

Adicione o import no topo do arquivo:

```ts
import { InsightContentSchema, MealExtractionSchema, type LLMProvider } from "@fitbrother/shared";
import { coachContextToneInstruction, type CoachContext } from "@fitbrother/shared";
```

(pode ficar na mesma linha do import existente de `@fitbrother/shared` — só adicione `coachContextToneInstruction` e o tipo `CoachContext` à lista já importada, não crie uma segunda linha de import do mesmo módulo).

Troque `extractMealImageWithGemini`:

```ts
export async function extractMealImageWithGemini(input: {
  base64: string;
  mimeType: string;
  locale: string;
  context: CoachContext;
}) {
  const contextBlock = `Contexto do usuário (JSON): ${JSON.stringify(input.context)}\n${coachContextToneInstruction(input.context)}`;
  return extractFromGeminiContent([
    `${contextBlock}\n\nLocale: ${input.locale}\n\nExtraia a refeição visível nesta foto. Se houver embalagens, pratos ou acompanhamentos, estime quantidades de forma conservadora.`,
    { inlineData: { data: input.base64, mimeType: input.mimeType } },
  ]);
}
```

- [ ] **Step 4: `gemini.ts` — `INSIGHT_SYSTEM_PROMPT` e `generateInsightWithGemini`**

Adicione ao final de `INSIGHT_SYSTEM_PROMPT`:

```
Ajuste o tom ao contexto do usuário fornecido (objetivo, barreira principal, modo suave). Se o contexto não trouxer "metas"/"consumido_hoje" (modo suave ativo), não mencione nenhum número de calorias/macros — foque em regularidade e presença de registro.
```

Troque `generateInsightWithGemini`:

```ts
async function generateInsightWithGemini(input: {
  periodType: string;
  locale: string;
  data: unknown;
  context: CoachContext;
}) {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: INSIGHT_SYSTEM_PROMPT,
    tools: [{ functionDeclarations: [insightFunctionDeclaration] }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: ["emit_insight"],
      },
    },
  });

  const result = await model.generateContent([
    `Contexto do usuário (JSON): ${JSON.stringify(input.context)}\n${coachContextToneInstruction(input.context)}\n\nLocale: ${input.locale}\nPeríodo: ${input.periodType}\nDados (JSON): ${JSON.stringify(input.data)}`,
  ]);
  // ... resto do corpo permanece idêntico (calls, parsed, usage, return)
```

Troque `geminiProvider.generateInsight`:

```ts
  async generateInsight(input) {
    return generateInsightWithGemini(input);
  },
```

(sem mudança de corpo — `input` já carrega `context` agora que a interface mudou na Task 6 Step 1; só confirme que o tipo bate).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/llm/provider.ts apps/server/src/services/llm/gemini.ts
git commit -m "feat(server): injeta CoachContext nos prompts de extração e insights (M18)"
```

---

## Task 7: `extraction.ts` — hash com contexto + wiring

**Files:**
- Modify: `apps/server/src/services/extraction.ts`

**Interfaces:**
- Consumes: `loadCoachContext` (Task 5), `LLMProvider.extractMeal` com `context` (Task 6).
- Produces: `hashContext(ctx: CoachContext): string` exportado — consumido pela Task 8 (`photo-extraction.ts`).

- [ ] **Step 1: Reescrever o arquivo**

```ts
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachContext, MealExtraction } from "@fitbrother/shared";
import { env } from "../lib/env.js";
import { supabaseService } from "../lib/supabase.js";
import { getLlmProvider } from "./llm/index.js";
import { assertWithinCap, recordUsage } from "./ai-usage.js";
import { loadCoachContext } from "./coach-context.js";

export type ExtractionResult = {
  output: MealExtraction;
  cacheHit: boolean;
  inputHash: string;
};

export function hashContext(ctx: CoachContext): string {
  return createHash("sha256").update(JSON.stringify(ctx)).digest("hex");
}

function hashInput(text: string, locale: string, contextHash: string): string {
  return createHash("sha256")
    .update(`${text}\x00${env.LLM_PROMPT_VERSION}\x00${locale}\x00${contextHash}`)
    .digest("hex");
}

export async function extractMeal(params: {
  userClient: SupabaseClient;
  userId: string;
  text: string;
  locale: string;
}): Promise<ExtractionResult> {
  const { userClient, userId, text, locale } = params;
  const context = await loadCoachContext(userClient, userId);
  const contextHash = hashContext(context);
  const inputHash = hashInput(text, locale, contextHash);

  // 1. Cache lookup — global (any user with the same text+context can hit it).
  const { data: cached, error: lookupErr } = await userClient
    .from("ai_extractions")
    .select("result_json")
    .eq("input_hash", inputHash)
    .maybeSingle();

  if (lookupErr) throw new Error(`extraction_cache_lookup_failed: ${lookupErr.message}`);

  if (cached) {
    await logExtractionHit(userId, inputHash, true);
    return {
      output: cached.result_json as MealExtraction,
      cacheHit: true,
      inputHash,
    };
  }

  // 2. Cache miss → cap check + provider call.
  await assertWithinCap(userClient, userId, "llm_tokens");

  const provider = getLlmProvider();
  const { output, usage } = await provider.extractMeal({ text, locale, context });

  // 3. Persist cache + hits + usage. Use service_role for writes because
  // these tables don't grant INSERT to authenticated users.
  const svc = supabaseService();
  const { error: insertErr } = await svc.from("ai_extractions").insert({
    input_hash: inputHash,
    result_json: output,
    model: provider.name === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini",
    prompt_version: env.LLM_PROMPT_VERSION,
    tokens_input: usage.inputTokens,
    tokens_output: usage.outputTokens,
    cost_cents: usage.costCents,
    confidence: output.confidence,
  });
  // Race: another concurrent request may have inserted the same hash. Treat
  // unique violation as success (we already have the data we need).
  if (insertErr && insertErr.code !== "23505") {
    throw new Error(`extraction_cache_insert_failed: ${insertErr.message}`);
  }

  await logExtractionHit(userId, inputHash, false);

  await recordUsage(userId, {
    llmInputTokens: usage.inputTokens,
    llmOutputTokens: usage.outputTokens,
    llmCostCents: usage.costCents,
  });

  return { output, cacheHit: false, inputHash };
}

async function logExtractionHit(
  userId: string,
  inputHash: string,
  wasCacheHit: boolean,
): Promise<void> {
  // service_role write — table has no INSERT policy for authenticated.
  const { error } = await supabaseService().from("ai_extraction_hits").insert({
    user_id: userId,
    input_hash: inputHash,
    was_cache_hit: wasCacheHit,
  });
  if (error) {
    // Logging failure must not break extraction — degrade silently.
    // eslint-disable-next-line no-console
    console.warn("[extraction] hit log failed:", error.message);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/extraction.ts
git commit -m "feat(server): hash de extração inclui o contexto do usuário (M18)"
```

---

## Task 8: `photo-extraction.ts` — mesmo tratamento

**Files:**
- Modify: `apps/server/src/services/photo-extraction.ts`

**Interfaces:**
- Consumes: `hashContext` (Task 7), `loadCoachContext` (Task 5), `extractMealImageWithGemini` com `context` (Task 6).

- [ ] **Step 1: Ler o arquivo atual inteiro antes de editar**

`apps/server/src/services/photo-extraction.ts` já foi lido nesta sessão —
confirme o conteúdo atual com `Read` antes de aplicar o diff abaixo, pra
garantir que nenhuma outra parte do arquivo mudou.

- [ ] **Step 2: Aplicar as mudanças**

No topo, adicione os imports novos:

```ts
import { hashContext } from "./extraction.js";
import { loadCoachContext } from "./coach-context.js";
```

Na função `extractMealFromPhoto`, logo após desestruturar `params` e antes
do download da imagem (ou logo após — a ordem entre "carregar contexto" e
"baixar imagem" não importa, ambos são independentes), adicione:

```ts
  const context = await loadCoachContext(userClient, userId);
```

Troque a linha do hash:

```ts
  const inputHash = createHash("sha256")
    .update(bytes)
    .update(`\x00photo\x00${env.LLM_PROMPT_VERSION}\x00${locale}\x00${hashContext(context)}`)
    .digest("hex");
```

Na chamada a `extractMealImageWithGemini`, adicione `context`:

```ts
  const { output, usage } = await extractMealImageWithGemini({
    base64: /* já existente */,
    mimeType: /* já existente */,
    locale,
    context,
  });
```

(mantenha os nomes exatos dos parâmetros já presentes no arquivo — só
acrescente `context` ao objeto passado; não invente nomes de variável
novos pra `base64`/`mimeType`, use os que já existem na função.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/photo-extraction.ts
git commit -m "feat(server): extração por foto também usa CoachContext no hash e no prompt (M18)"
```

---

## Task 9: `insights.ts` — carregar contexto por usuário + bump de `INSIGHT_PROMPT_VERSION`

**Files:**
- Modify: `apps/server/src/services/insights.ts`
- Modify: `packages/shared/src/prompt-version.ts`

**Interfaces:**
- Consumes: `loadCoachContext` (Task 5), `LLMProvider.generateInsight` com `context` (Task 6).

- [ ] **Step 1: `packages/shared/src/prompt-version.ts`**

```ts
// M18: prompt de insight passa a incluir CoachContext. Bump força
// regeneração de todo ai_insights existente.
export const INSIGHT_PROMPT_VERSION = "v2";
```

- [ ] **Step 2: `insights.ts` — dentro do loop de `targets`**

Logo antes da chamada a `getLlmProvider().generateInsight`, adicione:

```ts
    const context = await loadCoachContext(svc, t.user_id);
```

E troque a chamada existente:

```ts
      result = await getLlmProvider().generateInsight({
        periodType,
        locale,
        data: t.payload,
        context,
      });
```

Adicione o import no topo:

```ts
import { loadCoachContext } from "./coach-context.js";
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/insights.ts packages/shared/src/prompt-version.ts
git commit -m "feat(server): insights de período carregam CoachContext por usuário (M18)"
```

---

## Task 10: Verificação final + status no `PLAN.md`

**Files:**
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Typecheck + lint do monorepo inteiro**

Run: `npm run typecheck && npm run lint`
Expected: 0 erros, 0 warnings.

- [ ] **Step 2: Suíte completa de testes**

Run: `npm run test --workspaces --if-present`
Expected: todos os testes de `packages/shared` passam, incluindo os novos
de `coach/build-coach-context.test.ts`.

- [ ] **Step 3: Smoke test do hash de contexto (script standalone, não faz parte da suíte)**

Crie um script temporário confirmando que `hashContext` produz valores
diferentes pra contextos diferentes com o mesmo texto — evidência de que o
Task 7 realmente resolve o conflito de cache identificado no brainstorm:

```ts
// scratchpad, roda com `npx tsx` — não faz parte do repo permanente
import { hashContext } from "../apps/server/src/services/extraction.js";

const a = hashContext({ objetivo: "lose", restricoes: [], modo_suave: false });
const b = hashContext({ objetivo: "gain", restricoes: [], modo_suave: false });
console.log(a !== b ? "OK: hashes diferentes" : "FAIL: hashes iguais");
```

Run: `npx tsx <caminho-do-script>`
Expected: `OK: hashes diferentes`.

- [ ] **Step 4: Repetir o smoke test SQL da Task 3** contra um `supabase db reset` limpo, confirmando que nada quebrou depois das tasks seguintes.

- [ ] **Step 5: Atualizar `docs/PLAN.md`**

Marcar M18 como concluído na seção Fase 4, mesmo formato usado por
M14–M17.

- [ ] **Step 6: Commit**

```bash
git add docs/PLAN.md
git commit -m "docs: marca M18 (contexto para IA) como concluído"
```

---

## Self-Review

**Cobertura do spec:** §1 (`buildCoachContext`) → Task 1. §2
(`loadCoachContext`) → Task 5. §3 (migration `training_days_per_week`) →
Tasks 3, 4. §4 (hash com contexto) → Tasks 7, 8. §5 (`LLMProvider` +
`gemini.ts`) → Task 6. §6 (insights) → Task 9. §7 (testes) → Tasks 1, 10.
"Feito quando" → Task 10.

**Placeholder scan:** sem TBD/TODO. Task 8 pede "use os nomes que já
existem no arquivo" em vez de repetir o arquivo inteiro — isso não é um
placeholder de lógica, é porque este plano já tem o conteúdo integral do
arquivo lido durante o brainstorm (mostrado no histórico da sessão) e a
mudança é um diff pequeno e preciso sobre ele; repetir as ~120 linhas
inteiras do arquivo só pra trocar 3 blocos infla o plano sem ganho.

**Consistência de tipos:** `CoachContext`/`CoachContextInput` (Task 1)
usados identicamente em `loadCoachContext` (Task 5), `LLMProvider` (Task
6), `extraction.ts`/`photo-extraction.ts` (Tasks 7-8) e `insights.ts`
(Task 9). `hashContext` exportado na Task 7 com a assinatura exata que a
Task 8 importa. `loadCoachContext(client, userId)` usado com o `userClient`
autenticado (Tasks 7-8) e com `svc` (service-role, Task 9) — ambos
`SupabaseClient`, compatível com a assinatura da Task 5.
