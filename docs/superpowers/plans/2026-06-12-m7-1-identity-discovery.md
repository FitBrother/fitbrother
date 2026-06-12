# M7.1 — Identidade & Descoberta · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada usuário um `username` (escolhido no onboarding) e busca/seguir por ele, e blindar o telefone movendo-o para uma tabela isolada `profiles_private`, com uma projeção pública `public_profiles` que nunca expõe telefone.

**Architecture:** Migrations Postgres (RLS-first) introduzem `username`/`avatar_url` em `profiles`, a tabela `profiles_private`, a view `public_profiles` e o bucket `post-images`. O backend Fastify atualiza os consumidores de telefone (verify-phone, reverse-match de contatos) para `profiles_private`, adiciona rotas de busca/disponibilidade/seguir, e refatora leitura de identidade de terceiros para `public_profiles`. O mobile ganha um step de username (com checagem de disponibilidade), avatar opcional e uma tela de busca.

**Tech Stack:** Supabase (Postgres + RLS + Storage), Fastify + TypeScript + zod, Expo Router + React Query + Zustand, `@fitbrother/shared` (zod schemas).

**Verificação (padrão do repo — não há test runner JS):** lógica de banco → check SQL em `scripts/checks/` rodado por `psql` no container, dentro de transação que dá `ROLLBACK` no fim; TypeScript → `npm run typecheck` + `npm run lint` (max-warnings 0); mobile/realtime/push → e2e manual em device (registrar, não automatizável aqui).

**Pré-requisitos:** `npm run db:start` rodando (container `supabase_db_fitbrother`); branch de trabalho criada.

---

## File Structure

**Migrations (novas):**
- `supabase/migrations/0037_profiles_identity.sql` — `profiles.username` + `avatar_url` + atualização de `complete_onboarding`.
- `supabase/migrations/0038_profiles_private.sql` — tabela `profiles_private`, move colunas de telefone, RLS, backfill.
- `supabase/migrations/0039_public_profiles.sql` — view `public_profiles` + refator de `following_summaries_view` e `fitbrother_weekly_leaderboard`.
- `supabase/migrations/0040_post_images_bucket.sql` — bucket `post-images`.

**Checks (novos):**
- `scripts/checks/m7-1-identity.sql` + `scripts/checks/m7-1-identity.sh`.

**Shared (modificar):**
- `packages/shared/src/schemas.ts` — estende `OnboardingPayloadSchema`; adiciona `UsernameSchema`, `PublicProfileSchema`, `UserSearchResponseSchema`, `UsernameAvailableResponseSchema`, `FollowRequestSchema`.

**Backend (modificar/criar):**
- `apps/server/src/routes/me.ts` — `verify-phone` grava em `profiles_private`.
- `apps/server/src/services/contacts.ts` — `syncContacts`/`reverseMatchFollows` usam `profiles_private`.
- `apps/server/src/routes/social.ts` — `/following` via `public_profiles`.
- `apps/server/src/routes/users.ts` (novo) — `GET /users/search`, `GET /users/username-available`, `POST /follows`, `DELETE /follows/:followeeId`.
- `apps/server/src/server.ts` — registra `usersRoutes`.

**Mobile (modificar/criar):**
- `apps/mobile/lib/stores/onboardingStore.ts` — campos `username`/`avatar_url`.
- `apps/mobile/app/(onboarding)/step-9.tsx` (novo) — escolha de username + avatar opcional.
- `apps/mobile/lib/api/users.ts` (novo) — search, username-available, follow.
- `apps/mobile/lib/hooks/useUsernameAvailable.ts` (novo), `apps/mobile/lib/hooks/useUserSearch.ts` (novo).
- `apps/mobile/app/(app)/users/search.tsx` (novo) — busca + seguir.

**db-types (gerado):**
- `packages/db-types/index.ts` — regenerado via `npm run db:types`.

---

## Task 1: Migration `0037_profiles_identity.sql` — username + avatar

**Files:**
- Create: `supabase/migrations/0037_profiles_identity.sql`
- Create: `scripts/checks/m7-1-identity.sql`
- Create: `scripts/checks/m7-1-identity.sh`

- [ ] **Step 1: Write the failing check (SQL)**

Create `scripts/checks/m7-1-identity.sql`:

```sql
-- M7.1 identity & discovery — checks SQL.
-- Roda via: docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m7-1-identity.sql
\set ON_ERROR_STOP on
BEGIN;

-- Check 1: profiles tem username citext UNIQUE + avatar_url.
SELECT 'check_1_username_column' AS check,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'profiles' AND column_name = 'username'
       )
   AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'profiles' AND column_name = 'avatar_url'
       ) AS pass;

-- Check 2: regex de username é aplicada (rejeita 'AB' e 'tem espaço').
DO $$
DECLARE u uuid;
BEGIN
  SELECT user_id INTO u FROM public.profiles LIMIT 1;
  IF u IS NULL THEN RAISE NOTICE 'check_2_skip: no profiles'; RETURN; END IF;
  BEGIN
    UPDATE public.profiles SET username = 'AB' WHERE user_id = u;
    RAISE EXCEPTION 'check_2_FAIL: username inválido aceito';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'check_2_pass: username inválido rejeitado';
  END;
END $$;

ROLLBACK;
```

- [ ] **Step 2: Run the check to verify it fails**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: erro `column "username" does not exist` (ou check_1 `pass = f`) — a migration ainda não existe.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0037_profiles_identity.sql`:

```sql
-- M7.1 — Identidade & descoberta. Adiciona username (descoberta por busca) e
-- avatar_url a profiles, e faz complete_onboarding persistir ambos.
-- citext (case-insensitive) garante que 'Maria' e 'maria' colidam.
CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE public.profiles ADD COLUMN username citext UNIQUE;
ALTER TABLE public.profiles ADD COLUMN avatar_url text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_.]{3,20}$');

-- Busca por prefixo (case-insensitive via citext) sobre username.
CREATE INDEX profiles_username_idx ON public.profiles (username)
  WHERE username IS NOT NULL;

-- complete_onboarding passa a gravar username + avatar_url (NULL se ausentes).
-- Reescreve a versão de 0024 acrescentando as duas colunas no INSERT de profiles.
CREATE OR REPLACE FUNCTION public.complete_onboarding(payload jsonb)
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
  v_anthro_id       uuid;
  v_tdee            numeric;
  v_kcal_factor     numeric;
  v_protein_per_kg  numeric;
  v_kcal            numeric;
  v_protein_g       numeric;
  v_fat_g           numeric;
  v_carbs_g         numeric;
  v_goal_id         uuid;
  v_effective_from  date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires authenticated user';
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, username, avatar_url, phone_e164, birth_date, sex,
    activity_level, goal, timezone, day_start_hour, locale, lgpd_consent_at
  )
  VALUES (
    uid,
    payload->>'full_name',
    NULLIF(payload->>'username', '')::citext,
    NULLIF(payload->>'avatar_url', ''),
    NULLIF(payload->>'phone_e164', ''),
    v_birth_date,
    v_sex,
    v_activity_level,
    v_goal,
    payload->>'timezone',
    COALESCE((payload->>'day_start_hour')::smallint, 0),
    COALESCE(payload->>'locale', 'pt-BR'),
    now()
  );

  INSERT INTO public.anthropometrics (user_id, weight_kg, height_cm)
  VALUES (uid, v_weight_kg, v_height_cm)
  RETURNING id, tdee_kcal INTO v_anthro_id, v_tdee;

  v_kcal_factor := CASE v_goal
    WHEN 'lose'     THEN 0.80
    WHEN 'maintain' THEN 1.00
    WHEN 'gain'     THEN 1.10
    WHEN 'recomp'   THEN 0.95
  END;
  v_protein_per_kg := CASE v_goal
    WHEN 'lose'     THEN 2.0
    WHEN 'recomp'   THEN 2.0
    WHEN 'maintain' THEN 1.6
    WHEN 'gain'     THEN 1.6
  END;

  v_kcal      := ROUND(v_tdee * v_kcal_factor, 2);
  v_protein_g := ROUND(v_weight_kg * v_protein_per_kg, 2);
  v_fat_g     := ROUND(v_kcal * 0.25 / 9, 2);
  v_carbs_g   := ROUND((v_kcal - 4 * v_protein_g - 9 * v_fat_g) / 4, 2);
  IF v_carbs_g < 0 THEN v_carbs_g := 0; END IF;

  v_effective_from := public.fitbrother_nutritional_day(uid, now());

  INSERT INTO public.nutrition_goals (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g
  )
  VALUES (uid, v_effective_from, v_kcal, v_protein_g, v_carbs_g, v_fat_g)
  RETURNING id INTO v_goal_id;

  INSERT INTO public.subscriptions (user_id) VALUES (uid);

  INSERT INTO public.consent_log (user_id, scope, policy_version)
  VALUES
    (uid, 'terms',         v_policy_version),
    (uid, 'privacy',       v_policy_version),
    (uid, 'ai_processing', v_policy_version);

  RETURN jsonb_build_object(
    'user_id',           uid,
    'anthropometric_id', v_anthro_id,
    'nutrition_goal_id', v_goal_id,
    'tdee_kcal',         v_tdee,
    'kcal',              v_kcal,
    'protein_g',         v_protein_g,
    'carbs_g',           v_carbs_g,
    'fat_g',             v_fat_g
  );
END;
$$;
```

- [ ] **Step 4: Apply migrations + run the check to verify it passes**

Run:
```bash
npm run db:reset
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: `check_1_username_column | pass = t` e `NOTICE check_2_pass: username inválido rejeitado`.

- [ ] **Step 5: Make the check script executable + commit**

Create `scripts/checks/m7-1-identity.sh`:

```bash
#!/usr/bin/env bash
# M7.1 identity checks — SQL via psql. Pré: supabase local up.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
echo "── M7.1 identity checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m7-1-identity.sql
echo "── done ──"
```

Run:
```bash
chmod +x scripts/checks/m7-1-identity.sh
git add supabase/migrations/0037_profiles_identity.sql scripts/checks/m7-1-identity.sql scripts/checks/m7-1-identity.sh
git commit -m "feat(m7.1): profiles.username + avatar_url + onboarding persist"
```

---

## Task 2: Migration `0038_profiles_private.sql` — blindar telefone

**Files:**
- Create: `supabase/migrations/0038_profiles_private.sql`
- Modify: `scripts/checks/m7-1-identity.sql` (adicionar checks 3 e 4)

- [ ] **Step 1: Add failing checks for phone isolation**

Edit `scripts/checks/m7-1-identity.sql` — adicionar antes do `ROLLBACK;`:

```sql
-- Check 3: profiles_private existe e profiles NÃO tem mais colunas de telefone.
SELECT 'check_3_phone_moved' AS check,
       EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'profiles_private')
   AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'profiles' AND column_name = 'phone_e164')
   AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'profiles' AND column_name = 'phone_hash') AS pass;

-- Check 4: RLS de profiles_private bloqueia leitura de terceiros.
-- Usa dois usuários (se existirem) e o role 'authenticated' com JWT do user A
-- tentando ler a linha de B.
DO $$
DECLARE a uuid; b uuid; n int;
BEGIN
  SELECT user_id INTO a FROM public.profiles ORDER BY created_at LIMIT 1;
  SELECT user_id INTO b FROM public.profiles WHERE user_id <> a ORDER BY created_at LIMIT 1;
  IF a IS NULL OR b IS NULL THEN RAISE NOTICE 'check_4_skip: <2 profiles'; RETURN; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.profiles_private WHERE user_id = b;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'check_4_FAIL: leu profiles_private de terceiro'; END IF;
  RAISE NOTICE 'check_4_pass: profiles_private isolado por RLS';
END $$;
```

- [ ] **Step 2: Run checks to verify the new ones fail**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: erro/`pass = f` em check_3 — `profiles_private` ainda não existe.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0038_profiles_private.sql`:

```sql
-- M7.1 — Telefone blindado. Move phone_e164/phone_hash/phone_verified_at de
-- profiles para uma tabela isolada profiles_private (RLS owner + service-role).
-- Torna estruturalmente impossível uma query de descoberta tocar no telefone.

CREATE TABLE public.profiles_private (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164        text UNIQUE,
  phone_hash        text,
  phone_verified_at timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles_private
  ADD CONSTRAINT profiles_private_phone_e164_format
  CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

CREATE INDEX profiles_private_phone_hash_idx ON public.profiles_private (phone_hash)
  WHERE phone_hash IS NOT NULL;

CREATE TRIGGER profiles_private_set_updated_at
  BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: move dados existentes (best-effort; sem usuários reais ainda).
INSERT INTO public.profiles_private (user_id, phone_e164, phone_hash, phone_verified_at)
SELECT user_id, phone_e164, phone_hash, phone_verified_at FROM public.profiles;

-- Drop das colunas de telefone em profiles (e índice/constraints associados).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_e164_format;
DROP INDEX IF EXISTS public.profiles_phone_hash_idx;
ALTER TABLE public.profiles DROP COLUMN phone_e164;
ALTER TABLE public.profiles DROP COLUMN phone_hash;
ALTER TABLE public.profiles DROP COLUMN phone_verified_at;

-- RLS owner-only. Service-role (backend) bypassa para verify-phone e reverse-match.
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_private_owner_all
  ON public.profiles_private
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

> **Atenção:** outras migrations/views podem referenciar `profiles.phone_verified_at`. Antes de aplicar, rode `grep -rn "phone_verified_at\|phone_hash\|phone_e164" supabase/migrations/` e confirme que nenhuma view/RPC anterior quebra. Em 2026-06, os únicos consumidores eram os serviços TS (Tasks 5–6) e `complete_onboarding` (Task 1, que não grava telefone). Se aparecer uma view, ajuste-a nesta migration.

- [ ] **Step 4: Apply + run checks**

Run:
```bash
npm run db:reset
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: check_3 `pass = t`; check_4 `NOTICE check_4_pass` (ou `check_4_skip` se houver <2 profiles no banco local — aceitável).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0038_profiles_private.sql scripts/checks/m7-1-identity.sql
git commit -m "feat(m7.1): mover telefone para profiles_private (RLS owner-only)"
```

---

## Task 3: Migration `0039_public_profiles.sql` — projeção pública

**Files:**
- Create: `supabase/migrations/0039_public_profiles.sql`
- Modify: `scripts/checks/m7-1-identity.sql` (check 5)

- [ ] **Step 1: Add failing check**

Edit `scripts/checks/m7-1-identity.sql` — antes do `ROLLBACK;`:

```sql
-- Check 5: public_profiles existe e NÃO expõe telefone.
SELECT 'check_5_public_profiles_no_phone' AS check,
       EXISTS (SELECT 1 FROM information_schema.views
               WHERE table_name = 'public_profiles')
   AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'public_profiles'
           AND column_name IN ('phone_e164','phone_hash','phone_verified_at')
       ) AS pass;
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: check_5 `pass = f` — view ainda não existe.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0039_public_profiles.sql`:

```sql
-- M7.1 — Projeção pública canônica de identidade. Expõe SÓ
-- user_id/username/display_name/avatar_url. NUNCA telefone. Toda leitura social
-- de identidade de terceiros passa por aqui. security_invoker → respeita RLS,
-- mas como só seleciona colunas não-sensíveis de profiles, é seguro para GRANT.
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
  SELECT user_id, username, full_name AS display_name, avatar_url
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Defesa em profundidade: leaderboard passa a juntar identidade via
-- public_profiles em vez de profiles direto. Mantém o resto da RPC de 0033.
CREATE OR REPLACE FUNCTION public.fitbrother_weekly_leaderboard(p_user_id uuid)
RETURNS TABLE (
  user_id       uuid,
  full_name     text,
  weekly_hits   int,
  window_streak int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  v_today := public.fitbrother_today(p_user_id);

  RETURN QUERY
  WITH network AS (
    SELECT p_user_id AS uid
    UNION
    SELECT f.followee_id FROM public.follows f WHERE f.follower_id = p_user_id
  ),
  hits AS (
    SELECT n.uid,
           count(*) FILTER (
             WHERE ds.goal_hit AND ds.day BETWEEN v_today - 7 AND v_today - 1
           )::int AS weekly_hits
    FROM network n
    LEFT JOIN public.daily_summaries ds ON ds.user_id = n.uid
    GROUP BY n.uid
  ),
  runs AS (
    SELECT n.uid,
           COALESCE((
             SELECT min(gs.offset_d)::int
             FROM generate_series(0, 6) AS gs(offset_d)
             WHERE NOT EXISTS (
               SELECT 1 FROM public.daily_summaries ds2
               WHERE ds2.user_id = n.uid
                 AND ds2.day = v_today - 1 - gs.offset_d
                 AND ds2.goal_hit
             )
           ), 7) AS window_streak
    FROM network n
  )
  SELECT n.uid,
         pp.display_name AS full_name,
         h.weekly_hits,
         r.window_streak
  FROM network n
  JOIN hits h    ON h.uid = n.uid
  JOIN runs r    ON r.uid = n.uid
  LEFT JOIN public.public_profiles pp ON pp.user_id = n.uid
  ORDER BY h.weekly_hits DESC, r.window_streak DESC;
END;
$$;
```

- [ ] **Step 4: Apply + run checks**

Run:
```bash
npm run db:reset
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: check_5 `pass = t`; checks 1–4 continuam passando.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0039_public_profiles.sql scripts/checks/m7-1-identity.sql
git commit -m "feat(m7.1): view public_profiles + leaderboard via public_profiles"
```

---

## Task 4: Migration `0040_post_images_bucket.sql` — bucket de imagem

**Files:**
- Create: `supabase/migrations/0040_post_images_bucket.sql`

- [ ] **Step 1: Add failing check**

Edit `scripts/checks/m7-1-identity.sql` — antes do `ROLLBACK;`:

```sql
-- Check 6: bucket post-images existe e é privado.
SELECT 'check_6_post_images_bucket' AS check,
       EXISTS (SELECT 1 FROM storage.buckets
               WHERE id = 'post-images' AND public = false) AS pass;
```

- [ ] **Step 2: Run to verify it fails**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: check_6 `pass = f`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0040_post_images_bucket.sql` (espelha o padrão de `0019_meal_audios_bucket.sql`):

```sql
-- M7.1 — Bucket privado de imagens (posts do feed + avatares). RLS por prefixo
-- {user_id}/ igual ao meal-audios. Avatares em {user_id}/avatar.*.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images', 'post-images', false, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "post_images_owner_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "post_images_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "post_images_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "post_images_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
```

> Confirme o nome das policies/colunas contra `0019_meal_audios_bucket.sql` — se lá usa um shape diferente (ex. `name` vs `objects`), espelhe exatamente.

- [ ] **Step 4: Apply + run checks**

Run:
```bash
npm run db:reset
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < scripts/checks/m7-1-identity.sql
```
Expected: check_6 `pass = t`; todos os checks 1–6 passam.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0040_post_images_bucket.sql scripts/checks/m7-1-identity.sql
git commit -m "feat(m7.1): bucket privado post-images (RLS por prefixo)"
```

---

## Task 5: Shared schemas — username, public profile, search, follow

**Files:**
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Add the schemas**

Edit `packages/shared/src/schemas.ts` — adicionar ao fim da seção social (após `LeaderboardResponseSchema`):

```ts
// ── M7.1 identidade & descoberta ────────────────────────────────────────────
export const UsernameSchema = z
  .string()
  .regex(/^[a-z0-9_.]{3,20}$/, "username: 3-20 chars, a-z 0-9 _ .");
export type Username = z.infer<typeof UsernameSchema>;

export const PublicProfileSchema = z.object({
  user_id: z.string().uuid(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export const UserSearchResponseSchema = z.object({
  users: z.array(PublicProfileSchema),
});
export type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;

export const UsernameAvailableResponseSchema = z.object({
  available: z.boolean(),
});
export type UsernameAvailableResponse = z.infer<typeof UsernameAvailableResponseSchema>;

export const FollowRequestSchema = z.object({
  followee_id: z.string().uuid(),
});
export type FollowRequest = z.infer<typeof FollowRequestSchema>;
```

- [ ] **Step 2: Extend the onboarding payload**

Edit `OnboardingPayloadSchema` em `packages/shared/src/schemas.ts` — adicionar dois campos opcionais após `full_name`:

```ts
  full_name: z.string().min(1),
  username: UsernameSchema.optional(),
  avatar_url: z.string().optional(),
```

> `UsernameSchema` é definido na Task 5 Step 1 mas usado aqui; mova a definição de `UsernameSchema` para **antes** de `OnboardingPayloadSchema` no arquivo (ou declare-o no topo da seção de schemas) para evitar uso antes da definição.

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS (sem erros).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat(m7.1): shared schemas para username/public profile/search/follow"
```

---

## Task 6: Backend — verify-phone + contacts usam `profiles_private`

**Files:**
- Modify: `apps/server/src/routes/me.ts:169-182` (update de telefone)
- Modify: `apps/server/src/services/contacts.ts` (`syncContacts`, `reverseMatchFollows`)
- Modify: `apps/server/src/routes/social.ts:24-31` (`/following` via `public_profiles`)

- [ ] **Step 1: Update verify-phone to write profiles_private**

Edit `apps/server/src/routes/me.ts` — substituir o bloco de `admin.from("profiles").update({...})` (linhas ~169-182). O `full_name` continua em `profiles`; o telefone vai pra `profiles_private` (upsert, pois a linha pode não existir):

```ts
    // full_name vive em profiles; telefone em profiles_private (isolado).
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) {
      req.log.error({ err: pErr }, "verify_phone_profile_read_failed");
      return reply.code(500).send({ error: pErr.message });
    }

    const { error: upErr } = await admin
      .from("profiles_private")
      .upsert(
        {
          user_id: userId,
          phone_e164: e164,
          phone_hash: phoneHash,
          phone_verified_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (upErr) {
      req.log.error({ err: upErr }, "verify_phone_update_failed");
      return reply.code(500).send({ error: upErr.message });
    }
```

> O restante do handler (reverse-match usando `prof?.full_name`) permanece igual.

- [ ] **Step 2: Update contacts service to read profiles_private**

Edit `apps/server/src/services/contacts.ts` — em `syncContacts`, o match (passo 2) e o `full_name`. Como `phone_hash`/`phone_verified_at` agora vivem em `profiles_private` e `full_name` em `profiles`, junta as duas:

```ts
  const CHUNK = 100;
  const matches: { user_id: string; full_name: string | null }[] = [];
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const slice = hashes.slice(i, i + CHUNK);
    const { data, error: mErr } = await supabase
      .from("profiles_private")
      .select("user_id, profiles!inner(full_name)")
      .in("phone_hash", slice)
      .not("phone_verified_at", "is", null)
      .neq("user_id", ownerId);
    if (mErr) throw new Error(mErr.message);
    if (data) {
      for (const row of data as Array<{ user_id: string; profiles: { full_name: string | null } }>) {
        matches.push({ user_id: row.user_id, full_name: row.profiles?.full_name ?? null });
      }
    }
  }
```

> Se o embed `profiles!inner(full_name)` não resolver (FK de `profiles_private` aponta para `auth.users`, não `profiles`), use duas queries: primeiro `profiles_private` filtrando por hash/verified → colete `user_id`s; depois `profiles.select("user_id, full_name").in("user_id", ids)`. Prefira a versão de duas queries se houver qualquer dúvida sobre o relacionamento de embed.

`reverseMatchFollows` não lê telefone (recebe `phoneHash` por parâmetro e lê `contact_links`), então **não muda**.

- [ ] **Step 3: Update /following to use public_profiles**

Edit `apps/server/src/routes/social.ts` — no handler `/following`, trocar a leitura de `profiles` por `public_profiles` e mapear `display_name`:

```ts
    const { data: profs, error: pErr } = await admin
      .from("public_profiles")
      .select("user_id, display_name")
      .in("user_id", ids);
    if (pErr) {
      req.log.error({ err: pErr }, "following_profiles_failed");
      return reply.code(500).send({ error: pErr.message });
    }
    const following = (profs ?? []).map((p) =>
      FollowedProfileSchema.parse({ user_id: p.user_id, full_name: p.display_name }),
    );
    return reply.send({ following });
```

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS. (Pode exigir `npm run db:types` da Task 8 antes, se o tipo gerado de `profiles_private`/`public_profiles` for usado pelo client tipado — se o typecheck reclamar de tabela desconhecida, rode a Task 8 primeiro e volte.)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/me.ts apps/server/src/services/contacts.ts apps/server/src/routes/social.ts
git commit -m "feat(m7.1): verify-phone e contacts usam profiles_private; following via public_profiles"
```

---

## Task 7: Backend — rotas de busca, disponibilidade e seguir

**Files:**
- Create: `apps/server/src/routes/users.ts`
- Modify: `apps/server/src/server.ts` (registrar rota)

- [ ] **Step 1: Write the users routes**

Create `apps/server/src/routes/users.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PublicProfileSchema, FollowRequestSchema } from "@fitbrother/shared";
import { authRequired } from "../lib/auth.js";
import { supabaseService } from "../lib/supabase.js";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(20),
});
const availableQuerySchema = z.object({
  u: z.string().trim().min(3).max(20),
});

export async function usersRoutes(app: FastifyInstance) {
  // Busca por username (prefixo, case-insensitive via citext). Via public_profiles
  // (nunca telefone). Exclui o próprio usuário. Limite 20.
  app.get("/users/search", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
    }
    const userId = req.user!.id;
    const { data, error } = await supabaseService()
      .from("public_profiles")
      .select("user_id, username, display_name, avatar_url")
      .ilike("username", `${parsed.data.q}%`)
      .neq("user_id", userId)
      .not("username", "is", null)
      .limit(20);
    if (error) {
      req.log.error({ err: error }, "user_search_failed");
      return reply.code(500).send({ error: error.message });
    }
    const users = (data ?? []).map((u) => PublicProfileSchema.parse(u));
    return reply.send({ users });
  });

  // Disponibilidade de username (onboarding). Formato validado no cliente;
  // aqui só checamos colisão.
  app.get("/users/username-available", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = availableQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
    }
    const { count, error } = await supabaseService()
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .ilike("username", parsed.data.u);
    if (error) {
      req.log.error({ err: error }, "username_available_failed");
      return reply.code(500).send({ error: error.message });
    }
    return reply.send({ available: (count ?? 0) === 0 });
  });

  // Seguir alguém (follow assimétrico). Idempotente.
  app.post("/follows", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = FollowRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_body" });
    }
    const userId = req.user!.id;
    if (parsed.data.followee_id === userId) {
      return reply.code(400).send({ error: "cannot_follow_self" });
    }
    const { error } = await supabaseService()
      .from("follows")
      .upsert(
        { follower_id: userId, followee_id: parsed.data.followee_id },
        { onConflict: "follower_id,followee_id", ignoreDuplicates: true },
      );
    if (error) {
      req.log.error({ err: error }, "follow_failed");
      return reply.code(500).send({ error: error.message });
    }
    return reply.code(204).send();
  });

  // Deixar de seguir.
  app.delete("/follows/:followeeId", { preHandler: [authRequired] }, async (req, reply) => {
    const followeeId = (req.params as { followeeId: string }).followeeId;
    const userId = req.user!.id;
    const { error } = await supabaseService()
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("followee_id", followeeId);
    if (error) {
      req.log.error({ err: error }, "unfollow_failed");
      return reply.code(500).send({ error: error.message });
    }
    return reply.code(204).send();
  });
}
```

- [ ] **Step 2: Register the route**

Edit `apps/server/src/server.ts` — importar e registrar `usersRoutes` junto das demais (espelhe como `socialRoutes`/`meRoutes` são registradas; mesmo prefixo/agrupamento):

```ts
import { usersRoutes } from "./routes/users.js";
// ... onde as outras rotas são registradas:
await app.register(usersRoutes);
```

> Abra `server.ts` e siga exatamente o padrão de registro existente (com/sem `{ prefix }`). Use o mesmo estilo de `socialRoutes`.

- [ ] **Step 3: Typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS.

- [ ] **Step 4: Manual smoke (server up)**

Run `npm run dev:server` e, com um JWT válido de dev:
```bash
curl -s "http://localhost:3000/users/username-available?u=disponivel123" -H "Authorization: Bearer $JWT"
# Esperado: {"available":true}
```
(Se não tiver JWT à mão, pule — coberto no e2e mobile.)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/users.ts apps/server/src/server.ts
git commit -m "feat(m7.1): rotas /users/search, /users/username-available, /follows"
```

---

## Task 8: Regenerar db-types

**Files:**
- Modify: `packages/db-types/index.ts` (gerado)

- [ ] **Step 1: Regenerate types**

Run (com supabase local up):
```bash
npm run db:types
```
Expected: `packages/db-types/index.ts` atualizado com `profiles_private`, `public_profiles`, `profiles.username/avatar_url` e sem as colunas de telefone em `profiles`.

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS (confirma que os serviços do server batem com o schema gerado).

- [ ] **Step 3: Commit**

```bash
git add packages/db-types/index.ts
git commit -m "chore(m7.1): regen db-types (profiles_private, public_profiles, username)"
```

---

## Task 9: Mobile — onboarding store + step de username

**Files:**
- Modify: `apps/mobile/lib/stores/onboardingStore.ts`
- Create: `apps/mobile/lib/api/users.ts`
- Create: `apps/mobile/lib/hooks/useUsernameAvailable.ts`
- Create: `apps/mobile/app/(onboarding)/step-9.tsx`
- Modify: `apps/mobile/app/(onboarding)/step-7.tsx` (reapontar navegação → step-9, mantendo step-8 como submit final)

- [ ] **Step 1: Add username/avatar to the onboarding store**

Edit `apps/mobile/lib/stores/onboardingStore.ts`:
- No `interface OnboardingState`, adicionar após `full_name`:
```ts
  username: string;
  avatar_url: string | undefined;
```
- No `INITIAL`, adicionar:
```ts
  username: "",
  avatar_url: undefined,
```
- No `toPayload`, incluir no objeto retornado (após `full_name`):
```ts
      username: s.username.trim() || undefined,
      avatar_url: s.avatar_url || undefined,
```

- [ ] **Step 2: Add the users API client**

Create `apps/mobile/lib/api/users.ts`:

```ts
import {
  UserSearchResponseSchema,
  UsernameAvailableResponseSchema,
  type PublicProfile,
} from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

type ApiError = Error & { status?: number };

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const res = await authedFetch(`/users/username-available?u=${encodeURIComponent(username)}`);
  const body = await parseOrThrow(res);
  return UsernameAvailableResponseSchema.parse(body).available;
}

export async function searchUsers(q: string): Promise<PublicProfile[]> {
  const res = await authedFetch(`/users/search?q=${encodeURIComponent(q)}`);
  const body = await parseOrThrow(res);
  return UserSearchResponseSchema.parse(body).users;
}

export async function followUser(followeeId: string): Promise<void> {
  const res = await authedFetch(`/follows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ followee_id: followeeId }),
  });
  if (!res.ok) await parseOrThrow(res);
}

export async function unfollowUser(followeeId: string): Promise<void> {
  const res = await authedFetch(`/follows/${encodeURIComponent(followeeId)}`, { method: "DELETE" });
  if (!res.ok) await parseOrThrow(res);
}
```

> Confirme a assinatura de `authedFetch` em `apps/mobile/lib/api.ts` (se aceita `(path, init?)`). Espelhe `lib/api/social.ts` se diferir.

- [ ] **Step 3: Add the availability hook (debounced)**

Create `apps/mobile/lib/hooks/useUsernameAvailable.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { checkUsernameAvailable } from "@/lib/api/users";

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function useUsernameAvailable(username: string) {
  const valid = USERNAME_RE.test(username);
  return useQuery({
    queryKey: ["username-available", username],
    queryFn: () => checkUsernameAvailable(username),
    enabled: valid,
    staleTime: 30_000,
  });
}

export { USERNAME_RE };
```

- [ ] **Step 4: Build the username step screen**

Create `apps/mobile/app/(onboarding)/step-9.tsx` seguindo o shell dos outros steps (use `OnboardingStepShell` + `OnboardingNavButtons`, espelhando `step-8.tsx`). Núcleo:

```tsx
import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { OnboardingNavButtons } from "@/components/OnboardingNavButtons";
import { Input } from "@/components/Input";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useUsernameAvailable, USERNAME_RE } from "@/lib/hooks/useUsernameAvailable";

export default function StepUsername() {
  const router = useRouter();
  const username = useOnboardingStore((s) => s.username);
  const setField = useOnboardingStore((s) => s.setField);
  const [touched, setTouched] = useState(false);

  const normalized = username.trim().toLowerCase();
  const formatOk = USERNAME_RE.test(normalized);
  const { data: available, isFetching } = useUsernameAvailable(normalized);
  const canContinue = formatOk && available === true;

  return (
    <OnboardingStepShell step={9} title="Escolha seu @username" subtitle="É como te encontram no app.">
      <View className="gap-2">
        <Input
          value={username}
          onChangeText={(t) => {
            setField("username", t.toLowerCase());
            setTouched(true);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ex: maria.silva"
        />
        {touched && !formatOk ? (
          <Text className="text-sm font-sans text-danger-500">
            3-20 caracteres: letras minúsculas, números, ponto ou _.
          </Text>
        ) : null}
        {formatOk && !isFetching && available === false ? (
          <Text className="text-sm font-sans text-danger-500">Esse username já está em uso.</Text>
        ) : null}
        {formatOk && available === true ? (
          <Text className="text-sm font-sans text-success-500">Disponível!</Text>
        ) : null}
      </View>
      <OnboardingNavButtons
        onBack={() => router.back()}
        onNext={() => router.push("/(onboarding)/step-8")}
        nextDisabled={!canContinue}
      />
    </OnboardingStepShell>
  );
}
```

> **Sequenciamento (ler `step-8.tsx` primeiro):** o onboarding hoje vai de `index` → `step-2` … → `step-8`, e o **step-8 é o passo final** (termos + submit via `POST /onboarding/complete`). Insira o username **antes** do submit, sem mover a lógica de submit:
> - Reaponte a navegação do step **anterior ao 8** (provavelmente `step-7`) para `→ step-9` (este novo), e o `onNext` do `step-9` para `→ step-8`. Assim a ordem vira `… → step-7 → step-9 (username) → step-8 (termos+submit)`.
> - Ajuste props (`step`, títulos, nomes reais de `OnboardingStepShell`/`OnboardingNavButtons`) ao que esses componentes expõem — copie o shape exato de `step-8.tsx`/`step-7.tsx`.
> - Garanta que `toPayload()` (que já inclui `username`/`avatar_url` após a Task 9 Step 1) é o que o step-8 envia — nenhuma mudança no submit é necessária além disso.
> - **Modifique `step-7.tsx`** (não `step-8.tsx`) para encadear o novo passo; ajuste o `git add` do Step 5 desta task de `step-8.tsx` para `step-7.tsx`.

- [ ] **Step 5: Typecheck + lint, then commit**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS.

```bash
git add apps/mobile/lib/stores/onboardingStore.ts apps/mobile/lib/api/users.ts apps/mobile/lib/hooks/useUsernameAvailable.ts "apps/mobile/app/(onboarding)/step-9.tsx" "apps/mobile/app/(onboarding)/step-7.tsx"
git commit -m "feat(m7.1): step de username no onboarding + api client + hook"
```

---

## Task 10: Mobile — avatar opcional no onboarding

**Files:**
- Modify: `apps/mobile/app/(onboarding)/step-9.tsx`
- Modify: `apps/mobile/lib/stores/onboardingStore.ts` (já tem `avatar_url`)
- Reference: `apps/mobile/lib/storage.ts` (padrão de upload), `apps/mobile/lib/supabase.ts`

- [ ] **Step 1: Add avatar picker + upload to the step**

No `step-9.tsx`, adicionar um botão de avatar opcional. Usa `expo-image-picker` (confirme se já é dependência; senão `npx expo install expo-image-picker`). Ao escolher, faz upload direto pro bucket `post-images` no prefixo `{user_id}/avatar.jpg` via supabase client (RLS permite o próprio prefixo) e guarda o path em `avatar_url`:

```tsx
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

async function pickAndUploadAvatar(userId: string, setField: (k: "avatar_url", v: string) => void) {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (res.canceled || !res.assets[0]) return;
  const asset = res.assets[0];
  const path = `${userId}/avatar.jpg`;
  const file = await fetch(asset.uri).then((r) => r.blob());
  const { error } = await supabase.storage.from("post-images").upload(path, file, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  setField("avatar_url", path);
}
```

> O `userId` vem da sessão Supabase (`supabase.auth.getUser()`), já que o onboarding roda autenticado. Renderize o avatar escolhido com fallback de iniciais (componente `Avatar` pode ser criado aqui ou no M7.2 — para o MVP do step basta mostrar a imagem selecionada ou um placeholder). O campo é **opcional**: o "Próximo" não depende dele.

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS.

- [ ] **Step 3: Manual e2e (device)**

Em device/simulador: completar onboarding escolhendo username + avatar → conferir no banco:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  -c "SELECT username, avatar_url FROM public.profiles ORDER BY created_at DESC LIMIT 1;"
```
Expected: linha com `username` e `avatar_url` preenchidos. Registrar resultado (não automatizável aqui).

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(onboarding)/step-9.tsx"
git commit -m "feat(m7.1): avatar opcional no onboarding (upload direto pro post-images)"
```

---

## Task 11: Mobile — tela de busca de usuários + seguir

**Files:**
- Create: `apps/mobile/lib/hooks/useUserSearch.ts`
- Create: `apps/mobile/app/(app)/users/search.tsx`
- Modify: `apps/mobile/components/domain/HomeHeader.tsx` (ícone de busca → rota)

- [ ] **Step 1: Add the search hook**

Create `apps/mobile/lib/hooks/useUserSearch.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "@/lib/api/users";

export function useUserSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ["user-search", trimmed],
    queryFn: () => searchUsers(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 2: Build the search screen**

Create `apps/mobile/app/(app)/users/search.tsx`:

```tsx
import { useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/Input";
import { useUserSearch } from "@/lib/hooks/useUserSearch";
import { followUser } from "@/lib/api/users";
import type { PublicProfile } from "@fitbrother/shared";

export default function UserSearch() {
  const [q, setQ] = useState("");
  const { data: users, isFetching } = useUserSearch(q);
  const qc = useQueryClient();
  const follow = useMutation({
    mutationFn: (id: string) => followUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["following"] }),
  });

  return (
    <View className="flex-1 bg-neutral-50 px-4 pt-4">
      <Input value={q} onChangeText={setQ} autoCapitalize="none" placeholder="Buscar por @username" />
      <FlatList
        data={users ?? []}
        keyExtractor={(u: PublicProfile) => u.user_id}
        ListEmptyComponent={
          q.trim().length >= 2 && !isFetching ? (
            <Text className="mt-6 text-center font-sans text-neutral-500">Ninguém encontrado.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between py-3">
            <Text className="font-sans-semibold text-neutral-800">@{item.username}</Text>
            <Pressable
              onPress={() => follow.mutate(item.user_id)}
              accessibilityRole="button"
              accessibilityLabel={`Seguir ${item.username}`}
              className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary-400 px-4"
            >
              <Text className="font-sans-semibold text-white">Seguir</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
```

> Reaproveite o `Avatar` (fallback iniciais) quando existir (M7.2). Tokens de cor via classes Tailwind; sem hex inline (regra de ouro).

- [ ] **Step 3: Wire a search entry point in the header**

Edit `apps/mobile/components/domain/HomeHeader.tsx` — adicionar um ícone `Search` (de `lucide-react-native`) que navega para `/(app)/users/search`, espelhando os Pressables existentes (Calendar/Users/User), com `accessibilityLabel="Buscar pessoas"` e `min-h/min-w [44px]`.

```tsx
import { Search } from "lucide-react-native";
// ...dentro da View de ícones, antes do Users:
<Pressable
  onPress={() => router.push("/(app)/users/search")}
  accessibilityLabel="Buscar pessoas"
  accessibilityRole="button"
  className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
>
  <Search size={22} color={colors.neutral[800]} />
</Pressable>
```

- [ ] **Step 4: Typecheck + lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS.

- [ ] **Step 5: Manual e2e (device) + commit**

Em device: abrir busca pelo header → digitar username de outro usuário de teste → "Seguir" → conferir em `/following` (tela Amigos) que o seguido aparece. Registrar resultado.

```bash
git add apps/mobile/lib/hooks/useUserSearch.ts "apps/mobile/app/(app)/users/search.tsx" apps/mobile/components/domain/HomeHeader.tsx
git commit -m "feat(m7.1): tela de busca de usuários por username + seguir"
```

---

## Verificação final do M7.1

- [ ] `npm run db:reset && ./scripts/checks/m7-1-identity.sh` → todos os checks 1–6 passam.
- [ ] `npm run typecheck && npm run lint` → limpos.
- [ ] e2e manual: novo usuário escolhe username (+ avatar opcional) no onboarding; busca acha e segue outro usuário; telefone vive em `profiles_private` (validar via SQL com JWT de terceiro que não lê).
- [ ] Atualizar `docs/PLAN.md` §M7 com a linha de **Status M7.1** (espelhando o formato dos status de M5.x), descrevendo migrations `0037–0040`, rotas novas e o que ficou para M7.2.

**Feito quando:** os critérios acima passam e o Status do M7.1 está registrado no PLAN.md.
```

> **Out of scope (M7.2/M7.3):** posts/feed, foto no post, top tab bar `Hoje | Feed`, likes, comentários, notificações sociais — planos próprios.
