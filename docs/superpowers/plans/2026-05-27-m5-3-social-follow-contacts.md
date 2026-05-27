# M5.3 — Social (follow por contatos, leaderboard, conquistas, alertas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a gamificação social do Fitbrother com follow assimétrico descoberto por contatos do telefone (gate por OTP/SMS), ranking semanal privado, tela de conquistas, estado "em risco" do streak e crons de alerta.

**Architecture:** Reusa três padrões do repo: cron = `pg-boss` agendando função SQL `SECURITY DEFINER` (igual `streak-tick`); notificação = INSERT em `notifications` (outbox) drenado pelo worker `dispatch-notification` via Expo Push; escrita sensível = rota Fastify com `user_id` do JWT + `supabaseService()`. Toda lógica de boundary/seleção vive em SQL. Privacidade: só hashes de telefone trafegam; views/leaderboard nunca expõem macros.

**Tech Stack:** Supabase (Postgres + Auth phone OTP), Fastify + pg-boss, React Native/Expo (expo-contacts, expo-crypto, libphonenumber-js, React Query, NativeWind), zod (`@fitbrother/shared`).

**Spec:** `docs/superpowers/specs/2026-05-27-m5-3-social-follow-contacts-design.md`

**Verificação:** o repo não tem framework de testes. O padrão (M5.1/M5.2) é: lógica SQL validada por scripts em `scripts/checks/*.sql` rodados via `docker exec ... psql`, backend por curl com JWT, mobile por `npm run typecheck` + `npm run lint` + validação visual manual (OTP/contatos exigem device real). Cada task abaixo segue esse padrão.

**Pré-condições para rodar checks:** `npm run db:start` (Supabase local up; container `supabase_db_fitbrother`), `npm run db:reset` aplica migrations. Server em `:3000` via `npm run dev:server`.

---

## File Structure

**Migrations (novas, `supabase/migrations/`):**
- `0030_follows.sql` — tabela `follows` + RLS.
- `0031_contact_links.sql` — grafo de contatos hasheado + RLS.
- `0032_profiles_phone_hash.sql` — coluna `profiles.phone_hash` + index.
- `0033_following_view_and_leaderboard.sql` — `following_summaries_view` + RPC `fitbrother_weekly_leaderboard`.
- `0034_achievements_follows.sql` — `fitbrother_evaluate_achievements` com `friends_total` real + trigger em `follows`.
- `0035_alerts.sql` — `fitbrother_streak_alert()` + `fitbrother_goal_reminder()`.
- `0036_streak_at_risk.sql` — `fitbrother_streak_at_risk(uuid)`.

**Backend (`apps/server/src/`):**
- `routes/me.ts` — MODIFICAR: `POST /me/verify-phone`; estender `GET /me/streak` com `at_risk`.
- `routes/contacts.ts` — CRIAR: `POST /contacts/sync`.
- `routes/social.ts` — CRIAR: `GET /following`, `GET /leaderboard/weekly`.
- `services/contacts.ts` — CRIAR: lógica de sync + reverse-match.
- `services/notifications.ts` — MODIFICAR: `renderPush` para `streak_alert`/`goal_reminder`/`friend_activity`.
- `workers/streak-alert.ts`, `workers/goal-reminder.ts` — CRIAR.
- `server.ts` — MODIFICAR: registrar rotas e workers novos.

**Shared (`packages/shared/src/schemas.ts`):** novos schemas + `at_risk` no streak response.

**Mobile (`apps/mobile/`):**
- `lib/contacts.ts` — CRIAR: leitura + normalização E.164 + hash SHA-256.
- `lib/api/social.ts` — CRIAR: chamadas de rede.
- `lib/api/me.ts` — MODIFICAR: `fetchStreak` retorna `{ streak, atRisk }`; `verifyPhone`.
- `lib/hooks/{useFollowing,useWeeklyLeaderboard,useVerifyPhone,useSyncContacts}.ts` — CRIAR.
- `lib/hooks/useStreak.ts` — MODIFICAR (tipo de retorno).
- `components/domain/LeaderboardRow.tsx` — CRIAR.
- `components/domain/HomeHeader.tsx` — MODIFICAR (wiring `atRisk`).
- `app/(app)/friends.tsx` — REESCREVER (máquina de estados verify → connect → list+leaderboard).
- `app/(app)/achievements.tsx` — CRIAR.
- `app/(app)/profile.tsx` — MODIFICAR (entrada para conquistas).
- `app/(app)/_layout.tsx` — MODIFICAR (registrar screen `achievements`).

**Config:** `supabase/config.toml` (`[auth.sms]` + `[auth.sms.test_otp]`), `.env.example`.

**Verificação:** `scripts/checks/m5-3-social.sql` + `scripts/checks/m5-3-social.sh`.

---

## Fase A — Camada de dados

### Task 1: Migration `follows`

**Files:**
- Create: `supabase/migrations/0030_follows.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- M5.3 — Follow assimétrico (estilo Duolingo). Substitui o friendships
-- (pedido→aceite) rascunhado em FEATURES §3.4. Não há aceite: seguir é
-- unilateral. O leaderboard agrega quem o usuário segue.
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> followee_id)
);

-- Reverse-lookup (quem segue X) e contagem de seguidores.
CREATE INDEX follows_followee_idx ON public.follows (followee_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Vejo os follows em que eu sou uma das pontas (quem sigo + quem me segue).
CREATE POLICY follows_participant_read
  ON public.follows
  FOR SELECT
  USING (auth.uid() IN (follower_id, followee_id));
-- Escrita só via service-role (rotas /contacts/sync e reverse-match).
```

- [ ] **Step 2: Aplicar e verificar que sobe limpo**

Run: `npm run db:reset`
Expected: termina sem erro; saída lista `Applying migration 0030_follows.sql...`.

- [ ] **Step 3: Verificar constraint anti-self e PK via psql**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
"DO \$\$ DECLARE u uuid; BEGIN SELECT id INTO u FROM auth.users LIMIT 1; IF u IS NULL THEN RAISE NOTICE 'skip: no users'; RETURN; END IF; BEGIN INSERT INTO public.follows(follower_id,followee_id) VALUES (u,u); RAISE EXCEPTION 'FAIL: self-follow permitido'; EXCEPTION WHEN check_violation THEN RAISE NOTICE 'pass: self-follow bloqueado'; END; END \$\$;"
```
Expected: `NOTICE: pass: self-follow bloqueado` (ou `skip` se DB vazio).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0030_follows.sql
git commit -m "M5.3 db — follows table (follow assimétrico)"
```

---

### Task 2: Migration `contact_links`

**Files:**
- Create: `supabase/migrations/0031_contact_links.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- M5.3 — Grafo de contatos hasheado. O app normaliza os números pra E.164 e
-- envia SHA-256 (hex, lowercase) — números em claro nunca chegam ao servidor.
-- Guardar o grafo habilita o reverse-match: quando alguém verifica o telefone,
-- todo dono que tinha o número dele passa a segui-lo automaticamente.
CREATE TABLE public.contact_links (
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, phone_hash)
);

-- Reverse-lookup: "quem tem ESTE hash na agenda?" (na verificação de telefone).
CREATE INDEX contact_links_phone_hash_idx ON public.contact_links (phone_hash);

ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

-- Owner-only. Escrita via service-role (rota /contacts/sync).
CREATE POLICY contact_links_owner_read
  ON public.contact_links
  FOR SELECT
  USING (auth.uid() = owner_id);
```

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`
Expected: aplica `0031_contact_links.sql` sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0031_contact_links.sql
git commit -m "M5.3 db — contact_links (grafo de contatos hasheado)"
```

---

### Task 3: Migration `profiles.phone_hash`

**Files:**
- Create: `supabase/migrations/0032_profiles_phone_hash.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- M5.3 — phone_hash em profiles. Gravado quando o telefone é verificado
-- (POST /me/verify-phone): SHA-256 hex do phone_e164. É a chave que casa contra
-- contact_links.phone_hash. phone_e164 já é UNIQUE (0003), então dois usuários
-- não podem verificar o mesmo número.
ALTER TABLE public.profiles ADD COLUMN phone_hash text;
CREATE INDEX profiles_phone_hash_idx ON public.profiles (phone_hash)
  WHERE phone_hash IS NOT NULL;
```

- [ ] **Step 2: Aplicar e conferir coluna**

Run:
```bash
npm run db:reset && docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
"SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone_hash';"
```
Expected: 1 linha `phone_hash`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0032_profiles_phone_hash.sql
git commit -m "M5.3 db — profiles.phone_hash"
```

---

### Task 4: Migration `following_summaries_view` + RPC `fitbrother_weekly_leaderboard`

**Files:**
- Create: `supabase/migrations/0033_following_view_and_leaderboard.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- M5.3 — View de privacidade + RPC do leaderboard.
--
-- following_summaries_view: expõe APENAS day/goal_hit/meals_count de quem o
-- caller segue. NUNCA macros (FEATURES §3.5). security_invoker → respeita o RLS
-- de follows do caller.
CREATE VIEW public.following_summaries_view
WITH (security_invoker = true) AS
  SELECT ds.user_id AS followee_id, ds.day, ds.goal_hit, ds.meals_count
  FROM public.follows f
  JOIN public.daily_summaries ds ON ds.user_id = f.followee_id
  WHERE f.follower_id = auth.uid();

GRANT SELECT ON public.following_summaries_view TO authenticated;

-- RPC do leaderboard semanal. SECURITY DEFINER (chamado pelo backend com
-- service-role passando p_user_id). Agrega p_user_id + quem ele segue.
--   weekly_hits   = nº de goal_hit nas últimas 7 noites nutricionais.
--   window_streak = run consecutivo de goal_hit terminando no último dia
--                   fechado, LIMITADO à janela de 7 dias. Derivado de
--                   daily_summaries — não lê a tabela streaks de terceiros,
--                   então não vaza o streak privado.
-- Retorna só agregados — nenhum macro.
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
  v_today := public.fitbrother_today(p_user_id);  -- dia nutricional atual

  RETURN QUERY
  WITH network AS (
    SELECT p_user_id AS uid
    UNION
    SELECT f.followee_id FROM public.follows f WHERE f.follower_id = p_user_id
  ),
  -- Janela = 7 noites fechadas: [today-7, today-1].
  hits AS (
    SELECT n.uid,
           count(*) FILTER (
             WHERE ds.goal_hit AND ds.day BETWEEN v_today - 7 AND v_today - 1
           )::int AS weekly_hits
    FROM network n
    LEFT JOIN public.daily_summaries ds ON ds.user_id = n.uid
    GROUP BY n.uid
  ),
  -- window_streak: dias consecutivos com goal_hit terminando em today-1,
  -- limitado a 7. Acha o 1º offset (0..6, onde 0 = today-1) que NÃO bateu —
  -- esse offset é exatamente o tamanho do run a partir do fim. Se todos os 7
  -- bateram, min() é NULL → COALESCE 7.
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
         pr.full_name,
         h.weekly_hits,
         r.window_streak
  FROM network n
  JOIN hits h    ON h.uid = n.uid
  JOIN runs r    ON r.uid = n.uid
  LEFT JOIN public.profiles pr ON pr.user_id = n.uid
  ORDER BY h.weekly_hits DESC, r.window_streak DESC;
END;
$$;
```

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`
Expected: aplica `0033_*` sem erro.

- [ ] **Step 3: Verificar privacidade da view (zero colunas de macro)**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
"SELECT string_agg(column_name, ',') AS cols FROM information_schema.columns WHERE table_name='following_summaries_view';"
```
Expected: `cols = followee_id,day,goal_hit,meals_count` (nenhuma coluna `kcal`/`protein_g`/`carbs_g`/`fat_g`).

- [ ] **Step 4: Verificar que a RPC roda e retorna o próprio usuário**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
"DO \$\$ DECLARE u uuid; r record; BEGIN SELECT user_id INTO u FROM public.profiles LIMIT 1; IF u IS NULL THEN RAISE NOTICE 'skip: no profiles'; RETURN; END IF; SELECT * INTO r FROM public.fitbrother_weekly_leaderboard(u) WHERE user_id=u; IF r.user_id IS NULL THEN RAISE EXCEPTION 'FAIL: usuário ausente do próprio leaderboard'; END IF; RAISE NOTICE 'pass: leaderboard inclui self (hits=%, streak=%)', r.weekly_hits, r.window_streak; END \$\$;"
```
Expected: `NOTICE: pass: leaderboard inclui self ...` (ou `skip`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0033_following_view_and_leaderboard.sql
git commit -m "M5.3 db — following_summaries_view + weekly leaderboard RPC"
```

---

### Task 5: Migration achievements `friends_total` + trigger em `follows`

**Files:**
- Create: `supabase/migrations/0034_achievements_follows.sql`

- [ ] **Step 1: Escrever a migration (CREATE OR REPLACE da função 0028 com `friends_total` real + trigger)**

```sql
-- M5.3 — Liga friends_total às follows e reavalia conquistas ao seguir.
-- Substitui o hardcoded 0::bigint da 0028 por count(*) de follows do usuário.
-- A conquista 'first_friend' (friends_total>=1) passa a desbloquear no 1º follow.
CREATE OR REPLACE FUNCTION public.fitbrother_evaluate_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  WITH metrics AS (
    SELECT
      COALESCE((SELECT s.current_streak FROM public.streaks s
                WHERE s.user_id = p_user_id), 0) AS streak,
      (SELECT count(*) FROM public.meals m
        WHERE m.user_id = p_user_id
          AND m.deleted_at IS NULL
          AND m.review_required = false) AS meals_total,
      (SELECT count(*) FROM public.meals m
        WHERE m.user_id = p_user_id
          AND m.deleted_at IS NULL
          AND m.review_required = false
          AND m.source IN ('wa_text', 'wa_audio')) AS wa_meals_total,
      (SELECT count(*) FROM public.daily_summaries ds
        WHERE ds.user_id = p_user_id
          AND ds.goal_hit
          AND ds.day > public.fitbrother_today(p_user_id) - 7) AS weekly_hits,
      (SELECT count(*) FROM public.daily_summaries ds
        WHERE ds.user_id = p_user_id
          AND ds.meals_count > 0) AS days_active,
      (SELECT count(*) FROM public.follows f
        WHERE f.follower_id = p_user_id) AS friends_total
  ),
  unlocked AS (
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT p_user_id, a.id
    FROM public.achievements a, metrics m
    WHERE
      CASE a.criteria_json->>'type'
        WHEN 'streak'         THEN m.streak         >= (a.criteria_json->>'value')::int
        WHEN 'meals_total'    THEN m.meals_total    >= (a.criteria_json->>'value')::int
        WHEN 'wa_meals_total' THEN m.wa_meals_total >= (a.criteria_json->>'value')::int
        WHEN 'weekly_hits'    THEN m.weekly_hits    >= (a.criteria_json->>'value')::int
        WHEN 'days_active'    THEN m.days_active     >= (a.criteria_json->>'value')::int
        WHEN 'friends_total'  THEN m.friends_total  >= (a.criteria_json->>'value')::int
        ELSE false
      END
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id
  )
  INSERT INTO public.notifications (user_id, channel, kind, template, payload)
  SELECT
    p_user_id, 'push', 'achievement', 'achievement_unlocked',
    jsonb_build_object('code', a.code, 'title', a.title, 'icon', a.icon)
  FROM unlocked u
  JOIN public.achievements a ON a.id = u.achievement_id;
END;
$$;

-- Reavalia o follower ao criar um follow (desbloqueia 'first_friend').
CREATE OR REPLACE FUNCTION public.fitbrother_follows_achievements_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fitbrother_evaluate_achievements(NEW.follower_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_eval_achievements_follows
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.fitbrother_follows_achievements_trigger();
```

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`
Expected: aplica `0034_*` sem erro.

- [ ] **Step 3: Verificar que 1º follow desbloqueia `first_friend`**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
"DO \$\$ DECLARE a uuid; b uuid; n int; BEGIN SELECT id INTO a FROM auth.users LIMIT 1; SELECT id INTO b FROM auth.users OFFSET 1 LIMIT 1; IF a IS NULL OR b IS NULL THEN RAISE NOTICE 'skip: need 2 users'; RETURN; END IF; DELETE FROM public.follows WHERE follower_id=a AND followee_id=b; DELETE FROM public.user_achievements WHERE user_id=a AND achievement_id=(SELECT id FROM public.achievements WHERE code='first_friend'); INSERT INTO public.follows(follower_id,followee_id) VALUES (a,b); SELECT count(*) INTO n FROM public.user_achievements ua JOIN public.achievements ac ON ac.id=ua.achievement_id WHERE ua.user_id=a AND ac.code='first_friend'; IF n<>1 THEN RAISE EXCEPTION 'FAIL: first_friend não desbloqueou (n=%)', n; END IF; RAISE NOTICE 'pass: first_friend desbloqueado no 1o follow'; END \$\$;"
```
Expected: `NOTICE: pass: first_friend desbloqueado no 1o follow` (ou `skip`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0034_achievements_follows.sql
git commit -m "M5.3 db — achievements friends_total via follows + trigger"
```

---

### Task 6: Migration alertas (`streak_alert` + `goal_reminder`)

**Files:**
- Create: `supabase/migrations/0035_alerts.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- M5.3 — Funções de alerta (cron horário). Espelham fitbrother_streak_tick:
-- a função escolhe quem está no horário LOCAL certo; o pg-boss só agenda
-- hora-cheia UTC. Idempotentes por dia nutricional.
--
-- streak_alert (21h local): streak vivo (last_hit_day = ontem nutricional) e
-- hoje ainda sem goal_hit → push de risco. Inserindo notifications(channel=push)
-- o worker dispatch-notification já existente faz o envio.
CREATE OR REPLACE FUNCTION public.fitbrother_streak_alert()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  record;
  v_today date;
  v_hit   boolean;
  v_count int := 0;
BEGIN
  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE EXTRACT(HOUR FROM now() AT TIME ZONE p.timezone)::int = 21
  LOOP
    v_today := public.fitbrother_today(v_user.user_id);

    -- streak vivo terminando ontem?
    IF NOT EXISTS (
      SELECT 1 FROM public.streaks s
      WHERE s.user_id = v_user.user_id
        AND s.current_streak > 0
        AND s.last_hit_day = v_today - 1
    ) THEN
      CONTINUE;
    END IF;

    -- já bateu hoje? então não há risco.
    SELECT ds.goal_hit INTO v_hit FROM public.daily_summaries ds
    WHERE ds.user_id = v_user.user_id AND ds.day = v_today;
    IF COALESCE(v_hit, false) THEN
      CONTINUE;
    END IF;

    -- dedupe: 1 streak_alert por dia (cron pode reexecutar na mesma hora).
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_user.user_id
        AND n.kind = 'streak_alert'
        AND n.created_at > now() - interval '20 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, channel, kind, template, payload)
    VALUES (v_user.user_id, 'push', 'streak_alert', 'streak_at_risk',
            jsonb_build_object('current_streak',
              (SELECT current_streak FROM public.streaks WHERE user_id = v_user.user_id)));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- goal_reminder (19h local): kcal < 70% da meta E janela WA aberta.
-- WA-gated → dormente enquanto M4 (WhatsApp) está pausado: insere
-- channel='wa', que o dispatch atual ignora. Idempotente por dia.
CREATE OR REPLACE FUNCTION public.fitbrother_goal_reminder()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  record;
  v_today date;
  v_sum   record;
  v_count int := 0;
BEGIN
  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE EXTRACT(HOUR FROM now() AT TIME ZONE p.timezone)::int = 19
      AND p.wa_window_expires_at > now()           -- janela WA aberta
  LOOP
    v_today := public.fitbrother_today(v_user.user_id);

    SELECT ds.kcal, ds.goal_kcal INTO v_sum FROM public.daily_summaries ds
    WHERE ds.user_id = v_user.user_id AND ds.day = v_today;

    IF v_sum.goal_kcal IS NULL OR v_sum.goal_kcal = 0 THEN CONTINUE; END IF;
    IF v_sum.kcal >= v_sum.goal_kcal * 0.70 THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_user.user_id
        AND n.kind = 'goal_reminder'
        AND n.created_at > now() - interval '20 hours'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, channel, kind, template, payload)
    VALUES (v_user.user_id, 'wa', 'goal_reminder', 'goal_behind',
            jsonb_build_object('kcal', v_sum.kcal, 'goal_kcal', v_sum.goal_kcal));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
```

> **Nota de schema:** confirme que `daily_summaries` tem colunas `kcal` e `goal_kcal` (estão no `DailySummarySchema` do shared e na migration 0014). Se o nome divergir, ajuste o SELECT.

- [ ] **Step 2: Aplicar**

Run: `npm run db:reset`
Expected: aplica `0035_*` sem erro.

- [ ] **Step 3: Verificar idempotência do streak_alert (rodar 2x → 1 notificação)**

Run:
```bash
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
"SELECT public.fitbrother_streak_alert(); SELECT public.fitbrother_streak_alert(); SELECT 'pass: streak_alert idempotente (sem erro, dedupe por 20h)' AS result;"
```
Expected: duas chamadas retornam um int sem erro; segunda não duplica (dedupe na função). Imprime `pass`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0035_alerts.sql
git commit -m "M5.3 db — alertas streak_alert (push) + goal_reminder (WA dormente)"
```

---

### Task 7: Migration `fitbrother_streak_at_risk`

**Files:**
- Create: `supabase/migrations/0036_streak_at_risk.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- M5.3 — at_risk do StreakCounter (§12.4). True quando: streak vivo (>0),
-- hoje ainda sem goal_hit, e estamos dentro de 4h do próximo boundary
-- (timezone + day_start_hour do usuário).
CREATE OR REPLACE FUNCTION public.fitbrother_streak_at_risk(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz        text;
  v_dsh       int;
  v_streak    int;
  v_today     date;
  v_hit       boolean;
  v_now_local timestamp;
  v_boundary  timestamp;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  SELECT timezone, day_start_hour INTO v_tz, v_dsh
  FROM public.profiles WHERE user_id = p_user_id;
  IF v_tz IS NULL THEN RETURN false; END IF;

  SELECT current_streak INTO v_streak FROM public.streaks WHERE user_id = p_user_id;
  IF COALESCE(v_streak, 0) = 0 THEN RETURN false; END IF;

  v_today := public.fitbrother_today(p_user_id);
  SELECT ds.goal_hit INTO v_hit FROM public.daily_summaries ds
  WHERE ds.user_id = p_user_id AND ds.day = v_today;
  IF COALESCE(v_hit, false) THEN RETURN false; END IF;  -- já bateu hoje

  v_now_local := now() AT TIME ZONE v_tz;  -- hora de parede local como timestamp
  v_boundary  := date_trunc('day', v_now_local) + make_interval(hours => v_dsh);
  IF v_now_local >= v_boundary THEN
    v_boundary := v_boundary + interval '1 day';
  END IF;

  RETURN (v_boundary - v_now_local) <= interval '4 hours';
END;
$$;
```

- [ ] **Step 2: Aplicar e checar que retorna boolean sem erro**

Run:
```bash
npm run db:reset && docker exec -i supabase_db_fitbrother psql -U postgres -d postgres -c \
"DO \$\$ DECLARE u uuid; r boolean; BEGIN SELECT user_id INTO u FROM public.profiles LIMIT 1; IF u IS NULL THEN RAISE NOTICE 'skip'; RETURN; END IF; SELECT public.fitbrother_streak_at_risk(u) INTO r; RAISE NOTICE 'pass: at_risk(%) = %', u, r; END \$\$;"
```
Expected: `NOTICE: pass: at_risk(...) = f` (ou `t`/`skip`), sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0036_streak_at_risk.sql
git commit -m "M5.3 db — fitbrother_streak_at_risk"
```

---

## Fase B — Schemas compartilhados

### Task 8: Novos schemas em `@fitbrother/shared`

**Files:**
- Modify: `packages/shared/src/schemas.ts`

- [ ] **Step 1: Adicionar `at_risk` ao streak response e os schemas sociais**

Localize `StreakResponseSchema` e substitua por (mantendo `StreakSchema` intacto — ela espelha a TABELA, então não pode ganhar `at_risk`):

```ts
export const StreakResponseSchema = z.object({
  streak: StreakSchema,
  at_risk: z.boolean(),
});
export type StreakResponse = z.infer<typeof StreakResponseSchema>;
```

Ao final do arquivo, adicione:

```ts
// ── M5.3 social ────────────────────────────────────────────────────────────
export const ContactsSyncRequestSchema = z.object({
  // hashes SHA-256 hex (lowercase) de números E.164, gerados no device.
  hashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(5000),
});
export type ContactsSyncRequest = z.infer<typeof ContactsSyncRequestSchema>;

export const FollowedProfileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
});
export type FollowedProfile = z.infer<typeof FollowedProfileSchema>;

export const ContactsSyncResponseSchema = z.object({
  followed: z.array(FollowedProfileSchema),
});
export type ContactsSyncResponse = z.infer<typeof ContactsSyncResponseSchema>;

export const FollowingResponseSchema = z.object({
  following: z.array(FollowedProfileSchema),
});
export type FollowingResponse = z.infer<typeof FollowingResponseSchema>;

export const LeaderboardRowSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  weekly_hits: z.number().int(),
  window_streak: z.number().int(),
  is_me: z.boolean(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

export const LeaderboardResponseSchema = z.object({
  rows: z.array(LeaderboardRowSchema),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;
```

- [ ] **Step 2: Conferir export no index**

Run: `grep -n "schemas" packages/shared/src/index.ts`
Expected: `export * from "./schemas.js"` (ou similar). Se os schemas já são re-exportados por wildcard, nada a fazer. Caso contrário, adicione os novos nomes ao index.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa sem erros.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/index.ts
git commit -m "M5.3 shared — schemas sociais + at_risk no streak response"
```

---

## Fase C — Backend

### Task 9: `POST /me/verify-phone` + reverse-match + `at_risk` no streak

**Files:**
- Modify: `apps/server/src/routes/me.ts`
- Create: `apps/server/src/services/contacts.ts` (função de reverse-match reusada na Task 10)

- [ ] **Step 1: Criar `services/contacts.ts` com o reverse-match**

```ts
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** SHA-256 hex (lowercase) de um E.164 — mesma normalização do device. */
export function hashE164(e164: string): string {
  return createHash("sha256").update(e164).digest("hex");
}

/**
 * Reverse-match: ao verificar o telefone, todo dono que tinha ESTE número na
 * agenda (contact_links) passa a seguir o recém-verificado. Idempotente
 * (ON CONFLICT). Enfileira friend_activity push pra cada novo seguidor.
 */
export async function reverseMatchFollows(
  supabase: SupabaseClient,
  newUserId: string,
  phoneHash: string,
  fullName: string | null,
): Promise<number> {
  const { data: owners, error } = await supabase
    .from("contact_links")
    .select("owner_id")
    .eq("phone_hash", phoneHash)
    .neq("owner_id", newUserId);
  if (error) throw new Error(error.message);
  if (!owners || owners.length === 0) return 0;

  const rows = owners.map((o) => ({ follower_id: o.owner_id, followee_id: newUserId }));
  const { error: insErr } = await supabase
    .from("follows")
    .upsert(rows, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  if (insErr) throw new Error(insErr.message);

  const notifs = owners.map((o) => ({
    user_id: o.owner_id,
    channel: "push" as const,
    kind: "friend_activity" as const,
    template: "contact_joined",
    payload: { followee_id: newUserId, full_name: fullName },
  }));
  await supabase.from("notifications").insert(notifs);

  return owners.length;
}
```

- [ ] **Step 2: Adicionar `POST /me/verify-phone` em `me.ts`**

No topo de `me.ts`, adicione aos imports:
```ts
import { supabaseService } from "../lib/supabase.js";
import { hashE164, reverseMatchFollows } from "../services/contacts.js";
```

Dentro de `meRoutes`, adicione a rota:
```ts
  // Confirma a verificação de telefone feita via Supabase Auth (phone OTP).
  // Não confia no cliente: lê auth.users.phone_confirmed_at via service-role e
  // SÓ ENTÃO carimba profiles (verified + e164 + hash) e dispara reverse-match.
  app.post("/me/verify-phone", { preHandler: [authRequired] }, async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();

    const { data: udata, error: uerr } = await admin.auth.admin.getUserById(userId);
    if (uerr || !udata.user) {
      req.log.error({ err: uerr }, "verify_phone_getuser_failed");
      return reply.code(500).send({ error: "could_not_read_user" });
    }
    const phone = udata.user.phone; // E.164 sem '+' no Supabase? normaliza abaixo
    const confirmed = udata.user.phone_confirmed_at;
    if (!phone || !confirmed) {
      return reply.code(409).send({ error: "phone_not_confirmed" });
    }

    // Supabase guarda phone sem '+'. Normaliza pra E.164 com '+'.
    const e164 = phone.startsWith("+") ? phone : `+${phone}`;
    const phoneHash = hashE164(e164);

    const { data: prof, error: upErr } = await admin
      .from("profiles")
      .update({ phone_e164: e164, phone_verified_at: new Date().toISOString(), phone_hash: phoneHash })
      .eq("user_id", userId)
      .select("full_name")
      .maybeSingle();
    if (upErr) {
      req.log.error({ err: upErr }, "verify_phone_update_failed");
      return reply.code(500).send({ error: upErr.message });
    }

    try {
      const followers = await reverseMatchFollows(admin, userId, phoneHash, prof?.full_name ?? null);
      req.log.info({ userId, followers }, "verify_phone_reverse_match");
    } catch (err) {
      // reverse-match é aditivo: não derruba a verificação.
      req.log.error({ err }, "verify_phone_reverse_match_failed");
    }

    return reply.code(204).send();
  });
```

- [ ] **Step 3: Estender `GET /me/streak` com `at_risk`**

Substitua a rota `GET /me/streak` existente por:
```ts
  app.get("/me/streak", { preHandler: [authRequired] }, async (req, reply) => {
    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);

    const [streakQ, riskQ] = await Promise.all([
      supabase.from("streaks").select("*").maybeSingle(),
      supabase.rpc("fitbrother_streak_at_risk", { p_user_id: userId }),
    ]);
    if (streakQ.error) {
      req.log.error({ err: streakQ.error }, "streak_query_failed");
      return reply.code(500).send({ error: streakQ.error.message });
    }

    const streak: Streak = streakQ.data
      ? StreakSchema.parse(streakQ.data)
      : {
          user_id: userId,
          current_streak: 0,
          longest_streak: 0,
          last_hit_day: null,
          freezes_available: 0,
          updated_at: new Date().toISOString(),
        };

    return reply.send({ streak, at_risk: riskQ.data === true });
  });
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/me.ts apps/server/src/services/contacts.ts
git commit -m "M5.3 server — /me/verify-phone + reverse-match + at_risk no streak"
```

---

### Task 10: `POST /contacts/sync`

**Files:**
- Create: `apps/server/src/routes/contacts.ts`
- Modify: `apps/server/src/services/contacts.ts` (adicionar `syncContacts`)

- [ ] **Step 1: Adicionar `syncContacts` em `services/contacts.ts`**

```ts
/**
 * Upsert dos hashes da agenda do dono + cria follows pros que já são usuários
 * verificados. Retorna os perfis recém/atualmente seguidos por esse match.
 */
export async function syncContacts(
  supabase: SupabaseClient,
  ownerId: string,
  hashes: string[],
): Promise<{ user_id: string; full_name: string | null }[]> {
  if (hashes.length === 0) return [];

  // 1. Guarda o grafo (idempotente).
  const links = hashes.map((h) => ({ owner_id: ownerId, phone_hash: h }));
  const { error: linkErr } = await supabase
    .from("contact_links")
    .upsert(links, { onConflict: "owner_id,phone_hash", ignoreDuplicates: true });
  if (linkErr) throw new Error(linkErr.message);

  // 2. Casa hashes contra usuários verificados.
  const { data: matches, error: mErr } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("phone_hash", hashes)
    .not("phone_verified_at", "is", null)
    .neq("user_id", ownerId);
  if (mErr) throw new Error(mErr.message);
  if (!matches || matches.length === 0) return [];

  // 3. Cria follows (owner → casado). Trigger cuida da conquista first_friend.
  const follows = matches.map((m) => ({ follower_id: ownerId, followee_id: m.user_id }));
  const { error: fErr } = await supabase
    .from("follows")
    .upsert(follows, { onConflict: "follower_id,followee_id", ignoreDuplicates: true });
  if (fErr) throw new Error(fErr.message);

  return matches.map((m) => ({ user_id: m.user_id, full_name: m.full_name }));
}
```

- [ ] **Step 2: Criar `routes/contacts.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { ContactsSyncRequestSchema } from "@fitbrother/shared";
import { authRequired } from "../lib/auth.js";
import { supabaseService } from "../lib/supabase.js";
import { syncContacts } from "../services/contacts.js";

export async function contactsRoutes(app: FastifyInstance) {
  // Recebe hashes SHA-256 dos contatos (números em claro nunca chegam aqui),
  // guarda o grafo e cria follows pros contatos que já são usuários verificados.
  // Gate: só usuários com telefone verificado podem sincronizar.
  app.post("/contacts/sync", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = ContactsSyncRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_body" });
    }
    const userId = req.user!.id;
    const admin = supabaseService();

    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("phone_verified_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) {
      req.log.error({ err: pErr }, "contacts_sync_profile_failed");
      return reply.code(500).send({ error: pErr.message });
    }
    if (!prof?.phone_verified_at) {
      return reply.code(403).send({ error: "phone_not_verified" });
    }

    try {
      const followed = await syncContacts(admin, userId, parsed.data.hashes);
      return reply.send({ followed });
    } catch (err) {
      req.log.error({ err }, "contacts_sync_failed");
      return reply.code(500).send({ error: "contacts_sync_failed" });
    }
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/contacts.ts apps/server/src/services/contacts.ts
git commit -m "M5.3 server — POST /contacts/sync (match + follows)"
```

---

### Task 11: `GET /following` + `GET /leaderboard/weekly`

**Files:**
- Create: `apps/server/src/routes/social.ts`

- [ ] **Step 1: Criar `routes/social.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { FollowedProfileSchema, LeaderboardRowSchema } from "@fitbrother/shared";
import { authRequired } from "../lib/auth.js";
import { supabaseService } from "../lib/supabase.js";

export async function socialRoutes(app: FastifyInstance) {
  // Quem o usuário segue (perfil mínimo). Usa service-role + duas queries:
  // o FK de follows.followee_id aponta pra auth.users (não profiles), então não
  // dá pra embedar; e o RLS owner-only de profiles impede o client do usuário
  // de ler o full_name de terceiros. Só expomos user_id + full_name (sem macros).
  app.get("/following", { preHandler: [authRequired] }, async (req, reply) => {
    const admin = supabaseService();
    const { data: rows, error } = await admin
      .from("follows")
      .select("followee_id")
      .eq("follower_id", req.user!.id);
    if (error) {
      req.log.error({ err: error }, "following_query_failed");
      return reply.code(500).send({ error: error.message });
    }
    const ids = (rows ?? []).map((r) => r.followee_id);
    if (ids.length === 0) return reply.send({ following: [] });

    const { data: profs, error: pErr } = await admin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    if (pErr) {
      req.log.error({ err: pErr }, "following_profiles_failed");
      return reply.code(500).send({ error: pErr.message });
    }
    const following = (profs ?? []).map((p) =>
      FollowedProfileSchema.parse({ user_id: p.user_id, full_name: p.full_name }),
    );
    return reply.send({ following });
  });

  // Ranking semanal da rede do usuário. Usa a RPC (SECURITY DEFINER) via
  // service-role, passando o user_id do JWT. Marca is_me no map.
  app.get("/leaderboard/weekly", { preHandler: [authRequired] }, async (req, reply) => {
    const userId = req.user!.id;
    const { data, error } = await supabaseService().rpc("fitbrother_weekly_leaderboard", {
      p_user_id: userId,
    });
    if (error) {
      req.log.error({ err: error }, "leaderboard_query_failed");
      return reply.code(500).send({ error: error.message });
    }
    const rows = (data ?? []).map((r: Record<string, unknown>) =>
      LeaderboardRowSchema.parse({
        user_id: r.user_id,
        full_name: r.full_name ?? null,
        weekly_hits: r.weekly_hits,
        window_streak: r.window_streak,
        is_me: r.user_id === userId,
      }),
    );
    return reply.send({ rows });
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/social.ts
git commit -m "M5.3 server — GET /following + GET /leaderboard/weekly"
```

---

### Task 12: Workers de alerta + render de push + registro no server

**Files:**
- Create: `apps/server/src/workers/streak-alert.ts`
- Create: `apps/server/src/workers/goal-reminder.ts`
- Modify: `apps/server/src/services/notifications.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Criar `workers/streak-alert.ts`** (espelha `streak-tick.ts`)

```ts
import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { supabaseService } from "../lib/supabase.js";

export const STREAK_ALERT_QUEUE = "streak-alert";

/**
 * Alerta de risco de streak. Cron horário UTC; a função SQL
 * fitbrother_streak_alert() escolhe quem está às 21h LOCAIS, com streak vivo e
 * sem goal_hit hoje, e insere notifications(channel='push'). O worker
 * dispatch-notification faz o envio.
 */
export async function registerStreakAlert(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(STREAK_ALERT_QUEUE);
  await boss.work(STREAK_ALERT_QUEUE, async () => {
    const { data, error } = await supabaseService().rpc("fitbrother_streak_alert");
    if (error) {
      log.error({ error }, "streak_alert_failed");
      throw new Error(error.message);
    }
    log.info({ queued: data }, "streak_alert_done");
  });
  await boss.schedule(STREAK_ALERT_QUEUE, "0 * * * *", undefined, { tz: "UTC" });
  log.info("streak_alert_scheduled");
}
```

- [ ] **Step 2: Criar `workers/goal-reminder.ts`**

```ts
import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { supabaseService } from "../lib/supabase.js";

export const GOAL_REMINDER_QUEUE = "goal-reminder";

/**
 * Lembrete de meta (19h locais, kcal < 70%, janela WA aberta). Insere
 * notifications(channel='wa') → DORMENTE enquanto o dispatch ignora WA (M4
 * pausado). Mantido pronto pra quando o WhatsApp voltar.
 */
export async function registerGoalReminder(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(GOAL_REMINDER_QUEUE);
  await boss.work(GOAL_REMINDER_QUEUE, async () => {
    const { data, error } = await supabaseService().rpc("fitbrother_goal_reminder");
    if (error) {
      log.error({ error }, "goal_reminder_failed");
      throw new Error(error.message);
    }
    log.info({ queued: data }, "goal_reminder_done");
  });
  await boss.schedule(GOAL_REMINDER_QUEUE, "0 * * * *", undefined, { tz: "UTC" });
  log.info("goal_reminder_scheduled");
}
```

- [ ] **Step 3: Estender `renderPush` em `services/notifications.ts`**

Substitua a função `renderPush` por:
```ts
function renderPush(n: PendingNotification): { title: string; body: string } {
  switch (n.kind) {
    case "achievement":
      return {
        title: "Nova conquista! 🏆",
        body: String(n.payload.title ?? "Você desbloqueou uma conquista."),
      };
    case "streak_alert":
      return {
        title: "Sua ofensiva está em risco! 🔥",
        body: "Registre uma refeição hoje pra não perder a sequência.",
      };
    case "goal_reminder":
      return {
        title: "Faltam macros pra meta de hoje",
        body: "Você ainda não chegou perto da sua meta. Bora?",
      };
    case "friend_activity":
      return {
        title: "Seu contato entrou no Fitbrother 👋",
        body: `${String(n.payload.full_name ?? "Um contato")} agora está no Fitbrother.`,
      };
    default:
      return { title: "Fitbrother", body: String(n.payload.body ?? "") };
  }
}
```

- [ ] **Step 4: Registrar rotas e workers em `server.ts`**

Adicione aos imports:
```ts
import { contactsRoutes } from "./routes/contacts.js";
import { socialRoutes } from "./routes/social.js";
import { registerStreakAlert } from "./workers/streak-alert.js";
import { registerGoalReminder } from "./workers/goal-reminder.js";
```
Após `await app.register(pushTokensRoutes);` adicione:
```ts
await app.register(contactsRoutes);
await app.register(socialRoutes);
```
No bloco `if (boss) { ... }`, após `registerDispatchNotification`, adicione:
```ts
  await registerStreakAlert(boss, app.log);
  await registerGoalReminder(boss, app.log);
```

- [ ] **Step 5: Typecheck + boot smoke**

Run: `npm run typecheck`
Expected: passa.

Run (com Supabase local up): `npm run dev:server` por ~5s e observe os logs.
Expected: logs `streak_alert_scheduled` e `goal_reminder_scheduled`; servidor `listening on :3000`. Encerre com Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/workers/streak-alert.ts apps/server/src/workers/goal-reminder.ts apps/server/src/services/notifications.ts apps/server/src/server.ts
git commit -m "M5.3 server — workers de alerta + render push + registro"
```

---

## Fase D — Mobile

### Task 13: Dep `expo-contacts` + `lib/contacts.ts` (normalização + hash)

**Files:**
- Modify: `apps/mobile/package.json` (via comando)
- Create: `apps/mobile/lib/contacts.ts`

- [ ] **Step 1: Instalar deps**

Run:
```bash
cd apps/mobile && npx expo install expo-contacts && npm install libphonenumber-js && cd ../..
```
Expected: `expo-contacts` e `libphonenumber-js` aparecem em `apps/mobile/package.json`.

- [ ] **Step 2: Criar `lib/contacts.ts`**

```ts
import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Lê a agenda, normaliza cada número pra E.164 e devolve os hashes SHA-256
 * (hex, lowercase). NUNCA retorna números em claro. `defaultCountry` resolve
 * números locais sem código de país (BR por padrão).
 */
export async function collectContactHashes(defaultCountry = "BR"): Promise<string[]> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("contacts_permission_denied");
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const e164Set = new Set<string>();
  for (const contact of data) {
    for (const phone of contact.phoneNumbers ?? []) {
      if (!phone.number) continue;
      const parsed = parsePhoneNumberFromString(phone.number, defaultCountry as never);
      if (parsed?.isValid()) {
        e164Set.add(parsed.number); // E.164 com '+'
      }
    }
  }

  const hashes = await Promise.all(
    [...e164Set].map((e164) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, e164),
    ),
  );
  // expo-crypto retorna hex lowercase — mesmo formato do backend (node crypto).
  return hashes;
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: passam.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/lib/contacts.ts package-lock.json
git commit -m "M5.3 mobile — expo-contacts + lib/contacts (normaliza E.164 + hash)"
```

---

### Task 14: API client social + `fetchStreak` com `atRisk`

**Files:**
- Create: `apps/mobile/lib/api/social.ts`
- Modify: `apps/mobile/lib/api/me.ts`

- [ ] **Step 1: Criar `lib/api/social.ts`**

```ts
import {
  ContactsSyncResponseSchema,
  FollowingResponseSchema,
  LeaderboardResponseSchema,
  type FollowedProfile,
  type LeaderboardRow,
} from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

type ApiError = Error & { status?: number };
async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.status === 204 ? {} : res.json();
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function verifyPhone(): Promise<void> {
  const res = await authedFetch("/me/verify-phone", { method: "POST" });
  await parseOrThrow(res);
}

export async function syncContacts(hashes: string[]): Promise<FollowedProfile[]> {
  const res = await authedFetch("/contacts/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hashes }),
  });
  const body = await parseOrThrow(res);
  return ContactsSyncResponseSchema.parse(body).followed;
}

export async function fetchFollowing(): Promise<FollowedProfile[]> {
  const res = await authedFetch("/following");
  const body = await parseOrThrow(res);
  return FollowingResponseSchema.parse(body).following;
}

export async function fetchWeeklyLeaderboard(): Promise<LeaderboardRow[]> {
  const res = await authedFetch("/leaderboard/weekly");
  const body = await parseOrThrow(res);
  return LeaderboardResponseSchema.parse(body).rows;
}
```

> **Nota:** confirme a assinatura de `authedFetch` (path + RequestInit) em `apps/mobile/lib/api/index.ts`; ajuste a passagem de `method/headers/body` se a sua versão usar outra forma.

- [ ] **Step 2: Atualizar `fetchStreak` em `lib/api/me.ts`**

Substitua imports e a função:
```ts
import {
  DailySummariesResponseSchema,
  DailySummaryResponseSchema,
  StreakResponseSchema,
  type DailySummary,
  type Streak,
} from "@fitbrother/shared";
```
```ts
export type StreakView = { streak: Streak; atRisk: boolean };

export async function fetchStreak(): Promise<StreakView> {
  const res = await authedFetch("/me/streak");
  const body = await parseOrThrow(res);
  const parsed = StreakResponseSchema.parse(body);
  return { streak: parsed.streak, atRisk: parsed.at_risk };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: **vai falhar** em `useStreak`/`HomeHeader` porque o tipo de `fetchStreak` mudou. Isso é esperado — corrigido nas Tasks 15 e 19.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/api/social.ts apps/mobile/lib/api/me.ts
git commit -m "M5.3 mobile — api client social + fetchStreak retorna atRisk"
```

---

### Task 15: Hooks sociais + ajuste de `useStreak`

**Files:**
- Create: `apps/mobile/lib/hooks/useFollowing.ts`
- Create: `apps/mobile/lib/hooks/useWeeklyLeaderboard.ts`
- Create: `apps/mobile/lib/hooks/useVerifyPhone.ts`
- Create: `apps/mobile/lib/hooks/useSyncContacts.ts`
- Modify: `apps/mobile/lib/hooks/useStreak.ts`

- [ ] **Step 1: `useFollowing.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchFollowing } from "@/lib/api/social";

export const followingKey = ["following"] as const;

export function useFollowing() {
  return useQuery({ queryKey: followingKey, queryFn: fetchFollowing, staleTime: 60_000 });
}
```

- [ ] **Step 2: `useWeeklyLeaderboard.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchWeeklyLeaderboard } from "@/lib/api/social";

export const leaderboardKey = ["leaderboard", "weekly"] as const;

export function useWeeklyLeaderboard() {
  return useQuery({
    queryKey: leaderboardKey,
    queryFn: fetchWeeklyLeaderboard,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: `useVerifyPhone.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { verifyPhone } from "@/lib/api/social";

/** Confirma a verificação no backend após o verifyOtp do Supabase. */
export function useVerifyPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: verifyPhone,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
```

- [ ] **Step 4: `useSyncContacts.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { collectContactHashes } from "@/lib/contacts";
import { syncContacts } from "@/lib/api/social";
import { followingKey } from "./useFollowing";
import { leaderboardKey } from "./useWeeklyLeaderboard";

/** Lê a agenda, hasheia no device e sincroniza; invalida following + ranking. */
export function useSyncContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const hashes = await collectContactHashes();
      return syncContacts(hashes);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: followingKey });
      qc.invalidateQueries({ queryKey: leaderboardKey });
    },
  });
}
```

- [ ] **Step 5: Ajustar `useStreak.ts`** (tipo mudou para `StreakView`; nada a alterar na chamada, só garantir o re-export do tipo onde necessário)

O `useStreak` atual já delega a `fetchStreak`, então funciona com o novo tipo `StreakView`. Nenhuma mudança de código é necessária aqui — o erro de tipo aparece só em `HomeHeader` (Task 19). Confirme lendo o arquivo; se ele anotar explicitamente `UseQueryResult<Streak>`, troque para `StreakView`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: ainda falha só em `HomeHeader` (Task 19). Os hooks novos compilam.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/hooks/useFollowing.ts apps/mobile/lib/hooks/useWeeklyLeaderboard.ts apps/mobile/lib/hooks/useVerifyPhone.ts apps/mobile/lib/hooks/useSyncContacts.ts apps/mobile/lib/hooks/useStreak.ts
git commit -m "M5.3 mobile — hooks sociais (following, leaderboard, verify, sync)"
```

---

### Task 16: Componente `LeaderboardRow` (§12.13)

**Files:**
- Create: `apps/mobile/components/domain/LeaderboardRow.tsx`

- [ ] **Step 1: Implementar conforme DESIGN_SYSTEM §12.13**

```tsx
import { Text, View } from "react-native";
import { Flame } from "lucide-react-native";
import { colors } from "@/lib/colors";

type LeaderboardRowProps = {
  position: number;
  fullName: string | null;
  windowStreak: number;
  weeklyHits: number;
  isMe: boolean;
};

/** Iniciais do nome como placeholder de avatar (profiles ainda não tem avatar). */
function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function LeaderboardRow({
  position,
  fullName,
  windowStreak,
  weeklyHits,
  isMe,
}: LeaderboardRowProps) {
  return (
    <View
      className={`flex-row items-center rounded-2xl p-3 ${
        isMe ? "bg-primary-50" : "border border-neutral-200 bg-white"
      }`}
      accessibilityRole="text"
      accessibilityLabel={`Posição ${position}, ${fullName ?? "amigo"}, ${weeklyHits} dias na meta`}
    >
      <Text
        className="w-8 font-sans-bold text-sm text-neutral-500"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        #{position}
      </Text>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-neutral-200">
        <Text className="font-sans-semibold text-sm text-neutral-700">{initials(fullName)}</Text>
      </View>
      <Text className="ml-3 flex-1 font-sans-semibold text-base text-neutral-800" numberOfLines={1}>
        {isMe ? "Você" : (fullName ?? "Amigo")}
      </Text>
      <View className="flex-row items-center gap-1">
        <Flame size={18} color={colors.streak[400]} />
        <Text
          className="font-sans-medium text-sm text-neutral-700"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {windowStreak}
        </Text>
      </View>
      <Text
        className="ml-3 font-sans-medium text-sm text-success-600"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        ✓ {weeklyHits}
      </Text>
    </View>
  );
}
```

> **Nota:** confirme que os tokens `streak.400`, `success-600` e `primary-50` existem em `lib/colors.ts`/`tailwind.config.ts` (DESIGN_SYSTEM lista todos). Se `success-600` não existir como classe, use o token disponível mais próximo (ex.: `success-500`).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: passam (exceto o erro pendente de `HomeHeader`, Task 19).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/LeaderboardRow.tsx
git commit -m "M5.3 mobile — LeaderboardRow (§12.13)"
```

---

### Task 17: Tela Amigos (máquina de estados)

**Files:**
- Rewrite: `apps/mobile/app/(app)/friends.tsx`

- [ ] **Step 1: Reescrever `friends.tsx`** com os 3 estados (não verificado → OTP; verificado sem contatos → conectar; conectado → following + leaderboard)

```tsx
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components";
import { LeaderboardRow } from "@/components/domain/LeaderboardRow";
import { useFollowing } from "@/lib/hooks/useFollowing";
import { useWeeklyLeaderboard } from "@/lib/hooks/useWeeklyLeaderboard";
import { useVerifyPhone } from "@/lib/hooks/useVerifyPhone";
import { useSyncContacts } from "@/lib/hooks/useSyncContacts";

type OtpStep = "idle" | "phone" | "code";

export default function FriendsScreen() {
  const router = useRouter();
  const following = useFollowing();
  const leaderboard = useWeeklyLeaderboard();
  const verifyPhone = useVerifyPhone();
  const syncContacts = useSyncContacts();

  const [otpStep, setOtpStep] = useState<OtpStep>("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  // Estado de verificação derivado de /following (200 só se autenticado);
  // a checagem real é o profile — aqui usamos o sucesso de verifyPhone + um
  // flag local pra alternar a UI após a verificação. Em produção, derive de GET /me.
  const isVerified = verified ?? false;

  async function sendCode() {
    setOtpError(null);
    const parsed = parsePhoneNumberFromString(phone, "BR");
    if (!parsed?.isValid()) {
      setOtpError("Número inválido. Use DDD + número.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ phone: parsed.number });
    if (error) {
      setOtpError(error.message);
      return;
    }
    setPhone(parsed.number);
    setOtpStep("code");
  }

  async function confirmCode() {
    setOtpError(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "phone_change" });
    if (error) {
      setOtpError("Código inválido ou expirado.");
      return;
    }
    try {
      await verifyPhone.mutateAsync();
      setVerified(true);
      setOtpStep("idle");
    } catch {
      setOtpError("Não foi possível confirmar a verificação.");
    }
  }

  async function onSync() {
    try {
      const followed = await syncContacts.mutateAsync();
      Alert.alert("Pronto!", `${followed.length} contato(s) já usam o Fitbrother.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      Alert.alert("Não rolou", msg === "contacts_permission_denied" ? "Permita o acesso aos contatos." : "Tente de novo.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Amigos</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 gap-5">
        {!isVerified ? (
          <View className="gap-3 pt-6">
            {otpStep === "idle" && (
              <>
                <Text className="font-sans-bold text-lg text-neutral-800">
                  Verifique seu telefone
                </Text>
                <Text className="font-sans text-sm text-neutral-500">
                  Verificar seu número desbloqueia conectar contatos e deixa amigos te encontrarem.
                </Text>
                <Button title="Verificar telefone" onPress={() => setOtpStep("phone")} />
              </>
            )}
            {otpStep === "phone" && (
              <>
                <Text className="font-sans-medium text-sm text-neutral-700">Seu telefone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(11) 99999-9999"
                  keyboardType="phone-pad"
                  className="rounded-2xl border border-neutral-200 bg-white p-4 font-sans text-base"
                />
                {otpError && <Text className="font-sans text-sm text-danger-500">{otpError}</Text>}
                <Button title="Enviar código" onPress={sendCode} />
              </>
            )}
            {otpStep === "code" && (
              <>
                <Text className="font-sans-medium text-sm text-neutral-700">
                  Código enviado para {phone}
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 text-center font-sans-bold text-2xl"
                  style={{ fontVariant: ["tabular-nums"] }}
                />
                {otpError && <Text className="font-sans text-sm text-danger-500">{otpError}</Text>}
                <Button title="Confirmar" onPress={confirmCode} />
                <Pressable onPress={() => setOtpStep("phone")} className="min-h-[44px] justify-center">
                  <Text className="font-sans text-sm text-neutral-500">Reenviar / trocar número</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            <View className="gap-2 pt-4">
              <Button
                title={syncContacts.isPending ? "Sincronizando..." : "Conectar contatos"}
                onPress={onSync}
                disabled={syncContacts.isPending}
              />
              <Text className="font-sans text-xs text-neutral-400">
                Só enviamos os números de forma criptografada (hash). Nunca em texto.
              </Text>
            </View>

            <View className="gap-3">
              <Text className="font-sans-bold text-base text-neutral-800">Ranking semanal</Text>
              {leaderboard.isLoading ? (
                <ActivityIndicator color={colors.primary[400]} />
              ) : (
                (leaderboard.data ?? []).map((row, i) => (
                  <LeaderboardRow
                    key={row.user_id}
                    position={i + 1}
                    fullName={row.full_name}
                    windowStreak={row.window_streak}
                    weeklyHits={row.weekly_hits}
                    isMe={row.is_me}
                  />
                ))
              )}
            </View>

            <View className="gap-2">
              <Text className="font-sans-bold text-base text-neutral-800">
                Seguindo ({following.data?.length ?? 0})
              </Text>
              {(following.data ?? []).map((f) => (
                <Text key={f.user_id} className="font-sans text-sm text-neutral-600">
                  {f.full_name ?? "Amigo"}
                </Text>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

> **Nota de estado de verificação:** o flag `verified` local é um atalho de UI. O ideal é derivar de `GET /me` (`profile.phone_verified_at`). Se houver um hook/provider de profile (`profile-context`), use-o para inicializar `verified` no lugar de `null`. Confirme em `apps/mobile/lib/profile/profile-context.ts` e prefira essa fonte.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: passam (menos o erro de `HomeHeader`, resolvido na Task 19). Confirme que `Button` aceita props `title/onPress/disabled` — senão ajuste para a API real do `components/Button.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/friends.tsx"
git commit -m "M5.3 mobile — tela Amigos (OTP → conectar contatos → ranking)"
```

---

### Task 18: Tela de conquistas + rota + entrada no Perfil

**Files:**
- Create: `apps/mobile/app/(app)/achievements.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/app/(app)/profile.tsx`

- [ ] **Step 1: Criar `achievements.tsx`** (merge catálogo + desbloqueadas via hooks do M5.2)

```tsx
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Lock, Trophy } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { useAchievements } from "@/lib/hooks/useAchievements";

export default function AchievementsScreen() {
  const router = useRouter();
  // useAchievements (M5.2) deve expor catálogo + desbloqueadas mescladas.
  // Confirme o shape; aqui assumimos { data: { code, title, description, icon,
  // unlocked_at: string | null }[] }.
  const { data, isLoading } = useAchievements();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Conquistas</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-10" color={colors.primary[400]} />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10 gap-3">
          {(data ?? []).map((a) => {
            const unlocked = Boolean(a.unlocked_at);
            return (
              <View
                key={a.code}
                className={`flex-row items-center gap-3 rounded-2xl border p-4 ${
                  unlocked ? "border-warning-400 bg-white" : "border-neutral-200 bg-neutral-100"
                }`}
              >
                <View
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    unlocked ? "bg-warning-100" : "bg-neutral-200"
                  }`}
                >
                  {unlocked ? (
                    <Trophy size={24} color={colors.warning[400]} />
                  ) : (
                    <Lock size={20} color={colors.neutral[400]} />
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className={`font-sans-semibold text-base ${
                      unlocked ? "text-neutral-800" : "text-neutral-500"
                    }`}
                  >
                    {a.title}
                  </Text>
                  <Text className="font-sans text-sm text-neutral-500">{a.description}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

> **Nota crítica:** leia `apps/mobile/lib/hooks/useAchievements.ts` antes de escrever esta tela. O M5.2 criou `useAchievements` e `useMyAchievements` separados — pode ser necessário mesclar catálogo (`code,title,description,icon`) com desbloqueios (`achievement_id,unlocked_at`) aqui ou criar um seletor. Ajuste o shape consumido para bater com o que os hooks realmente retornam. O ícone pode vir como `a.icon` (nome lucide) — opcionalmente mapeie para o componente lucide correspondente em vez do `Trophy` fixo.

- [ ] **Step 2: Registrar a screen em `_layout.tsx`**

No `<Stack>` do `GuardedStack`, adicione (não precisa de options especiais — é push padrão):
```tsx
      <Stack.Screen name="achievements" />
```

- [ ] **Step 3: Adicionar entrada no `profile.tsx`**

Leia `apps/mobile/app/(app)/profile.tsx` e adicione um item de lista/Pressable que navega para conquistas:
```tsx
// dentro do componente:
// import { useRouter } from "expo-router"; (se ainda não importado)
// const router = useRouter();
<Pressable
  onPress={() => router.push("/(app)/achievements")}
  accessibilityRole="button"
  className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
>
  <Text className="font-sans-medium text-base text-neutral-800">Conquistas</Text>
  <ChevronRight size={20} color={colors.neutral[400]} />
</Pressable>
```
(importe `ChevronRight` de `lucide-react-native` e `colors` se necessário; posicione o item seguindo o layout existente do Perfil.)

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: passam (menos erro pendente de `HomeHeader`).

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/achievements.tsx" "apps/mobile/app/(app)/_layout.tsx" "apps/mobile/app/(app)/profile.tsx"
git commit -m "M5.3 mobile — tela de conquistas + entrada no Perfil"
```

---

### Task 19: Wiring do `atRisk` no StreakCounter

**Files:**
- Modify: `apps/mobile/components/domain/HomeHeader.tsx`

- [ ] **Step 1: Passar `atRisk` do hook para o componente**

Em `HomeHeader.tsx`, a linha que usa `useStreak` agora recebe `{ streak, atRisk }`. Substitua:
```tsx
  const { data: streak } = useStreak();
```
e o render:
```tsx
        {streak ? <StreakCounter current={streak.current_streak} /> : null}
```
por:
```tsx
  const { data: streakView } = useStreak();
```
```tsx
        {streakView ? (
          <StreakCounter current={streakView.streak.current_streak} atRisk={streakView.atRisk} />
        ) : null}
```

- [ ] **Step 2: Typecheck + lint (agora deve passar limpo)**

Run: `npm run typecheck && npm run lint`
Expected: **passam sem erros** — fecha o erro que estava pendente desde a Task 14.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/domain/HomeHeader.tsx
git commit -m "M5.3 mobile — wiring atRisk no StreakCounter"
```

---

## Fase E — Config + verificação integrada

### Task 20: Config Supabase (phone OTP) + .env.example

**Files:**
- Modify: `supabase/config.toml`
- Modify: `.env.example`

- [ ] **Step 1: Habilitar phone OTP no `config.toml`**

Após o bloco `[auth.email]`, adicione:
```toml
[auth.sms]
enable_signup = false
enable_confirmations = true

# Dev: OTP fixo sem provider/custo. Em staging/prod, configure um provider real
# (Twilio/MessageBird) e remova/ajuste o test_otp.
[auth.sms.test_otp]
# Use estes pares número=código em dev. Substitua pelo número que você usar.
"+5511999999999" = "123456"
```

> **Nota:** o número em `test_otp` deve bater com o que você digitar na tela durante o teste manual. Para produção, documente as vars do provider (ex.: `[auth.sms.twilio]` + secrets) — fora do escopo deste PR de código.

- [ ] **Step 2: Documentar no `.env.example`**

Adicione um comentário na seção apropriada do `.env.example`:
```
# M5.3 — Phone OTP: em dev usa supabase/config.toml [auth.sms.test_otp] (sem custo).
# Em staging/prod configure um provider SMS (ex.: Twilio) e seus secrets.
```

- [ ] **Step 3: Reset e boot pra confirmar que o config é válido**

Run: `npm run db:reset && npm run db:start`
Expected: Supabase reinicia sem erro de parse do `config.toml`.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml .env.example
git commit -m "M5.3 config — phone OTP (test_otp em dev)"
```

---

### Task 21: Script de verificação integrada + checklist final

**Files:**
- Create: `scripts/checks/m5-3-social.sql`
- Create: `scripts/checks/m5-3-social.sh`

- [ ] **Step 1: Criar `scripts/checks/m5-3-social.sql`** (consolida as asserções das Tasks 1, 4, 5)

```sql
-- M5.3 social — checks SQL. Roda via:
--   docker exec -i supabase_db_fitbrother psql -U postgres -d postgres < m5-3-social.sql
\set ON_ERROR_STOP on

-- Check 1: following_summaries_view NÃO expõe macros.
SELECT 'check_1_view_no_macros' AS check,
       NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'following_summaries_view'
           AND column_name IN ('kcal','protein_g','carbs_g','fat_g')
       ) AS pass;

-- Check 2: self-follow bloqueado.
DO $$
DECLARE u uuid;
BEGIN
  SELECT id INTO u FROM auth.users LIMIT 1;
  IF u IS NULL THEN RAISE NOTICE 'check_2_skip: no users'; RETURN; END IF;
  BEGIN
    INSERT INTO public.follows(follower_id,followee_id) VALUES (u,u);
    RAISE EXCEPTION 'check_2_FAIL: self-follow permitido';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'check_2_pass: self-follow bloqueado';
  END;
END $$;

-- Check 3: leaderboard inclui o próprio usuário.
DO $$
DECLARE u uuid; r record;
BEGIN
  SELECT user_id INTO u FROM public.profiles LIMIT 1;
  IF u IS NULL THEN RAISE NOTICE 'check_3_skip: no profiles'; RETURN; END IF;
  SELECT * INTO r FROM public.fitbrother_weekly_leaderboard(u) WHERE user_id = u;
  IF r.user_id IS NULL THEN RAISE EXCEPTION 'check_3_FAIL: self ausente do leaderboard'; END IF;
  RAISE NOTICE 'check_3_pass: leaderboard inclui self';
END $$;

-- Check 4: alertas idempotentes (2x sem erro).
SELECT public.fitbrother_streak_alert();
SELECT public.fitbrother_streak_alert();
SELECT public.fitbrother_goal_reminder();
SELECT 'check_4_pass: alertas rodam idempotentes' AS check;
```

- [ ] **Step 2: Criar `scripts/checks/m5-3-social.sh`**

```bash
#!/usr/bin/env bash
# M5.3 social smoke checks — SQL via psql. Pré: supabase local up.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
echo "── M5.3 social checks ──"
docker exec -i supabase_db_fitbrother psql -U postgres -d postgres \
  < scripts/checks/m5-3-social.sql
echo "── done ──"
```

- [ ] **Step 3: Rodar**

Run: `bash scripts/checks/m5-3-social.sh`
Expected: imprime `check_1..4` com `pass`/`NOTICE: ..._pass` e termina em `── done ──` sem erro.

- [ ] **Step 4: Commit**

```bash
chmod +x scripts/checks/m5-3-social.sh
git add scripts/checks/m5-3-social.sql scripts/checks/m5-3-social.sh
git commit -m "M5.3 — script de verificação SQL"
```

- [ ] **Step 5: Checklist de validação manual (device real — não automatizável)**

Documente o resultado destes passos no PR (push e OTP exigem device físico, como o M5.2):
- [ ] Dois usuários verificam telefone (OTP test_otp) → cada um sincroniza contatos → passam a se seguir; ambos aparecem no ranking.
- [ ] Usuário B verifica depois de A já ter B na agenda → A passa a auto-seguir B + recebe push "seu contato entrou".
- [ ] Conquista "Primeiro amigo" → Toast + push no 1º follow.
- [ ] StreakCounter fica cinza (atRisk) perto do boundary com hoje sem goal_hit.
- [ ] Inspeção do payload de `/contacts/sync` (proxy/log): só hashes hex, nenhum número em claro.

- [ ] **Step 6: Atualizar status no PLAN.md**

Edite `docs/PLAN.md §M5` adicionando uma linha de status M5.3 (modelo follow por contatos, OTP, leaderboard, conquistas, atRisk, alertas) e anote os follow-ups: alinhar FEATURES.md (amigos→follow) e incluir `follows`/`contact_links` no export/delete do M6.

```bash
git add docs/PLAN.md
git commit -m "M5.3 — status no PLAN + follow-ups (FEATURES align, M6 LGPD)"
```

---

## Notas de follow-up (fora do escopo de código deste PR)

- **FEATURES.md** — alinhar §3.4/§5: trocar "amigos (pedido→aceite)" por "follow por contatos"; renomear `friends_summaries_view` → `following_summaries_view`.
- **M6/LGPD** — incluir `follows` e `contact_links` no `GET /account/export` e no soft/hard delete.
- **M4/WhatsApp** — `goal_reminder` deixa de ser dormente quando a janela WA voltar (dispatch passa a enviar `channel='wa'`).
- **Provider SMS** — configurar Twilio/MessageBird em staging/prod (test_otp é só dev).
