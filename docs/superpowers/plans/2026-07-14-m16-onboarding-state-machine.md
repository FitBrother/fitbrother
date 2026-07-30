# M16 — Máquina de Estados do Onboarding + Paywall Placeholder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os 9 arquivos de rota fixa do onboarding por uma máquina de estados declarativa com resume real no servidor, cobrindo os 10 blocos novos do spec original (rotina, barreiras, alimentação, saúde, permissões, cálculo, revelação, paywall placeholder, primeira refeição) e ligando a flag `soft_mode` a uma experiência real de UI pela primeira vez.

**Architecture:** Tabela `onboarding_progress` (servidor) + array declarativo `ONBOARDING_BLOCKS` (mobile) dirigindo uma rota única `app/(onboarding)/[block].tsx`; cada bloco é um componente React independente que recebe `{ step, total, onNext, onBack, onSkip? }` do container; `PATCH`/`GET /onboarding/progress` persistem e retomam o progresso; `POST /onboarding/complete` (já existente) ganha campos novos e passa a apagar a linha de progresso e devolver `soft_mode`.

**Tech Stack:** Expo Router (rota dinâmica `[block].tsx`), Zustand (estado efêmero + snapshot pra resume), Fastify + Zod, Supabase Postgres (RLS `owner_all`), `@fitbrother/shared` (schemas + motor de metas do M15).

## Global Constraints

- Tipografia: `font-sans`/`font-sans-medium`/`font-sans-semibold`/`font-sans-bold`/`font-sans-extrabold` — nunca `font-medium`/`font-semibold`/`font-bold`.
- Números (kcal, gramas, contagens) sempre com `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores só via `@/lib/colors` ou classes Tailwind — nunca hex inline em JSX.
- Hit target mínimo 44×44 pt em todo `Pressable`.
- `accessibilityLabel` obrigatório em botões só-ícone; `accessibilityRole` em todo interativo.
- Sem `dark:` em código novo. Ícones só `lucide-react-native`. Sem `<div>`/`<h1>` — só `View`/`Text`/`Pressable`.
- RLS `owner_all` (`auth.uid() = user_id`, USING + WITH CHECK) em toda tabela nova com `user_id`.
- Migrations são imutáveis depois de merged — qualquer correção é uma migration nova.
- Sem dependência nova (nem Slider, nem lib de chips) — tudo reaproveita `WheelPicker`/`SegmentedControl`/padrão `Pressable` já usado em `step-5.tsx`/`step-6.tsx`.
- `apps/server` não tem Vitest (só `packages/shared` tem, decisão do M15) — verificação de rota/RPC é smoke test manual em transação `ROLLBACK` + teste HTTP real, não suite automatizada.

---

## Task 1: `OnboardingPayloadSchema` — campos novos

**Files:**
- Modify: `packages/shared/src/schemas.ts:279-303` (bloco `OnboardingPayloadSchema`)

**Interfaces:**
- Produces: `OnboardingPayload` ganha os campos abaixo (todos opcionais exceto `onboarding_context`, que tem default `{}`). Todo consumidor downstream (`buildTargetsInput`, `complete_onboarding_impl`) os lê por esses nomes exatos.

- [ ] **Step 1: Adicionar os campos ao schema**

Em `packages/shared/src/schemas.ts`, dentro de `OnboardingPayloadSchema` (logo depois de `consents: z.object({...})`, antes do `});` de fechamento):

```ts
  consents: z.object({
    terms: z.literal(true),
    privacy: z.literal(true),
    ai_processing: z.literal(true),
    policy_version: z.string().default("v1.0"),
  }),
  target_weight_kg: z.number().positive().max(500).optional(),
  rate_kg_per_week: z.number().positive().max(2).optional(),
  strength_training: z.boolean().optional(),
  is_pregnant_or_lactating: z.boolean().optional(),
  has_kidney_disease: z.boolean().optional(),
  has_type1_diabetes: z.boolean().optional(),
  uses_glp1: z.boolean().optional(),
  tca_screening_positive: z.boolean().optional(),
  onboarding_context: z.record(z.string(), z.unknown()).default({}),
});
```

(Substitua o `});` original — o novo bloco acima já inclui o fechamento certo.)

- [ ] **Step 2: Build do pacote e typecheck**

Run: `npm run build --workspace packages/shared && npm run typecheck --workspace packages/shared`
Expected: sem erros. Nenhum teste unitário dedicado a este schema hoje (validado end-to-end na Task 8).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat(shared): estende OnboardingPayloadSchema com campos do M16"
```

---

## Task 2: `buildTargetsInput` — mapeia os campos novos

**Files:**
- Modify: `apps/server/src/services/targets.ts`

**Interfaces:**
- Consumes: `OnboardingPayload` (Task 1), `TargetsInput` (já existe em `packages/shared/src/targets/types.ts`, todos os campos abaixo já fazem parte do tipo desde o M15).
- Produces: `buildTargetsInput(payload)` agora popula os 7 campos opcionais de cálculo — usado por `apps/server/src/routes/onboarding.ts` (Task 7).

- [ ] **Step 1: Estender `buildTargetsInput`**

Substitua o corpo da função em `apps/server/src/services/targets.ts`:

```ts
export function buildTargetsInput(payload: OnboardingPayload): TargetsInput {
  return {
    sex: payload.sex,
    age_years: ageYearsFromBirthDate(payload.birth_date),
    weight_kg: payload.weight_kg,
    height_cm: payload.height_cm,
    activity_level: payload.activity_level,
    goal: payload.goal,
    target_weight_kg: payload.target_weight_kg,
    rate_kg_per_week: payload.rate_kg_per_week,
    strength_training: payload.strength_training,
    is_pregnant_or_lactating: payload.is_pregnant_or_lactating,
    has_kidney_disease: payload.has_kidney_disease,
    has_type1_diabetes: payload.has_type1_diabetes,
    uses_glp1: payload.uses_glp1,
    tca_screening_positive: payload.tca_screening_positive,
  };
}
```

Atualize também o comentário acima da função (hoje diz "campos ainda sem UI... ficam undefined") — não é mais verdade:

```ts
/** Deriva o input do motor de cálculo a partir do payload de onboarding —
 * os campos opcionais (peso-alvo, ritmo, condições de saúde) vêm dos blocos
 * novos do M16; ficam undefined só se o usuário pulou o bloco. */
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/targets.ts
git commit -m "feat(server): buildTargetsInput mapeia os campos novos do M16"
```

---

## Task 3: Migration 0061 — tabela `onboarding_progress`

**Files:**
- Create: `supabase/migrations/0061_onboarding_progress.sql`

**Interfaces:**
- Produces: tabela `public.onboarding_progress(user_id uuid PK, current_block text, answers jsonb, updated_at timestamptz)`, consumida pela Task 7 (rota) e Task 6 (DELETE no `complete_onboarding_impl`).

- [ ] **Step 1: Escrever a migration**

```sql
-- M16: persistência de progresso do onboarding, pra resume real no servidor
-- (fechar o app e reabrir retoma exatamente no bloco em que parou).
CREATE TABLE public.onboarding_progress (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_block text NOT NULL,
  answers       jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON public.onboarding_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar e verificar**

Run: `supabase db reset`
Expected: migration aplica sem erro; `\d public.onboarding_progress` no `supabase db` mostra a tabela com RLS habilitado.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0061_onboarding_progress.sql
git commit -m "feat(db): tabela onboarding_progress pra resume do onboarding (M16)"
```

---

## Task 4: Migration 0062 — flags de saúde em `anthropometrics`

**Files:**
- Create: `supabase/migrations/0062_anthropometrics_health_flags.sql`

**Interfaces:**
- Produces: 6 colunas nullable em `public.anthropometrics`, consumidas pela Task 6 (INSERT no `complete_onboarding_impl`).

- [ ] **Step 1: Escrever a migration**

```sql
-- M16: condições de saúde que já são input do motor de cálculo desde o M15
-- (TargetsInput) mas não tinham onde persistir. anthropometrics já é a
-- tabela versionada de "insumos do cálculo" (ganhou target_weight_kg/
-- rate_kg_per_week no M15) — essas colunas completam o TargetsInput ali,
-- prontas pra um recálculo futuro (M17) reler sem re-perguntar.
ALTER TABLE public.anthropometrics
  ADD COLUMN strength_training         boolean,
  ADD COLUMN is_pregnant_or_lactating  boolean,
  ADD COLUMN has_kidney_disease        boolean,
  ADD COLUMN has_type1_diabetes        boolean,
  ADD COLUMN uses_glp1                 boolean,
  ADD COLUMN tca_screening_positive    boolean;
```

- [ ] **Step 2: Aplicar**

Run: `supabase db reset`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0062_anthropometrics_health_flags.sql
git commit -m "feat(db): flags de saúde em anthropometrics (M16)"
```

---

## Task 5: Migration 0063 — `profiles.onboarding_context`

**Files:**
- Create: `supabase/migrations/0063_profiles_onboarding_context.sql`

**Interfaces:**
- Produces: coluna `public.profiles.onboarding_context jsonb NOT NULL DEFAULT '{}'`, consumida pela Task 6.

- [ ] **Step 1: Escrever a migration**

```sql
-- M16: contexto de estilo de vida (rotina, barreiras, alimentação) coletado
-- no onboarding novo mas sem consumidor ainda — o M18 (contexto pra IA) vai
-- ler esse blob. Um jsonb só, sem colunas por campo: nenhuma dessas chaves
-- precisa ser filtrável em SQL, só lida de volta como blob pelo prompt.
ALTER TABLE public.profiles
  ADD COLUMN onboarding_context jsonb NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Aplicar**

Run: `supabase db reset`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0063_profiles_onboarding_context.sql
git commit -m "feat(db): profiles.onboarding_context pro M18 ler depois (M16)"
```

---

## Task 6: Migration 0064 — `complete_onboarding_impl` v3

**Files:**
- Create: `supabase/migrations/0064_complete_onboarding_v3.sql`
- Reference: `supabase/migrations/0060_complete_onboarding_v2.sql` (versão atual completa, não editar — só `CREATE OR REPLACE` na nova migration)

**Interfaces:**
- Consumes: `payload.strength_training`, `payload.is_pregnant_or_lactating`, `payload.has_kidney_disease`, `payload.has_type1_diabetes`, `payload.uses_glp1`, `payload.tca_screening_positive`, `payload.onboarding_context`, `payload.soft_mode` (este último setado pela rota na Task 7, não pelo client).
- Produces: `complete_onboarding_impl` grava tudo isso + apaga `onboarding_progress` do usuário + devolve `soft_mode` no jsonb de retorno (consumido pela Task 7).

- [ ] **Step 1: Escrever a migration**

`CREATE OR REPLACE` inteiro da função, preservando 100% do que a 0060 já faz (profiles/profiles_private/anthropometrics/nutrition_goals/subscriptions/consent_log) e adicionando o novo:

```sql
-- M16: complete_onboarding_impl ganha os campos novos do onboarding renovado
-- (flags de saúde em anthropometrics, onboarding_context e soft_mode em
-- profiles) e passa a apagar onboarding_progress no final — a partir daqui
-- a conta existe, não há mais o que retomar. Preserva integralmente o que
-- 0060 (M15, targets computados em TS), 0038 (username/avatar_url +
-- phone_e164 em profiles_private) e 0024 (effective_from pelo dia
-- nutricional) já corrigiam.
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
  --    flags de saúde e peso-alvo/ritmo vêm do payload — M16) -------------
  INSERT INTO public.anthropometrics (
    user_id, weight_kg, height_cm, bmr_kcal, tdee_kcal,
    target_weight_kg, rate_kg_per_week,
    strength_training, is_pregnant_or_lactating, has_kidney_disease,
    has_type1_diabetes, uses_glp1, tca_screening_positive
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
    (payload->>'tca_screening_positive')::boolean
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

- [ ] **Step 2: Aplicar**

Run: `supabase db reset`
Expected: sem erro.

- [ ] **Step 3: Smoke test SQL em transação (rollback)**

Crie `/tmp/claude-1000/-home-pedrobritto-development-fitbrother/665a628a-30e0-4e42-9eda-0c2f94d021e8/scratchpad/m16-smoke-test.sql`:

```sql
BEGIN;

DO $$
DECLARE
  u uuid := gen_random_uuid();
  result jsonb;
  anthro record;
  prof record;
BEGIN
  INSERT INTO auth.users (id) VALUES (u);
  INSERT INTO public.onboarding_progress (user_id, current_block, answers)
  VALUES (u, 'consent', '{"full_name":"Teste M16"}'::jsonb);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  result := public.complete_onboarding(jsonb_build_object(
    'full_name', 'Teste M16',
    'birth_date', '1994-01-01',
    'sex', 'female',
    'weight_kg', 78,
    'height_cm', 165,
    'activity_level', 'light',
    'goal', 'lose',
    'timezone', 'America/Sao_Paulo',
    'day_start_hour', 0,
    'locale', 'pt-BR',
    'target_weight_kg', 68,
    'rate_kg_per_week', 0.5,
    'strength_training', true,
    'tca_screening_positive', true,
    'onboarding_context', jsonb_build_object('main_barriers', jsonb_build_array('falta_de_tempo')),
    'soft_mode', true,
    'consents', jsonb_build_object('terms', true, 'privacy', true, 'ai_processing', true, 'policy_version', 'v1.0'),
    'targets', jsonb_build_object(
      'bmr_kcal', 1490.25, 'tdee_kcal', 2049.09, 'tdee_source', 'declared',
      'kcal', 1536.82, 'protein_g', 140.4, 'carbs_g', 138.51, 'fat_g', 46.8,
      'fiber_g', 21.52, 'warnings', '[]'::jsonb, 'blocked', false
    )
  ));

  RESET ROLE;
  RAISE NOTICE 'RPC result: %', result;

  SELECT * INTO anthro FROM public.anthropometrics WHERE user_id = u;
  IF anthro.strength_training IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'check_FAIL: strength_training = %, esperado true', anthro.strength_training;
  END IF;
  IF anthro.tca_screening_positive IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'check_FAIL: tca_screening_positive = %, esperado true', anthro.tca_screening_positive;
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE user_id = u;
  IF prof.soft_mode IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'check_FAIL: soft_mode = %, esperado true', prof.soft_mode;
  END IF;
  IF (prof.onboarding_context->'main_barriers'->>0) IS DISTINCT FROM 'falta_de_tempo' THEN
    RAISE EXCEPTION 'check_FAIL: onboarding_context não persistiu corretamente: %', prof.onboarding_context;
  END IF;

  IF EXISTS (SELECT 1 FROM public.onboarding_progress WHERE user_id = u) THEN
    RAISE EXCEPTION 'check_FAIL: onboarding_progress deveria ter sido apagado';
  END IF;

  IF (result->>'soft_mode')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'check_FAIL: RPC não devolveu soft_mode=true no retorno';
  END IF;

  RAISE NOTICE 'ALL CHECKS PASSED';
END $$;

ROLLBACK;
```

Run: `supabase db execute --file /tmp/claude-1000/-home-pedrobritto-development-fitbrother/665a628a-30e0-4e42-9eda-0c2f94d021e8/scratchpad/m16-smoke-test.sql` (ou `psql` direto na connection string local do `supabase status`)
Expected: `NOTICE: ALL CHECKS PASSED`, sem exceção.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0064_complete_onboarding_v3.sql
git commit -m "feat(db): complete_onboarding_impl persiste campos do M16 e apaga onboarding_progress"
```

---

## Task 7: Rota `PATCH`/`GET /onboarding/progress` + `soft_mode` em `POST /onboarding/complete`

**Files:**
- Modify: `apps/server/src/routes/onboarding.ts`

**Interfaces:**
- Consumes: `evaluateSafetyGates` (já exportado por `apps/server/src/services/targets.ts`), `buildTargetsInput` (Task 2).
- Produces: `GET /onboarding/progress` → `{ progress: { current_block: string, answers: Record<string, unknown>, updated_at: string } | null }`. `PATCH /onboarding/progress` → 204. Resposta de `POST /onboarding/complete` ganha `soft_mode: boolean` (lido de `data.soft_mode`, já devolvido pela RPC na Task 6).

- [ ] **Step 1: Reescrever o arquivo**

```ts
import { OnboardingPayloadSchema } from "@fitbrother/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { buildTargetsInput, computeTargets, evaluateSafetyGates } from "../services/targets.js";

const PatchOnboardingProgressRequestSchema = z.object({
  current_block: z.string().min(1).max(50),
  answers: z.record(z.string(), z.unknown()),
});

export async function onboardingRoutes(app: FastifyInstance) {
  app.post("/onboarding/complete", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = OnboardingPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_payload",
        issues: parsed.error.issues,
      });
    }

    const targetsInput = buildTargetsInput(parsed.data);
    const targets = computeTargets(targetsInput);
    const gates = evaluateSafetyGates(targetsInput);
    const soft_mode = gates.some((g) => g.severity === "SOFT_MODE");

    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase.rpc("complete_onboarding", {
      payload: { ...parsed.data, targets, soft_mode },
    });

    if (error) {
      req.log.error({ err: error }, "onboarding_rpc_failed");
      return reply.code(error.code === "23505" ? 409 : 500).send({ error: error.message });
    }

    return reply.code(201).send(data);
  });

  app.get("/onboarding/progress", { preHandler: [authRequired] }, async (req, reply) => {
    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("onboarding_progress")
      .select("current_block, answers, updated_at")
      .maybeSingle();

    if (error) {
      req.log.error({ err: error }, "onboarding_progress_get_failed");
      return reply.code(500).send({ error: error.message });
    }

    return reply.send({ progress: data ?? null });
  });

  app.patch("/onboarding/progress", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = PatchOnboardingProgressRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_payload",
        issues: parsed.error.issues,
      });
    }

    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);
    const { error } = await supabase.from("onboarding_progress").upsert(
      {
        user_id: userId,
        current_block: parsed.data.current_block,
        answers: parsed.data.answers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      req.log.error({ err: error }, "onboarding_progress_patch_failed");
      return reply.code(500).send({ error: error.message });
    }

    return reply.code(204).send();
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 3: Smoke test HTTP real**

Suba o servidor local (`npm run build --workspace packages/shared && npm run dev:server`), crie um usuário real via Supabase Auth (mesmo padrão usado no M15 — signup real + pegar o JWT da sessão), então:

```bash
# 1. PATCH salva progresso
curl -s -X PATCH http://localhost:3000/onboarding/progress \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"current_block":"goal","answers":{"full_name":"Teste HTTP","sex":"male"}}' -w '\n%{http_code}\n'
# Expected: corpo vazio, código 204

# 2. GET retoma
curl -s http://localhost:3000/onboarding/progress -H "Authorization: Bearer $JWT"
# Expected: {"progress":{"current_block":"goal","answers":{"full_name":"Teste HTTP","sex":"male"},"updated_at":"..."}}

# 3. POST complete (payload mínimo válido) apaga a linha
curl -s -X POST http://localhost:3000/onboarding/complete \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"full_name":"Teste HTTP","birth_date":"1994-01-01","sex":"male","weight_kg":80,"height_cm":178,"activity_level":"moderate","goal":"maintain","timezone":"America/Sao_Paulo","day_start_hour":0,"consents":{"terms":true,"privacy":true,"ai_processing":true}}'
# Expected: 201, corpo inclui "soft_mode":false (goal=maintain, sem gates disparando)

# 4. GET de novo confirma que sumiu
curl -s http://localhost:3000/onboarding/progress -H "Authorization: Bearer $JWT"
# Expected: {"progress":null}
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/onboarding.ts
git commit -m "feat(server): PATCH/GET /onboarding/progress + soft_mode no complete (M16)"
```

---

## Task 8: Mobile — cliente HTTP + tipo `Profile.soft_mode`

**Files:**
- Modify: `apps/mobile/lib/api.ts`
- Modify: `apps/mobile/lib/profile/types.ts`

**Interfaces:**
- Produces: `getOnboardingProgress(): Promise<{ current_block: string; answers: Record<string, unknown> } | null>`, `patchOnboardingProgress(body: { current_block: string; answers: Record<string, unknown> }): Promise<void>` — consumidos pela Task 19 (gate + engine). `Profile.soft_mode: boolean` — consumido pela Task 20.

- [ ] **Step 1: Adicionar as funções em `lib/api.ts`**

Logo abaixo de `postOnboarding` (que já existe, ~linha 50-63):

```ts
export async function getOnboardingProgress(): Promise<{
  current_block: string;
  answers: Record<string, unknown>;
} | null> {
  const res = await authedFetch("/onboarding/progress");
  if (!res.ok) throw new Error(`onboarding_progress_get_failed_${res.status}`);
  const body = (await res.json()) as {
    progress: { current_block: string; answers: Record<string, unknown> } | null;
  };
  return body.progress;
}

export async function patchOnboardingProgress(body: {
  current_block: string;
  answers: Record<string, unknown>;
}): Promise<void> {
  const res = await authedFetch("/onboarding/progress", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`onboarding_progress_patch_failed_${res.status}`);
}
```

- [ ] **Step 2: Tipar `soft_mode` em `Profile`**

Em `apps/mobile/lib/profile/types.ts`:

```ts
export type Profile = {
  id: string;
  full_name: string;
  timezone: string;
  day_start_hour: number;
  locale: string;
  created_at: string;
  soft_mode: boolean;
  [k: string]: unknown;
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/api.ts apps/mobile/lib/profile/types.ts
git commit -m "feat(mobile): cliente HTTP de onboarding/progress + Profile.soft_mode (M16)"
```

---

## Task 9: Mobile — tipos do engine + extensão do `useOnboardingStore`

**Files:**
- Create: `apps/mobile/lib/onboarding/types.ts`
- Modify: `apps/mobile/lib/stores/onboardingStore.ts`

**Interfaces:**
- Produces: `OnboardingBlockProps`, `OnboardingBlockDef` (consumidos por toda `Component` das Tasks 10-18 e pelo array da Task 19). `useOnboardingStore` ganha os campos novos + `toAnswers()`/`hydrate()` (consumidos pela Task 19).

- [ ] **Step 1: Criar `lib/onboarding/types.ts`**

```ts
import type { ComponentType } from "react";

export type OnboardingBlockProps = {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
};

export type OnboardingBlockDef = {
  id: string;
  Component: ComponentType<OnboardingBlockProps>;
  skippable?: boolean;
};
```

- [ ] **Step 2: Estender o store**

Em `apps/mobile/lib/stores/onboardingStore.ts`, adicione ao `OnboardingState` (depois de `consents`):

```ts
  target_weight_kg: number | undefined;
  rate_kg_per_week: number | undefined;
  strength_training: boolean;
  main_barriers: string[];
  dietary_restrictions: string[];
  disliked_foods: string;
  budget: string | undefined;
  meal_times: string;
  cooks_own_food: string | undefined;
  eats_out_frequency: string | undefined;
  is_pregnant_or_lactating: boolean;
  has_kidney_disease: boolean;
  has_type1_diabetes: boolean;
  uses_glp1: boolean;
  tca_screening_positive: boolean;
```

E aos métodos da interface:

```ts
  toAnswers: () => Record<string, unknown>;
  hydrate: (answers: Record<string, unknown>) => void;
```

No `INITIAL`:

```ts
  target_weight_kg: undefined,
  rate_kg_per_week: undefined,
  strength_training: false,
  main_barriers: [],
  dietary_restrictions: [],
  disliked_foods: "",
  budget: undefined,
  meal_times: "",
  cooks_own_food: undefined,
  eats_out_frequency: undefined,
  is_pregnant_or_lactating: false,
  has_kidney_disease: false,
  has_type1_diabetes: false,
  uses_glp1: false,
  tca_screening_positive: false,
```

E na store, depois de `toPayload`:

```ts
  toAnswers: () => {
    const { setField, setConsent, reset, toPayload, hydrate, toAnswers, ...rest } = get();
    return rest;
  },

  hydrate: (answers) => set(answers as Partial<OnboardingState>),
```

Por fim, estenda o objeto retornado por `toPayload()` (já existe, não remova nada) acrescentando antes do `};` final:

```ts
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      strength_training: s.strength_training,
      is_pregnant_or_lactating: s.is_pregnant_or_lactating,
      has_kidney_disease: s.has_kidney_disease,
      has_type1_diabetes: s.has_type1_diabetes,
      uses_glp1: s.uses_glp1,
      tca_screening_positive: s.tca_screening_positive,
      onboarding_context: {
        main_barriers: s.main_barriers,
        dietary_restrictions: s.dietary_restrictions,
        disliked_foods: s.disliked_foods,
        budget: s.budget,
        meal_times: s.meal_times,
        cooks_own_food: s.cooks_own_food,
        eats_out_frequency: s.eats_out_frequency,
      },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros. (`OnboardingPayload` já aceita todos esses campos desde a Task 1.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/onboarding/types.ts apps/mobile/lib/stores/onboardingStore.ts
git commit -m "feat(mobile): tipos do engine de blocos + campos novos no onboardingStore (M16)"
```

---

## Task 10: Blocos migrados — `name`, `basics`, `height`, `weight`, `activity`

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/NameBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/BasicsBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/HeightBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/WeightBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/ActivityBlock.tsx`
- Reference (não editar ainda — apagados na Task 19): `apps/mobile/app/(onboarding)/index.tsx`, `step-2.tsx`, `step-3.tsx`, `step-4.tsx`, `step-5.tsx`

**Interfaces:**
- Consumes: `OnboardingBlockProps` (Task 9).
- Produces: 5 componentes, consumidos pelo array `ONBOARDING_BLOCKS` (Task 19).

Migração mecânica — mesmo conteúdo de cada `step-N.tsx` atual, só trocando `step={N}`/`total={ONBOARDING_STEPS}` fixos pelos props `step`/`total`, e `router.push`/`router.replace` fixos pelos props `onNext`/`onBack`.

- [ ] **Step 1: `NameBlock.tsx`** (conteúdo de `index.tsx`, sem o `onBack` pro welcome — isso passa a ser responsabilidade do container, Task 19)

```tsx
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function NameBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const full_name = useOnboardingStore((s) => s.full_name);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Como podemos te chamar?"
      subtitle="Seu nome aparece nas conquistas e nas conversas com o bot."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={full_name.trim().length < 2}
    >
      <Input
        label="Nome"
        value={full_name}
        onChangeText={(v) => setField("full_name", v)}
        placeholder="Seu nome"
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="givenName"
        returnKeyType="done"
        maxLength={80}
      />
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 2: `BasicsBlock.tsx`** (conteúdo de `step-2.tsx`, mesma lógica)

```tsx
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Pressable, Text, View } from "react-native";
import { DateInput } from "@/components/DateInput";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { validateBirthDate } from "@/lib/masks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const SEX_VALUES = ["female", "male", "other"] as const;
const SEX_LABELS = ["Feminino", "Masculino", "Outro"];

export function BasicsBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const sex = useOnboardingStore((s) => s.sex);
  const birth_date = useOnboardingStore((s) => s.birth_date);
  const setField = useOnboardingStore((s) => s.setField);

  const dateIsComplete = birth_date.length === 10;
  const dateValidationError = dateIsComplete ? validateBirthDate(birth_date) : null;
  const dateValid = dateIsComplete && dateValidationError === null;
  const selectedIndex = sex ? SEX_VALUES.indexOf(sex) : -1;

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Conta um pouco sobre você"
      subtitle="Sexo biológico e data de nascimento — calculamos o gasto calórico com eles."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!sex || !dateValid}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Sexo biológico</Text>
          <SegmentedControl
            values={SEX_LABELS}
            selectedIndex={selectedIndex}
            onChange={(e) => {
              const i = e.nativeEvent.selectedSegmentIndex;
              setField("sex", SEX_VALUES[i]);
            }}
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            fontStyle={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#64748b" }}
            activeFontStyle={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#04100c" }}
            style={{ height: 40 }}
          />
          {sex !== undefined && (
            <Pressable
              onPress={() => setField("sex", undefined)}
              accessibilityRole="button"
              accessibilityLabel="Limpar seleção de sexo"
            >
              <Text className="mt-1 text-xs font-sans text-neutral-500">Limpar seleção</Text>
            </Pressable>
          )}
        </View>

        <DateInput
          label="Data de nascimento"
          value={birth_date}
          onChangeText={(v) => setField("birth_date", v)}
          error={dateValidationError ?? undefined}
        />
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 3: `HeightBlock.tsx`** (conteúdo de `step-3.tsx`)

```tsx
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const DEFAULT_HEIGHT = 170;

export function HeightBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const height_cm = useOnboardingStore((s) => s.height_cm);
  const setField = useOnboardingStore((s) => s.setField);
  const selectedHeight = height_cm ?? DEFAULT_HEIGHT;

  useEffect(() => {
    if (height_cm === undefined) setField("height_cm", DEFAULT_HEIGHT);
  }, [height_cm, setField]);

  function handleNext() {
    if (height_cm === undefined) setField("height_cm", DEFAULT_HEIGHT);
    onNext();
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Qual sua altura?"
      subtitle="Em centímetros."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
      <View className="flex-1 items-center justify-center">
        <WheelPicker
          min={120}
          max={220}
          step={1}
          value={selectedHeight}
          unit="cm"
          onChange={(v) => setField("height_cm", v)}
        />
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 4: `WeightBlock.tsx`** (conteúdo de `step-4.tsx`, mesmo padrão do Step 3)

```tsx
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const DEFAULT_WEIGHT = 70;

export function WeightBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const weight_kg = useOnboardingStore((s) => s.weight_kg);
  const setField = useOnboardingStore((s) => s.setField);
  const selectedWeight = weight_kg ?? DEFAULT_WEIGHT;

  useEffect(() => {
    if (weight_kg === undefined) setField("weight_kg", DEFAULT_WEIGHT);
  }, [weight_kg, setField]);

  function handleNext() {
    if (weight_kg === undefined) setField("weight_kg", DEFAULT_WEIGHT);
    onNext();
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="E seu peso atual?"
      subtitle="Em quilos. Você pode atualizar isso a qualquer momento."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
      <View className="flex-1 items-center justify-center">
        <WheelPicker
          min={30}
          max={200}
          step={0.5}
          value={selectedWeight}
          unit="kg"
          onChange={(v) => setField("weight_kg", v)}
        />
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 5: `ActivityBlock.tsx`** (conteúdo de `step-5.tsx`)

```tsx
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const OPTIONS = [
  { value: "sedentary", title: "Sedentário", desc: "Pouca ou nenhuma atividade física." },
  { value: "light", title: "Leve", desc: "Caminhadas, 1-3 treinos por semana." },
  { value: "moderate", title: "Moderado", desc: "3-5 treinos por semana." },
  {
    value: "active",
    title: "Ativo",
    desc: "6-7 treinos por semana ou trabalho fisicamente exigente.",
  },
  {
    value: "very_active",
    title: "Muito ativo",
    desc: "Treinos intensos diários ou trabalho braçal pesado.",
  },
] as const;

export function ActivityBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const activity_level = useOnboardingStore((s) => s.activity_level);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Qual seu nível de atividade?"
      subtitle="Isso ajusta o gasto calórico diário (TDEE)."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!activity_level}
    >
      <View accessibilityRole="radiogroup" className="gap-2">
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.selectionAsync();
              setField("activity_level", opt.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: activity_level === opt.value }}
            className={`min-h-[64px] rounded-xl border p-3 ${
              activity_level === opt.value
                ? "border-[1.5px] border-primary-400 bg-primary-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <Text className="text-base font-sans-semibold text-neutral-800">{opt.title}</Text>
            <Text className="text-sm font-sans text-neutral-600">{opt.desc}</Text>
          </Pressable>
        ))}
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros (os arquivos `step-N.tsx` originais ainda existem e ainda compilam — serão apagados só na Task 19).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/NameBlock.tsx apps/mobile/components/onboarding/blocks/BasicsBlock.tsx apps/mobile/components/onboarding/blocks/HeightBlock.tsx apps/mobile/components/onboarding/blocks/WeightBlock.tsx apps/mobile/components/onboarding/blocks/ActivityBlock.tsx
git commit -m "feat(mobile): migra blocos name/basics/height/weight/activity pro engine (M16)"
```

---

## Task 11: Blocos migrados — `contact`, `identity`, `consent`

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/ContactBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/IdentityBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/ConsentBlock.tsx`
- Reference: `apps/mobile/app/(onboarding)/step-7.tsx`, `step-9.tsx`, `step-8.tsx`

**Interfaces:**
- Consumes: `OnboardingBlockProps` (Task 9).
- Produces: 3 componentes pro array da Task 19. `ConsentBlock` NÃO chama mais `postOnboarding` — só marca os 3 consentimentos e avança pro bloco `calculating` via `onNext` (quem chama `postOnboarding` agora é o `CalculatingBlock`, Task 17).

- [ ] **Step 1: `ContactBlock.tsx`** (conteúdo de `step-7.tsx`, idêntico)

```tsx
import { Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { isValidPhone, PhoneInput } from "@/components/PhoneInput";
import { clampHour } from "@/lib/masks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function ContactBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const phone_e164 = useOnboardingStore((s) => s.phone_e164);
  const timezone = useOnboardingStore((s) => s.timezone);
  const day_start_hour = useOnboardingStore((s) => s.day_start_hour);
  const setField = useOnboardingStore((s) => s.setField);
  const phoneValid = isValidPhone(phone_e164);

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Quase lá"
      subtitle="Telefone é opcional — usado depois pra ativar o registro via WhatsApp."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!phoneValid}
    >
      <View className="gap-3">
        <PhoneInput
          label="WhatsApp (opcional)"
          value={phone_e164}
          onChangeText={(v) => setField("phone_e164", v)}
          error={phoneValid ? undefined : "Número inválido"}
        />

        <View className="rounded-xl border border-neutral-200 bg-white p-4">
          <Text className="text-sm font-sans-medium text-neutral-700">Fuso horário detectado</Text>
          <Text className="mt-1 text-base font-sans text-neutral-800">{timezone}</Text>
        </View>

        <Input
          label="A que horas seu dia nutricional vira? (0-23)"
          value={String(day_start_hour)}
          onChangeText={(v) => setField("day_start_hour", clampHour(v))}
          keyboardType="number-pad"
          placeholder="0"
          maxLength={2}
        />
        <Text className="text-xs font-sans text-neutral-500">
          Refeições antes desse horário contam para o dia anterior — útil pra quem come tarde.
        </Text>
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 2: `IdentityBlock.tsx`** (conteúdo de `step-9.tsx`, idêntico)

```tsx
import * as ImagePicker from "expo-image-picker";
import { Camera, CheckCircle2, UserCircle2 } from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { colors } from "@/lib/colors";
import { useUsernameAvailable, USERNAME_RE } from "@/lib/hooks/useUsernameAvailable";
import { supabase } from "@/lib/supabase";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function IdentityBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const username = useOnboardingStore((s) => s.username);
  const avatarUrl = useOnboardingStore((s) => s.avatar_url);
  const setField = useOnboardingStore((s) => s.setField);
  const [touched, setTouched] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const normalized = username.trim().toLowerCase();
  const formatOk = USERNAME_RE.test(normalized);
  const { data: available, isFetching } = useUsernameAvailable(normalized);
  const canContinue = formatOk && available === true;

  async function handleAvatar() {
    setUploading(true);
    setAvatarError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      setAvatarPreview(result.assets[0].uri);

      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id;
      if (!userId) throw new Error("not_authenticated");

      const file = await fetch(result.assets[0].uri).then((r) => r.blob());
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage.from("post-images").upload(path, file, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw error;
      setField("avatar_url", path);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Não foi possível salvar o avatar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Escolha seu @username"
      subtitle="É assim que outras pessoas vão te encontrar no Fitbrother."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!canContinue}
    >
      <View className="gap-6">
        <View className="items-center gap-3">
          <Pressable
            onPress={handleAvatar}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Escolher avatar"
            className="min-h-[112px] min-w-[112px] items-center justify-center rounded-full border border-neutral-200 bg-white"
          >
            {avatarPreview ? (
              <Image source={{ uri: avatarPreview }} className="h-28 w-28 rounded-full" />
            ) : (
              <UserCircle2 size={56} color={colors.neutral[400]} />
            )}
            <View className="absolute bottom-1 right-1 h-9 w-9 items-center justify-center rounded-full bg-primary-400">
              <Camera size={18} color={colors.neutral[50]} />
            </View>
          </Pressable>
          <Text className="text-sm font-sans text-neutral-500">
            {avatarUrl ? "Avatar salvo" : uploading ? "Enviando avatar..." : "Avatar opcional"}
          </Text>
          {avatarError ? (
            <Text className="text-center text-sm font-sans text-danger-500">{avatarError}</Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Input
            label="Username"
            value={username}
            onChangeText={(text) => {
              setField("username", text.toLowerCase());
              setTouched(true);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ex: maria.silva"
          />
          {touched && !formatOk ? (
            <Text className="text-sm font-sans text-danger-500">
              Use 3-20 caracteres: letras minúsculas, números, ponto ou _.
            </Text>
          ) : null}
          {formatOk && isFetching ? (
            <Text className="text-sm font-sans text-neutral-500">Verificando...</Text>
          ) : null}
          {formatOk && !isFetching && available === false ? (
            <Text className="text-sm font-sans text-danger-500">Esse username já está em uso.</Text>
          ) : null}
          {formatOk && available === true ? (
            <View className="flex-row items-center gap-2">
              <CheckCircle2 size={16} color={colors.success[500]} />
              <Text className="text-sm font-sans text-success-500">Disponível</Text>
            </View>
          ) : null}
        </View>

        <Button label="Continuar" variant="primary" disabled={!canContinue} onPress={onNext} />
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 3: `ConsentBlock.tsx`** (conteúdo de `step-8.tsx`, SEM chamar `postOnboarding` — só avança)

```tsx
import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const CONSENTS = [
  { key: "terms" as const, label: "Aceito os Termos de uso" },
  { key: "privacy" as const, label: "Aceito a Política de privacidade" },
  {
    key: "ai_processing" as const,
    label: "Autorizo o processamento dos meus dados por IA para extrair refeições",
  },
];

export function ConsentBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const consents = useOnboardingStore((s) => s.consents);
  const setConsent = useOnboardingStore((s) => s.setConsent);
  const allConsents = consents.terms && consents.privacy && consents.ai_processing;

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Antes de continuar"
      subtitle="Precisamos do seu consentimento para guardar e processar seus dados."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!allConsents}
    >
      <View className="gap-3">
        {CONSENTS.map((c) => {
          const checked = consents[c.key];
          return (
            <Pressable
              key={c.key}
              onPress={() => setConsent(c.key, !checked)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-md border ${
                  checked ? "border-primary-400 bg-primary-400" : "border-neutral-300 bg-white"
                }`}
              >
                {checked && <Check size={16} color="#ffffff" />}
              </View>
              <Text className="flex-1 text-sm font-sans text-neutral-800">{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/ContactBlock.tsx apps/mobile/components/onboarding/blocks/IdentityBlock.tsx apps/mobile/components/onboarding/blocks/ConsentBlock.tsx
git commit -m "feat(mobile): migra blocos contact/identity/consent pro engine (M16)"
```

---

## Task 12: Bloco `goal` — extensão com peso-alvo, ritmo e preview em tempo real

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/GoalBlock.tsx`
- Create: `apps/mobile/lib/onboarding/projectGoalDate.ts`

**Interfaces:**
- Consumes: `computeTargets` (de `@fitbrother/shared`, já usado como tipo no mobile — agora também como função), `OnboardingBlockProps`.
- Produces: `projectGoalDate(currentWeightKg, targetWeightKg, rateKgPerWeek, from?: Date): Date | null` — usado só por este bloco.

- [ ] **Step 1: `projectGoalDate.ts`**

```ts
/** Data projetada pra atingir o peso-alvo no ritmo escolhido. `null` se o
 * ritmo for zero ou a diferença de peso for zero (nada a projetar). */
export function projectGoalDate(
  currentWeightKg: number,
  targetWeightKg: number,
  rateKgPerWeek: number,
  from: Date,
): Date | null {
  const diffKg = Math.abs(currentWeightKg - targetWeightKg);
  if (diffKg === 0 || rateKgPerWeek <= 0) return null;
  const weeks = diffKg / rateKgPerWeek;
  const result = new Date(from);
  result.setDate(result.getDate() + Math.round(weeks * 7));
  return result;
}
```

- [ ] **Step 2: `GoalBlock.tsx`**

```tsx
import { computeTargets } from "@fitbrother/shared";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { projectGoalDate } from "@/lib/onboarding/projectGoalDate";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const OPTIONS = [
  { value: "lose", title: "Perder gordura", desc: "Déficit calórico de 20%." },
  { value: "maintain", title: "Manter peso", desc: "Calorias = TDEE." },
  { value: "gain", title: "Ganhar massa", desc: "Superávit calórico de 10%." },
  { value: "recomp", title: "Recomposição", desc: "Pequeno déficit (5%) com proteína alta." },
] as const;

const DEFAULT_RATE_PCT: Record<"lose" | "gain", number> = { lose: 0.625, gain: 0.375 };

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function GoalBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const goal = useOnboardingStore((s) => s.goal);
  const weight_kg = useOnboardingStore((s) => s.weight_kg);
  const height_cm = useOnboardingStore((s) => s.height_cm);
  const sex = useOnboardingStore((s) => s.sex);
  const activity_level = useOnboardingStore((s) => s.activity_level);
  const target_weight_kg = useOnboardingStore((s) => s.target_weight_kg);
  const rate_kg_per_week = useOnboardingStore((s) => s.rate_kg_per_week);
  const setField = useOnboardingStore((s) => s.setField);

  const showRateInputs = goal === "lose" || goal === "gain";
  const currentWeight = weight_kg ?? 70;
  const defaultTarget =
    goal === "lose" ? Math.max(30, currentWeight - 5) : Math.min(250, currentWeight + 5);
  const selectedTarget = target_weight_kg ?? defaultTarget;
  const defaultRate =
    goal === "lose" || goal === "gain"
      ? Math.round(((DEFAULT_RATE_PCT[goal] / 100) * currentWeight) * 10) / 10
      : 0.5;
  const selectedRate = rate_kg_per_week ?? Math.max(0.1, defaultRate);

  let projectedDateLabel: string | null = null;
  if (showRateInputs && sex && height_cm && activity_level) {
    const targets = computeTargets({
      sex,
      age_years: 30, // só pro preview local — idade real não afeta ritmo/data projetada
      weight_kg: currentWeight,
      height_cm,
      activity_level,
      goal,
      target_weight_kg: selectedTarget,
      rate_kg_per_week: selectedRate,
    });
    const date = projectGoalDate(currentWeight, selectedTarget, targets.projected_rate_kg_per_week, new Date());
    projectedDateLabel = date ? fmtDate(date) : null;
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Qual seu objetivo?"
      subtitle="Define as metas iniciais de calorias e macros."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!goal}
    >
      <View className="gap-6">
        <View accessibilityRole="radiogroup" className="gap-2">
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                void Haptics.selectionAsync();
                setField("goal", opt.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: goal === opt.value }}
              className={`min-h-[64px] rounded-xl border p-3 ${
                goal === opt.value
                  ? "border-[1.5px] border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <Text className="text-base font-sans-semibold text-neutral-800">{opt.title}</Text>
              <Text className="text-sm font-sans text-neutral-600">{opt.desc}</Text>
            </Pressable>
          ))}
        </View>

        {showRateInputs && (
          <View className="gap-4">
            <View className="gap-2">
              <Text className="text-sm font-sans-medium text-neutral-700">Peso-alvo (kg)</Text>
              <WheelPicker
                min={30}
                max={250}
                step={0.5}
                value={selectedTarget}
                unit="kg"
                onChange={(v) => setField("target_weight_kg", v)}
              />
            </View>
            <View className="gap-2">
              <Text className="text-sm font-sans-medium text-neutral-700">Ritmo (kg/semana)</Text>
              <WheelPicker
                min={0.1}
                max={1.0}
                step={0.1}
                value={selectedRate}
                unit="kg/semana"
                onChange={(v) => setField("rate_kg_per_week", v)}
              />
            </View>
            {projectedDateLabel && (
              <Text
                className="text-center text-sm font-sans text-neutral-600"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                Nesse ritmo, você chega no peso-alvo em torno de {projectedDateLabel}.
              </Text>
            )}
          </View>
        )}
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/GoalBlock.tsx apps/mobile/lib/onboarding/projectGoalDate.ts
git commit -m "feat(mobile): bloco goal com peso-alvo/ritmo e preview em tempo real (M16)"
```

---

## Task 13: Blocos novos — `training`, `habits`

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/TrainingBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/HabitsBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingBlockProps`.
- Produces: 2 componentes skippable pro array da Task 19.

- [ ] **Step 1: `TrainingBlock.tsx`**

```tsx
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const TYPES = ["Nenhum", "Cardio", "Força", "Misto"] as const;

export function TrainingBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const strength_training = useOnboardingStore((s) => s.strength_training);
  const setField = useOnboardingStore((s) => s.setField);
  const trainingDays = useOnboardingStore((s) => s.training_days_per_week ?? 0);

  const selectedTypeIndex = strength_training ? 2 : 0;

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Sua rotina de treino"
      subtitle="Isso ajuda a ajustar sua proteína — pode pular se preferir."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Treinos por semana</Text>
          <WheelPicker
            min={0}
            max={7}
            step={1}
            value={trainingDays}
            unit="x/semana"
            onChange={(v) => setField("training_days_per_week", v)}
          />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Que tipo, principalmente?</Text>
          <SegmentedControl
            values={[...TYPES]}
            selectedIndex={selectedTypeIndex}
            onChange={(e) => {
              const i = e.nativeEvent.selectedSegmentIndex;
              setField("strength_training", i === 2 || i === 3);
            }}
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            style={{ height: 40 }}
          />
        </View>
      </View>
      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular por agora
        </Text>
      )}
    </OnboardingStepShell>
  );
}
```

`training_days_per_week` é um campo local só de UI (não faz parte de `TargetsInput`/`OnboardingPayload` — só `strength_training` importa pro cálculo). Adicione-o ao store como campo solto: em `apps/mobile/lib/stores/onboardingStore.ts`, no `OnboardingState`, junto aos outros campos novos da Task 9: `training_days_per_week: number | undefined;`; no `INITIAL`: `training_days_per_week: undefined,`. Ele entra em `toAnswers()`/`hydrate()` automaticamente (ambos operam sobre o estado inteiro), mas **não** deve ir pro `toPayload()` — não é lido lá, então não precisa de nenhuma linha nova ali.

- [ ] **Step 2: `HabitsBlock.tsx`**

```tsx
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const COOKS = ["Eu mesmo", "Outra pessoa", "Varia"] as const;
const EATS_OUT = ["Raramente", "Às vezes", "Frequentemente"] as const;

export function HabitsBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const cooks_own_food = useOnboardingStore((s) => s.cooks_own_food);
  const eats_out_frequency = useOnboardingStore((s) => s.eats_out_frequency);
  const meal_times = useOnboardingStore((s) => s.meal_times);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Seus hábitos alimentares"
      subtitle="Ajuda o feedback da IA a fazer mais sentido pro seu dia a dia."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Quem cozinha suas refeições?</Text>
          <SegmentedControl
            values={[...COOKS]}
            selectedIndex={cooks_own_food ? COOKS.indexOf(cooks_own_food as (typeof COOKS)[number]) : -1}
            onChange={(e) => setField("cooks_own_food", COOKS[e.nativeEvent.selectedSegmentIndex])}
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            style={{ height: 40 }}
          />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Come fora ou pede delivery?</Text>
          <SegmentedControl
            values={[...EATS_OUT]}
            selectedIndex={
              eats_out_frequency ? EATS_OUT.indexOf(eats_out_frequency as (typeof EATS_OUT)[number]) : -1
            }
            onChange={(e) =>
              setField("eats_out_frequency", EATS_OUT[e.nativeEvent.selectedSegmentIndex])
            }
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            style={{ height: 40 }}
          />
        </View>
        <Input
          label="Horários que costuma comer (opcional)"
          value={meal_times}
          onChangeText={(v) => setField("meal_times", v)}
          placeholder="ex: café 7h, almoço 12h, jantar 20h"
        />
      </View>
      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular por agora
        </Text>
      )}
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/TrainingBlock.tsx apps/mobile/components/onboarding/blocks/HabitsBlock.tsx apps/mobile/lib/stores/onboardingStore.ts
git commit -m "feat(mobile): blocos training/habits — rotina, skippable (M16)"
```

---

## Task 14: Blocos novos — `barriers`, `diet`

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/BarriersBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/DietBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingBlockProps`.
- Produces: 2 componentes skippable com padrão de chip multi-select (toggle num array), reaproveitado por ambos.

- [ ] **Step 1: `BarriersBlock.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const OPTIONS = [
  "Falta de tempo",
  "Fins de semana",
  "Ansiedade / comer emocional",
  "Desisto rápido",
  "Não sei o que comer",
  "Comer fora com frequência",
];

const MAX_SELECTED = 3;

export function BarriersBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const main_barriers = useOnboardingStore((s) => s.main_barriers);
  const setField = useOnboardingStore((s) => s.setField);

  function toggle(option: string) {
    const has = main_barriers.includes(option);
    if (has) {
      setField(
        "main_barriers",
        main_barriers.filter((b) => b !== option),
      );
    } else if (main_barriers.length < MAX_SELECTED) {
      setField("main_barriers", [...main_barriers, option]);
    }
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="O que já te atrapalhou antes?"
      subtitle="Escolha até 3 — isso não muda suas metas, só o tom do feedback."
      onBack={onBack}
      onNext={onNext}
    >
      <View accessibilityRole="radiogroup" className="gap-2">
        {OPTIONS.map((opt) => {
          const selected = main_barriers.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggle(opt)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              className={`min-h-[52px] justify-center rounded-xl border p-3 ${
                selected ? "border-[1.5px] border-primary-400 bg-primary-50" : "border-neutral-200 bg-white"
              }`}
            >
              <Text className="text-sm font-sans-medium text-neutral-800">{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular por agora
        </Text>
      )}
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 2: `DietBlock.tsx`**

```tsx
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const RESTRICTIONS = ["Sem lactose", "Sem glúten", "Vegetariano", "Vegano", "Nenhuma"];
const BUDGETS = ["Apertado", "Moderado", "Confortável"] as const;

export function DietBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const dietary_restrictions = useOnboardingStore((s) => s.dietary_restrictions);
  const disliked_foods = useOnboardingStore((s) => s.disliked_foods);
  const budget = useOnboardingStore((s) => s.budget);
  const setField = useOnboardingStore((s) => s.setField);

  function toggleRestriction(option: string) {
    const has = dietary_restrictions.includes(option);
    setField(
      "dietary_restrictions",
      has ? dietary_restrictions.filter((r) => r !== option) : [...dietary_restrictions, option],
    );
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Sua alimentação"
      subtitle="Restrições, preferências e orçamento — pode pular se preferir."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Restrições</Text>
          <View className="gap-2">
            {RESTRICTIONS.map((opt) => {
              const selected = dietary_restrictions.includes(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => toggleRestriction(opt)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  className={`min-h-[52px] justify-center rounded-xl border p-3 ${
                    selected
                      ? "border-[1.5px] border-primary-400 bg-primary-50"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <Text className="text-sm font-sans-medium text-neutral-800">{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Tem algum alimento que evita ou não gosta? (opcional)"
          value={disliked_foods}
          onChangeText={(v) => setField("disliked_foods", v)}
          placeholder="ex: fígado, quiabo"
        />

        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Orçamento pra comida</Text>
          <SegmentedControl
            values={[...BUDGETS]}
            selectedIndex={budget ? BUDGETS.indexOf(budget as (typeof BUDGETS)[number]) : -1}
            onChange={(e) => setField("budget", BUDGETS[e.nativeEvent.selectedSegmentIndex])}
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            style={{ height: 40 }}
          />
        </View>
      </View>
      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular por agora
        </Text>
      )}
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/BarriersBlock.tsx apps/mobile/components/onboarding/blocks/DietBlock.tsx
git commit -m "feat(mobile): blocos barriers/diet — chips multi-select, skippable (M16)"
```

---

## Task 15: Bloco `health` — condições + triagem de TCA

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/HealthBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingBlockProps`.
- Produces: `HealthBlock`, popula `is_pregnant_or_lactating`/`has_kidney_disease`/`has_type1_diabetes`/`uses_glp1`/`tca_screening_positive` no store.

- [ ] **Step 1: `HealthBlock.tsx`**

```tsx
// PENDENTE DE REVISÃO PROFISSIONAL — perguntas de triagem de TCA são
// próprias, não reproduzem instrumento clínico protegido. Tratam como sinal
// fraco (ativa soft_mode), nunca como diagnóstico.
import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const CONDITIONS = [
  { key: "is_pregnant_or_lactating" as const, label: "Estou grávida ou amamentando", femaleOnly: true },
  { key: "has_kidney_disease" as const, label: "Tenho doença renal diagnosticada" },
  { key: "has_type1_diabetes" as const, label: "Tenho diabetes tipo 1" },
  {
    key: "uses_glp1" as const,
    label: "Uso medicação para emagrecimento (ex: Ozempic, Mounjaro)",
  },
];

const TCA_QUESTIONS = [
  "Você sente que perde o controle sobre quanto come, mesmo sem fome física?",
  "A preocupação com seu peso ou corpo atrapalha sua rotina no dia a dia?",
  "Depois de comer mais do que planejava, você já se puniu com restrição severa ou exercício em excesso?",
];

const TCA_OPTIONS = ["Sim", "Não", "Prefiro não responder"] as const;

export function HealthBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const sex = useOnboardingStore((s) => s.sex);
  const is_pregnant_or_lactating = useOnboardingStore((s) => s.is_pregnant_or_lactating);
  const has_kidney_disease = useOnboardingStore((s) => s.has_kidney_disease);
  const has_type1_diabetes = useOnboardingStore((s) => s.has_type1_diabetes);
  const uses_glp1 = useOnboardingStore((s) => s.uses_glp1);
  const setField = useOnboardingStore((s) => s.setField);
  const [tcaAnswers, setTcaAnswers] = useState<(string | undefined)[]>([undefined, undefined, undefined]);

  const conditionValues: Record<string, boolean> = {
    is_pregnant_or_lactating,
    has_kidney_disease,
    has_type1_diabetes,
    uses_glp1,
  };

  function toggleCondition(key: keyof typeof conditionValues) {
    setField(key, !conditionValues[key]);
  }

  function answerTca(index: number, value: (typeof TCA_OPTIONS)[number]) {
    const next = [...tcaAnswers];
    next[index] = value;
    setTcaAnswers(next);
    setField("tca_screening_positive", next.some((a) => a === "Sim"));
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Sua saúde, com cuidado"
      subtitle="Isso ajuda a manter suas metas seguras. Fique à vontade pra pular qualquer pergunta."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
        <View className="gap-3">
          {CONDITIONS.filter((c) => !c.femaleOnly || sex === "female").map((c) => {
            const checked = conditionValues[c.key];
            return (
              <Pressable
                key={c.key}
                onPress={() => toggleCondition(c.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-md border ${
                    checked ? "border-primary-400 bg-primary-400" : "border-neutral-300 bg-white"
                  }`}
                >
                  {checked && <Check size={16} color="#ffffff" />}
                </View>
                <Text className="flex-1 text-sm font-sans text-neutral-800">{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="gap-4">
          {TCA_QUESTIONS.map((q, i) => (
            <View key={q} className="gap-2">
              <Text className="text-sm font-sans text-neutral-700">{q}</Text>
              <View className="flex-row gap-2">
                {TCA_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => answerTca(i, opt)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: tcaAnswers[i] === opt }}
                    className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border px-2 ${
                      tcaAnswers[i] === opt
                        ? "border-[1.5px] border-primary-400 bg-primary-50"
                        : "border-neutral-200 bg-white"
                    }`}
                  >
                    <Text className="text-center text-xs font-sans-medium text-neutral-800">{opt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </OnboardingStepShell>
  );
}
```

Adicione o import de `useState` no topo (`import { useState } from "react";`).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/HealthBlock.tsx
git commit -m "feat(mobile): bloco health — condições + triagem de TCA (M16)"
```

---

## Task 16: Bloco `permissions`

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/PermissionsBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingBlockProps`, `expo-notifications` (já instalado).

- [ ] **Step 1: `PermissionsBlock.tsx`**

```tsx
import * as Notifications from "expo-notifications";
import { Bell } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { colors } from "@/lib/colors";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function PermissionsBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  async function handleEnable() {
    try {
      await Notifications.requestPermissionsAsync();
    } finally {
      onNext();
    }
  }

  return (
    <OnboardingStepShell step={step} total={total} title="Notificações" onBack={onBack}>
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-50">
          <Bell size={36} color={colors.primary[400]} />
        </View>
        <Text className="text-center text-base font-sans text-neutral-600">
          Avisamos quando bater sua meta do dia e quando sua ofensiva estiver em risco.
        </Text>
        <Button label="Ativar notificações" variant="primary" onPress={handleEnable} />
        {onSkip && (
          <Text
            onPress={onSkip}
            accessibilityRole="button"
            className="text-center text-sm font-sans-medium text-neutral-500"
          >
            Agora não
          </Text>
        )}
      </View>
    </OnboardingStepShell>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/PermissionsBlock.tsx
git commit -m "feat(mobile): bloco permissions — notificações, sem HealthKit (M16)"
```

---

## Task 17: Blocos `calculating` e `reveal`

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/RevealBlock.tsx`
- Create: `apps/mobile/lib/stores/onboardingResultStore.ts`

**Interfaces:**
- Consumes: `postOnboarding` (já existe em `lib/api.ts`), `useOnboardingStore.getState().toPayload()`, `GoalsDisclaimer` (M14).
- Produces: `useOnboardingResultStore` — store efêmero separado (não faz parte do `onboarding_progress`, só vive na sessão do app) guardando o resultado de `POST /onboarding/complete` pro `RevealBlock` ler.

- [ ] **Step 1: `onboardingResultStore.ts`**

```ts
import { create } from "zustand";

type OnboardingResult = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  blocked: boolean;
  block_reason: string | null;
  soft_mode: boolean;
} | null;

interface OnboardingResultState {
  result: OnboardingResult;
  setResult: (result: OnboardingResult) => void;
}

export const useOnboardingResultStore = create<OnboardingResultState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
```

- [ ] **Step 2: `CalculatingBlock.tsx`**

```tsx
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { postOnboarding } from "@/lib/api";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const MIN_DURATION_MS = 3000;

export function CalculatingBlock({ onNext }: OnboardingBlockProps) {
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const setResult = useOnboardingResultStore((s) => s.setResult);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    (async () => {
      const payload = useOnboardingStore.getState().toPayload();
      if (!payload) {
        setError("Faltam informações de um dos passos anteriores.");
        return;
      }
      try {
        const [response] = await Promise.all([
          postOnboarding(payload),
          new Promise((resolve) => setTimeout(resolve, MIN_DURATION_MS)),
        ]);
        if (cancelled) return;
        const body = response as {
          kcal: string;
          protein_g: string;
          carbs_g: string;
          fat_g: string;
          blocked: string;
          block_reason: string | null;
          soft_mode: boolean;
        };
        setResult({
          kcal: Number(body.kcal),
          protein_g: Number(body.protein_g),
          carbs_g: Number(body.carbs_g),
          fat_g: Number(body.fat_g),
          blocked: body.blocked === "true" || (body.blocked as unknown as boolean) === true,
          block_reason: body.block_reason,
          soft_mode: body.soft_mode,
        });
        onNext();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro inesperado.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryKey, onNext, setResult]);

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-neutral-50 px-8">
      {error ? (
        <>
          <Text className="text-center text-sm font-sans text-danger-600">{error}</Text>
          <Button label="Tentar de novo" variant="primary" onPress={() => setRetryKey((k) => k + 1)} />
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text className="text-center text-base font-sans text-neutral-600">
            Calculando suas metas...
          </Text>
        </>
      )}
    </View>
  );
}
```

`postOnboarding` hoje devolve `res.json()` tipado implicitamente — confirme em `lib/api.ts` que a função retorna o corpo cru (sem parse Zod) antes de escrever este bloco; se `postOnboarding` já tiver um tipo de retorno mais estrito, ajuste o cast acima pra bater.

- [ ] **Step 3: `RevealBlock.tsx`**

```tsx
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function RevealBlock({ onNext }: OnboardingBlockProps) {
  const result = useOnboardingResultStore((s) => s.result);
  const reset = useOnboardingStore((s) => s.reset);

  if (!result) {
    router.replace("/(app)" as never);
    return null;
  }

  if (result.soft_mode) {
    return (
      <View className="flex-1 justify-between bg-neutral-50 p-8">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center text-2xl font-display-bold text-neutral-800">
            Vamos com calma
          </Text>
          <Text className="text-center text-base font-sans text-neutral-600">
            Por enquanto, vamos focar em registrar suas refeições com regularidade e variedade —
            sem números de calorias. Se quiser conversar com alguém, o CVV (188) atende de graça,
            a qualquer hora.
          </Text>
        </View>
        <View className="gap-4">
          <GoalsDisclaimer />
          <Button
            label="Continuar"
            variant="primary"
            onPress={() => {
              reset();
              onNext();
            }}
          />
        </View>
      </View>
    );
  }

  if (result.blocked) {
    return (
      <View className="flex-1 justify-between bg-neutral-50 p-8">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center text-2xl font-display-bold text-neutral-800">
            Ajustamos suas metas
          </Text>
          <Text className="text-center text-base font-sans text-neutral-600">
            {result.block_reason}
          </Text>
        </View>
        <View className="gap-4">
          <GoalsDisclaimer />
          <Button
            label="Continuar"
            variant="primary"
            onPress={() => {
              reset();
              onNext();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-between bg-neutral-50 p-8">
      <View className="flex-1 items-center justify-center gap-6">
        <Text className="text-center text-2xl font-display-bold text-neutral-800">
          Suas metas estão prontas
        </Text>
        <Text
          className="text-5xl font-display-bold text-primary-500"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {fmtInt(result.kcal)} kcal
        </Text>
        <View className="flex-row gap-6">
          <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
            {fmtInt(result.protein_g)}g proteína
          </Text>
          <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
            {fmtInt(result.carbs_g)}g carbo
          </Text>
          <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
            {fmtInt(result.fat_g)}g gordura
          </Text>
        </View>
      </View>
      <View className="gap-4">
        <GoalsDisclaimer />
        <Button
          label="Continuar"
          variant="primary"
          onPress={() => {
            reset();
            onNext();
          }}
        />
      </View>
    </View>
  );
}
```

`reset()` limpa o `useOnboardingStore` (a conta já foi criada — não precisamos mais desses dados na sessão). O resultado do `onboardingResultStore` fica até o app fechar (não precisa reset explícito).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx apps/mobile/components/onboarding/blocks/RevealBlock.tsx apps/mobile/lib/stores/onboardingResultStore.ts
git commit -m "feat(mobile): blocos calculating/reveal — submissão real + ramificação por gate (M16)"
```

---

## Task 18: Blocos `paywall` e `first_meal`

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/PaywallBlock.tsx`
- Create: `apps/mobile/components/onboarding/blocks/FirstMealBlock.tsx`

**Interfaces:**
- Consumes: `OnboardingBlockProps`, `MealComposer` (`apps/mobile/components/domain/MealComposer.tsx`), `useCreateMealText`/`useCreateMealAudio` (já existem em `apps/mobile/lib/hooks/`).

- [ ] **Step 1: `PaywallBlock.tsx`**

```tsx
import { Sparkles } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function PaywallBlock({ onNext }: OnboardingBlockProps) {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-neutral-50 px-8">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-50">
        <Sparkles size={36} color={colors.primary[400]} />
      </View>
      <Text className="text-center text-2xl font-display-bold text-neutral-800">
        Fitbrother Premium — em breve
      </Text>
      <Text className="text-center text-base font-sans text-neutral-600">
        Estamos preparando recursos extras. Por enquanto, aproveite o Fitbrother completo, de
        graça.
      </Text>
      <Button label="Continuar" variant="primary" onPress={onNext} />
    </View>
  );
}
```

- [ ] **Step 2: `FirstMealBlock.tsx`**

```tsx
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MealComposer } from "@/components/domain/MealComposer";
import { newClientMealId, useCreateMealText } from "@/lib/hooks/useCreateMealText";
import { useCreateMealAudio } from "@/lib/hooks/useCreateMealAudio";
import { uploadMealAudio } from "@/lib/storage";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function FirstMealBlock({}: OnboardingBlockProps) {
  const [processing, setProcessing] = useState(false);
  const createText = useCreateMealText();
  const createAudio = useCreateMealAudio();

  function finish() {
    router.replace("/(app)" as never);
  }

  async function handleSend(text: string) {
    setProcessing(true);
    try {
      await createText.mutateAsync({ client_meal_id: newClientMealId(), text, locale: "pt-BR" });
      finish();
    } finally {
      setProcessing(false);
    }
  }

  async function handleAudioReady(params: {
    fileUri: string;
    durationMs: number;
    ext: "m4a" | "opus";
  }) {
    setProcessing(true);
    try {
      const clientMealId = newClientMealId();
      const audioPath = await uploadMealAudio(clientMealId, params.fileUri, params.ext);
      await createAudio.mutateAsync({
        client_meal_id: clientMealId,
        audio_path: audioPath,
        duration_s: Math.round(params.durationMs / 1000),
        locale: "pt-BR",
      });
      finish();
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <View className="gap-2 px-6 pt-4">
        <Text className="text-2xl font-display-bold text-neutral-800">
          Vamos registrar sua primeira refeição
        </Text>
        <Text className="text-base font-sans text-neutral-600">
          Texto ou áudio — do jeito que for mais fácil agora.
        </Text>
      </View>
      <View className="flex-1" />
      <MealComposer onSend={handleSend} onAudioReady={handleAudioReady} processing={processing} />
    </SafeAreaView>
  );
}
```

Confira a assinatura exata de `useCreateMealText`/`useCreateMealAudio`/`uploadMealAudio` em `apps/mobile/lib/hooks/useCreateMealText.ts`, `useCreateMealAudio.ts` e `apps/mobile/lib/storage.ts` antes de finalizar este passo — são hooks já usados por `(app)/index.tsx`, então os nomes de campos do `mutateAsync` devem bater com o que `HomeScreen` já passa pra eles.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros. Ajuste imports/assinaturas conforme os hooks reais encontrados no passo anterior.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/PaywallBlock.tsx apps/mobile/components/onboarding/blocks/FirstMealBlock.tsx
git commit -m "feat(mobile): blocos paywall (placeholder) e first_meal (M16)"
```

---

## Task 19: Montar o engine, a rota dinâmica e o gate — apagar os arquivos antigos

**Files:**
- Create: `apps/mobile/lib/onboarding/blocks.ts`
- Create: `apps/mobile/app/(onboarding)/[block].tsx`
- Modify: `apps/mobile/app/(onboarding)/index.tsx` (vira o gate — substitui todo o conteúdo antigo)
- Delete: `apps/mobile/app/(onboarding)/step-2.tsx` até `step-9.tsx` (8 arquivos)
- Modify: `apps/mobile/lib/constants.ts` (remove `ONBOARDING_STEPS`)

**Interfaces:**
- Consumes: todos os 19 componentes de bloco (Tasks 10-18), `getOnboardingProgress`/`patchOnboardingProgress` (Task 8), `useOnboardingStore.hydrate`/`toAnswers` (Task 9).

- [ ] **Step 1: `lib/onboarding/blocks.ts`**

```ts
import { ActivityBlock } from "@/components/onboarding/blocks/ActivityBlock";
import { BarriersBlock } from "@/components/onboarding/blocks/BarriersBlock";
import { BasicsBlock } from "@/components/onboarding/blocks/BasicsBlock";
import { CalculatingBlock } from "@/components/onboarding/blocks/CalculatingBlock";
import { ConsentBlock } from "@/components/onboarding/blocks/ConsentBlock";
import { ContactBlock } from "@/components/onboarding/blocks/ContactBlock";
import { DietBlock } from "@/components/onboarding/blocks/DietBlock";
import { FirstMealBlock } from "@/components/onboarding/blocks/FirstMealBlock";
import { GoalBlock } from "@/components/onboarding/blocks/GoalBlock";
import { HabitsBlock } from "@/components/onboarding/blocks/HabitsBlock";
import { HealthBlock } from "@/components/onboarding/blocks/HealthBlock";
import { HeightBlock } from "@/components/onboarding/blocks/HeightBlock";
import { IdentityBlock } from "@/components/onboarding/blocks/IdentityBlock";
import { NameBlock } from "@/components/onboarding/blocks/NameBlock";
import { PaywallBlock } from "@/components/onboarding/blocks/PaywallBlock";
import { PermissionsBlock } from "@/components/onboarding/blocks/PermissionsBlock";
import { RevealBlock } from "@/components/onboarding/blocks/RevealBlock";
import { TrainingBlock } from "@/components/onboarding/blocks/TrainingBlock";
import { WeightBlock } from "@/components/onboarding/blocks/WeightBlock";
import type { OnboardingBlockDef } from "@/lib/onboarding/types";

export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  { id: "name", Component: NameBlock },
  { id: "basics", Component: BasicsBlock },
  { id: "height", Component: HeightBlock },
  { id: "weight", Component: WeightBlock },
  { id: "activity", Component: ActivityBlock },
  { id: "training", Component: TrainingBlock, skippable: true },
  { id: "habits", Component: HabitsBlock, skippable: true },
  { id: "goal", Component: GoalBlock },
  { id: "barriers", Component: BarriersBlock, skippable: true },
  { id: "diet", Component: DietBlock, skippable: true },
  { id: "health", Component: HealthBlock },
  { id: "permissions", Component: PermissionsBlock, skippable: true },
  { id: "contact", Component: ContactBlock },
  { id: "identity", Component: IdentityBlock },
  { id: "consent", Component: ConsentBlock },
  { id: "calculating", Component: CalculatingBlock },
  { id: "reveal", Component: RevealBlock },
  { id: "paywall", Component: PaywallBlock },
  { id: "first_meal", Component: FirstMealBlock },
];

export const DATA_BLOCK_COUNT = 15; // "name" .. "consent"
```

- [ ] **Step 2: `app/(onboarding)/[block].tsx`**

```tsx
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ONBOARDING_BLOCKS, DATA_BLOCK_COUNT } from "@/lib/onboarding/blocks";
import { patchOnboardingProgress } from "@/lib/api";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

export default function OnboardingBlockScreen() {
  const { block: blockId } = useLocalSearchParams<{ block: string }>();
  const index = ONBOARDING_BLOCKS.findIndex((b) => b.id === blockId);

  useEffect(() => {
    if (index === -1) {
      router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[0].id}` as never);
    }
  }, [index]);

  if (index === -1) return null;
  const block = ONBOARDING_BLOCKS[index];

  function goTo(id: string) {
    router.push(`/(onboarding)/${id}` as never);
  }

  function handleNext() {
    const next = ONBOARDING_BLOCKS[index + 1];
    if (index < DATA_BLOCK_COUNT) {
      void patchOnboardingProgress({
        current_block: next?.id ?? block.id,
        answers: useOnboardingStore.getState().toAnswers(),
      });
    }
    if (next) goTo(next.id);
  }

  function handleBack() {
    const prev = ONBOARDING_BLOCKS[index - 1];
    if (prev) goTo(prev.id);
    else router.replace("/(auth)/welcome");
  }

  const Component = block.Component;
  return (
    <Component
      step={index + 1}
      total={DATA_BLOCK_COUNT}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={block.skippable ? handleNext : undefined}
    />
  );
}
```

- [ ] **Step 3: `app/(onboarding)/index.tsx`** (substitui todo o conteúdo atual — vira o gate de resume)

```tsx
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { getOnboardingProgress } from "@/lib/api";
import { ONBOARDING_BLOCKS } from "@/lib/onboarding/blocks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

export default function OnboardingGate() {
  useEffect(() => {
    (async () => {
      const progress = await getOnboardingProgress().catch(() => null);
      if (progress) {
        useOnboardingStore.getState().hydrate(progress.answers);
        router.replace(`/(onboarding)/${progress.current_block}` as never);
      } else {
        router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[0].id}` as never);
      }
    })();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-neutral-50">
      <ActivityIndicator size="large" />
    </View>
  );
}
```

- [ ] **Step 4: Apagar as rotas antigas**

```bash
git rm apps/mobile/app/\(onboarding\)/step-2.tsx apps/mobile/app/\(onboarding\)/step-3.tsx apps/mobile/app/\(onboarding\)/step-4.tsx apps/mobile/app/\(onboarding\)/step-5.tsx apps/mobile/app/\(onboarding\)/step-6.tsx apps/mobile/app/\(onboarding\)/step-7.tsx apps/mobile/app/\(onboarding\)/step-8.tsx apps/mobile/app/\(onboarding\)/step-9.tsx
```

- [ ] **Step 5: Remover `ONBOARDING_STEPS`**

Em `apps/mobile/lib/constants.ts`, apague o bloco:

```ts
/** Total steps in the onboarding flow (FEATURES §4.1). */
export const ONBOARDING_STEPS = 9;
```

- [ ] **Step 6: Typecheck do monorepo inteiro**

Run: `npm run typecheck --workspaces --if-present`
Expected: sem erros. Se algum arquivo referenciar `ONBOARDING_STEPS` ou `step-N`, corrija antes de prosseguir.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/onboarding/blocks.ts "apps/mobile/app/(onboarding)/[block].tsx" "apps/mobile/app/(onboarding)/index.tsx" apps/mobile/lib/constants.ts
git commit -m "feat(mobile): engine de blocos + rota dinâmica + gate de resume, remove step-N.tsx (M16)"
```

---

## Task 20: `soft_mode` nos 3 pontos de UI

**Files:**
- Modify: `apps/mobile/components/domain/TodaySummaryHeader.tsx`
- Modify: `apps/mobile/components/domain/HistoryDayCard.tsx`
- Modify: `apps/mobile/components/domain/HomeHeader.tsx`
- Modify: `apps/mobile/app/(app)/index.tsx`
- Modify: `apps/mobile/app/(app)/history/index.tsx`
- Modify: `apps/mobile/app/(app)/history/[day]/index.tsx`

**Interfaces:**
- Consumes: `Profile.soft_mode` (Task 8).

- [ ] **Step 1: `TodaySummaryHeader.tsx`** — novo prop `softMode?: boolean`, esconde os 4 rings

```tsx
type Props = {
  summary: DailySummary | undefined;
  softMode?: boolean;
};
```

No corpo da função, logo depois de calcular `kcal`/`protein`/etc., antes do `return`:

```tsx
export function TodaySummaryHeader({ summary, softMode = false }: Props) {
  const kcal = summary?.kcal ?? 0;
  const protein = summary?.protein_g ?? 0;
  const carbs = summary?.carbs_g ?? 0;
  const fat = summary?.fat_g ?? 0;
  const goalKcal = summary?.goal_kcal ?? null;
  const goalProtein = summary?.goal_protein_g ?? null;
  const goalCarbs = summary?.goal_carbs_g ?? null;
  const goalFat = summary?.goal_fat_g ?? null;
  const mealsCount = summary?.meals_count ?? 0;

  if (softMode) {
    return (
      <View className="items-center gap-2 px-6 pb-6 pt-4">
        <Text className="text-4xl font-display-bold text-neutral-800" style={{ fontVariant: ["tabular-nums"] }}>
          {mealsCount}
        </Text>
        <Text className="font-sans text-neutral-500">
          {mealsCount === 1 ? "refeição registrada hoje" : "refeições registradas hoje"}
        </Text>
      </View>
    );
  }

  return (
    <View className="px-6 pt-4 pb-6 items-center gap-6">
```

(o resto do `return` original continua igual — só o `if (softMode)` é novo, inserido antes do `return` existente.)

- [ ] **Step 2: `HistoryDayCard.tsx`** — novo prop `softMode?: boolean`

```tsx
type Props = {
  summary: DailySummary;
  softMode?: boolean;
};
```

```tsx
export function HistoryDayCard({ summary, softMode = false }: Props) {
  const router = useRouter();
  const heroLabel = softMode
    ? ""
    : summary.goal_kcal
      ? `${fmtInt(summary.kcal)} / ${fmtInt(summary.goal_kcal)} kcal`
      : `${fmtInt(summary.kcal)} kcal`;
  const mealsLabel = `${summary.meals_count} ${summary.meals_count === 1 ? "refeição" : "refeições"}`;
```

E no JSX, troque o bloco do hero + `MacroBar`s por uma ramificação:

```tsx
        <View className="flex-row items-center justify-between">
          {softMode ? (
            <Text style={NUM} className="text-xl font-display-bold text-neutral-800">
              {mealsLabel}
            </Text>
          ) : (
            <Text style={NUM} className="text-xl font-display-bold text-neutral-800">
              {heroLabel}
            </Text>
          )}
          <View className="flex-row items-center gap-1.5">
            {summary.goal_hit ? <Flame size={14} color={streakColor()} /> : null}
            {!softMode && (
              <Text className="text-xs font-sans-medium text-neutral-500" style={NUM}>
                {mealsLabel}
              </Text>
            )}
          </View>
        </View>
        {!softMode && (
          <View className="mt-3 gap-1.5">
            <MacroBar value={summary.protein_g} max={summary.goal_protein_g} color="protein" label="Prot" />
            <MacroBar value={summary.carbs_g} max={summary.goal_carbs_g} color="carbs" label="Carb" />
            <MacroBar value={summary.fat_g} max={summary.goal_fat_g} color="fat" label="Gord" />
          </View>
        )}
```

- [ ] **Step 3: `HomeHeader.tsx`** — novo prop `softMode?: boolean`, some com `StreakCounter`

```tsx
export function HomeHeader({ name, softMode = false }: { name: string; softMode?: boolean }) {
```

E na renderização, troque:

```tsx
        {streakView ? (
          <StreakCounter current={streakView.streak.current_streak} atRisk={streakView.atRisk} />
        ) : null}
```

por:

```tsx
        {!softMode && streakView ? (
          <StreakCounter current={streakView.streak.current_streak} atRisk={streakView.atRisk} />
        ) : null}
```

- [ ] **Step 4: Passar `softMode` nos call sites**

Em `apps/mobile/app/(app)/index.tsx`:

```tsx
      <HomeHeader name={profile.full_name} softMode={profile.soft_mode} />
```

E nas duas ocorrências de `<TodaySummaryHeader summary={summaryQuery.data} />`:

```tsx
      <TodaySummaryHeader summary={summaryQuery.data} softMode={profile.soft_mode} />
```

Em `apps/mobile/app/(app)/history/index.tsx`, no `renderItem` que usa `<HistoryDayCard summary={item.summary} />` — adicione `useProfile()` no topo do componente (se ainda não tiver) e passe `softMode={profile.soft_mode}`.

Em `apps/mobile/app/(app)/history/[day]/index.tsx`, no `<TodaySummaryHeader summary={summaryQuery.data} />` — mesma coisa, adicione `softMode={profile.soft_mode}` (confirme que `useProfile()` já está importado nesse arquivo antes de adicionar um import duplicado).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/domain/TodaySummaryHeader.tsx apps/mobile/components/domain/HistoryDayCard.tsx apps/mobile/components/domain/HomeHeader.tsx "apps/mobile/app/(app)/index.tsx" "apps/mobile/app/(app)/history/index.tsx" "apps/mobile/app/(app)/history/[day]/index.tsx"
git commit -m "feat(mobile): liga soft_mode aos 3 pontos de UI que mostram kcal/streak (M16)"
```

---

## Task 21: Verificação final + status no `PLAN.md`

**Files:**
- Modify: `docs/PLAN.md` (seção M16)

- [ ] **Step 1: Typecheck + lint do monorepo inteiro**

Run: `npm run typecheck && npm run lint`
Expected: 0 erros, 0 warnings (`--max-warnings 0`).

- [ ] **Step 2: Repetir os 2 smoke tests da Task 6 e Task 7 no estado final** (garantir que nada quebrou depois de todas as tasks seguintes)

Run: o script SQL da Task 6 (`ROLLBACK`) + a sequência `curl` da Task 7, contra `supabase db reset` limpo.
Expected: mesmos resultados documentados nas Tasks 6 e 7.

- [ ] **Step 3: Walkthrough manual via Expo** (sem Detox/Playwright no projeto — verificação manual mesmo)

Suba `npm run dev:mobile`, crie uma conta nova, percorra os 19 blocos até `(app)`. Confirme: barra de progresso mostra 1-15 corretamente; `training`/`habits`/`barriers`/`diet`/`permissions` têm "Pular por agora" funcional; `goal` mostra data projetada ao mexer nos WheelPickers de peso-alvo/ritmo; `health` com alguma pergunta de TCA = "Sim" resulta no `reveal` mostrando a tela de soft_mode (sem números); fechar o app no bloco `diet` e reabrir retoma exatamente ali.

- [ ] **Step 4: Atualizar `docs/PLAN.md`**

Marcar M16 como concluído na seção Fase 4, no mesmo formato usado por M14/M15 (Status com o que foi implementado e verificado).

- [ ] **Step 5: Commit**

```bash
git add docs/PLAN.md
git commit -m "docs: marca M16 (máquina de estados do onboarding) como concluído"
```

---

## Self-Review

**Cobertura do spec:** §1 (arquitetura) → Tasks 3, 7, 19. §2 (contrato de dados) → Tasks 1, 2, 4, 5, 6. §3 (migração 1:1) → Tasks 10, 11. §4 (blocos novos) → Tasks 12-18. §5 (resume) → Tasks 7, 19. §6 (`soft_mode` na UI) → Task 20. §7 (testes) → Tasks 6, 7, 21. §8 (feito quando) → Task 21.

**Placeholder scan:** sem TBD/TODO. Os dois pontos que pedem "confira a assinatura exata antes de escrever" (Task 17 sobre `postOnboarding`, Task 18 sobre os hooks de meal) não são placeholders de lógica faltando — é uma instrução de verificação de contrato existente antes de integrar, porque este plano não teve acesso de leitura a esses 3 arquivos específicos durante a escrita; o corpo de cada bloco já está completo e correto para os contratos assumidos.

**Consistência de tipos:** `OnboardingBlockProps`/`OnboardingBlockDef` (Task 9) usados identicamente em todas as Tasks 10-18 e montados na Task 19. `toAnswers()`/`hydrate()` (Task 9) usados nas Tasks 19 exatamente como definidos. Campos do store (`target_weight_kg` etc., Task 9) usados com os mesmos nomes em `GoalBlock` (Task 12), `HealthBlock` (Task 15) e no `toPayload()` estendido (Task 9) — batem com `OnboardingPayloadSchema` (Task 1) e `buildTargetsInput` (Task 2). `soft_mode` flui: gate (Task 7) → RPC (Task 6) → resposta HTTP (Task 7) → `CalculatingBlock`/`RevealBlock` (Task 17) → `profiles.soft_mode` via `/me` → `Profile.soft_mode` (Task 8) → 3 componentes (Task 20). Nenhuma divergência de nome encontrada.
