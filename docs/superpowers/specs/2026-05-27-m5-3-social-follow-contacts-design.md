# M5.3 — Gamificação social: follow por contatos, leaderboard, conquistas e alertas

**Data:** 2026-05-27
**Milestone:** M5.3 (fecha o M5 — ver `docs/PLAN.md §M5`)
**Entrega:** PR único.

---

## 1. Objetivo

Fechar a gamificação social do Fitbrother com um modelo **follow assimétrico estilo Duolingo**, descoberta por **contatos do telefone**, ranking semanal entre quem você segue, tela de conquistas, o estado "em risco" do streak e os crons de alerta.

Sucesso = um usuário verifica o telefone, conecta a agenda, passa a seguir automaticamente os contatos que já usam o app, compete com eles no ranking semanal, vê suas conquistas, e recebe push de risco de streak.

---

## 2. Decisões de produto (fixadas neste brainstorming)

1. **Entrega:** PR único M5.3 (não fatiado).
2. **Modelo social:** follow **assimétrico** (`follows`), sem pedido/aceite. Substitui o `friendships` (pedido→aceite) que estava rascunhado em FEATURES §3.4.
3. **Descoberta:** por **contatos do aparelho**, não por busca manual. Conectar contatos → segue automaticamente todo contato que já é usuário verificado.
4. **Verificação de telefone:** OTP por **SMS via Supabase Auth**. É o **gate de entrada** do social — verificar o número desbloqueia "conectar contatos" **e** torna o usuário descobrível.
5. **Matching de contatos:** o app hasheia os números (**SHA-256** sobre E.164) **no device**; só hashes trafegam. Números em claro nunca chegam ao servidor.
6. **Retenção:** o grafo de contatos hasheados **é guardado** (`contact_links`) para habilitar a notificação "seu contato entrou no Fitbrother" e o auto-follow no reverse-match.
7. **Reverse-match:** quando um usuário verifica o telefone, todo mundo que tinha o número dele nos contatos passa a **auto-seguir** (não só notificação) — fiel ao "vira amizade automaticamente".
8. **Privacidade do leaderboard:** ranking expõe só `goal_hit`/`meals_count`/derivados, **nunca macros absolutos**.
9. **`goal-reminder`:** mantido WA-gated → **dormente** enquanto M4 (WhatsApp) está pausado. `streak-alert` via push funciona agora.
10. **FEATURES.md** precisa de PR de alinhamento (amigos/pedido→aceite vira follow/contatos). Sinalizado, fora do escopo de código deste PR.

---

## 3. Arquitetura

Reaproveita três padrões já no repositório:

- **Cron** = `pg-boss` agenda uma função SQL `SECURITY DEFINER` (igual `workers/streak-tick.ts` + `fitbrother_streak_tick`). Toda a lógica de "quem alertar agora" vive em SQL, determinística e testável via `supabase db reset`.
- **Notificação** = INSERT em `notifications` (outbox) → worker `dispatch-notification` drena `channel='push'` via Expo Push e carimba `sent_at`. WA fica dormente.
- **Escrita sensível** = rota Fastify com `user_id` do JWT + `supabaseService()` (service-role), validando estado no backend (igual `services/meals.ts`). Views de leitura social usam `security_invoker` ou RPC `SECURITY DEFINER` com `p_user_id`.

---

## 4. Camada de dados (migrations a partir de `0030`)

### 4.1 `follows`
```
follows (
  follower_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
)
```
- RLS: SELECT se `auth.uid() IN (follower_id, followee_id)`; escrita só service-role / SECURITY DEFINER.
- Index `(followee_id)` para reverse-match e contagem de seguidores.

### 4.2 `contact_links` (grafo hasheado)
```
contact_links (
  owner_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_hash  text NOT NULL,          -- SHA-256 hex do E.164, gerado no device
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, phone_hash)
)
```
- RLS owner-only (`auth.uid() = owner_id`); escrita via service-role.
- Index em `phone_hash` para o reverse-lookup na verificação.
- **LGPD:** incluir em export/delete do M6 (anotado em §8).

### 4.3 `profiles.phone_hash`
- Nova coluna `phone_hash text` (+ index). SHA-256 hex do `phone_e164`, gravado **quando o telefone é verificado** (em `POST /me/verify-phone`). É a chave que casa contra `contact_links.phone_hash`.
- `phone_e164` **já é `UNIQUE`** no schema atual (`0003_profiles.sql`) — não precisa de constraint nova; dois usuários não podem cadastrar o mesmo número.
- `profiles` **não tem coluna de avatar** hoje (só `full_name`). O `LeaderboardRow` §12.13 desenha avatar → no MVP usa **iniciais do `full_name`** como placeholder; coluna `avatar_url` fica para depois.

### 4.4 `following_summaries_view`
- Substitui o `friends_summaries_view` rascunhado. UNION das `daily_summaries` de quem o caller segue (`follows.follower_id = auth.uid()`), expondo **somente** `followee_id, day, goal_hit, meals_count`. `security_invoker = true`. Nunca kcal/macros.

### 4.5 RPC `fitbrother_weekly_leaderboard(p_user_id uuid)`
- `SECURITY DEFINER`. Agrega, para `p_user_id` + todos `followee_id` que ele segue:
  - `weekly_hits` = `count(*)` de `daily_summaries` com `goal_hit` nas últimas 7 noites nutricionais (boundary via `fitbrother_today`).
  - `window_streak` = run consecutivo de `goal_hit` terminando ontem **dentro da janela de 7 dias** (derivado da própria janela — **não** lê a tabela `streaks` de terceiros, então não vaza streak privado). Resolve o 🔥 do §12.13 sem quebrar privacidade.
- Retorna `{ user_id, full_name, weekly_hits, window_streak }` ordenado por `weekly_hits DESC` (avatar derivado de iniciais no app).

### 4.6 Achievements
- Em `fitbrother_evaluate_achievements`: `friends_total` (hoje hardcoded 0) passa a ser `count(*) FROM follows WHERE follower_id = p_user_id`. A conquista `first_friend` desbloqueia no **primeiro follow**.
- Trigger `AFTER INSERT ON follows FOR EACH ROW` → `fitbrother_evaluate_achievements(NEW.follower_id)`.

### 4.7 Alertas (funções SQL)
- `fitbrother_streak_alert()` — varre usuários cujo horário local = 21h, com `current_streak > 0`, `last_hit_day = ontem` (nutricional) e **sem** `goal_hit` hoje; insere `notifications(channel='push', kind='streak_alert')`. Idempotente por dia nutricional (não insere se já existe streak_alert para o dia).
- `fitbrother_goal_reminder()` — usuários cujo horário local = 19h, `kcal < 70%` da meta do dia **e** `wa_window_expires_at > now()`; insere `notifications(channel='wa', kind='goal_reminder')`. Dormente: dispatch ignora WA hoje. Idempotente por dia.
- Ambas seguem o padrão `streak-tick`: agendadas hora-cheia UTC; a função escolhe quem está no horário local certo.

---

## 5. Backend (Fastify)

### 5.1 Verificação de telefone (OTP)
- Fluxo OTP é client-side via Supabase Auth: `auth.updateUser({ phone })` (envia SMS) → `auth.verifyOtp({ phone, token, type: 'phone_change' })` (seta `auth.users.phone_confirmed_at`).
- **`POST /me/verify-phone`** — backend lê, via admin/service-role, o `phone_confirmed_at` do usuário do JWT; **só então** carimba `profiles.phone_verified_at`, `phone_e164` e `phone_hash`. Não confia no cliente.
- Em seguida dispara o **reverse-match** (§5.3).
- Config Supabase: `[auth.sms]` + provider (Twilio/MessageBird) em `config.toml`; em dev usa `[auth.sms.test_otp]` (sem custo).

### 5.2 `POST /contacts/sync { hashes: string[] }`
- Gate: exige `phone_verified_at`.
- Upsert dos hashes em `contact_links` (owner = JWT). Casa `hashes` contra `profiles.phone_hash` de usuários verificados → cria `follows (follower=me, followee=casado)` em lote (ON CONFLICT DO NOTHING). Retorna perfis seguidos. Trigger §4.6 cuida da conquista.
- Cap razoável de tamanho do payload (ex.: ≤ alguns milhares de hashes) + validação zod.

### 5.3 Reverse-match (na verificação)
- Disparado por `POST /me/verify-phone` após carimbar `phone_hash`: `SELECT owner_id FROM contact_links WHERE phone_hash = <meu_hash>` → para cada owner, cria `follows (follower=owner, followee=eu)` (ON CONFLICT DO NOTHING) + insere `notifications(kind='friend_activity')` "seu contato entrou".

### 5.4 Outras rotas
- `GET /following` — lista quem o usuário segue (perfil mínimo).
- `GET /leaderboard/weekly` — chama `fitbrother_weekly_leaderboard`.
- `GET /me/streak` — adiciona `at_risk` (bool) calculado em SQL: `current_streak > 0` **e** sem `goal_hit` hoje **e** dentro de 4h do próximo boundary (timezone + day_start_hour).
- Removidas do escopo: search / request / accept / decline (não há pedido manual).

### 5.5 Workers + notificações
- `workers/streak-alert.ts` e `workers/goal-reminder.ts` — espelham `streak-tick.ts` (agenda hora-cheia UTC → RPC).
- `services/notifications.ts` (`renderPush`) — adiciona `streak_alert`, `goal_reminder` e `friend_activity`.

### 5.6 Schemas compartilhados (`packages/shared`)
- `StreakSchema` ganha `at_risk: boolean`.
- Novos: `ContactsSyncSchema` (`{ hashes: string[] }`), `FollowingSchema`, `LeaderboardRowSchema`.

---

## 6. Mobile (`apps/mobile`)

### 6.1 Tela Amigos (`app/(app)/friends.tsx` — hoje placeholder)
Máquina de estados por verificação/conexão:
- **(a) Não verificado** → estado vazio + CTA "Verifique seu telefone". Toca → **fluxo OTP** (2 passos): input de telefone (máscara E.164/BR) → input de código 6 dígitos → `verifyOtp` → `POST /me/verify-phone`. Reenvio com cooldown; erros inline (número inválido, SMS não enviado, código errado/expirado, rate-limit).
- **(b) Verificado, sem contatos conectados** → CTA "Conectar contatos" → permissão `expo-contacts` → hash SHA-256 no device → `POST /contacts/sync`.
- **(c) Conectado** → lista de quem sigo + **ranking semanal** (`LeaderboardRow` §12.13: posição, avatar, nome, 🔥 `window_streak`, ✓ `weekly_hits`; eu na variante `flat` com `bg-primary-50` + "Você"). Botão "Sincronizar de novo".
- Hooks React Query: `useFollowing`, `useWeeklyLeaderboard`, `useVerifyPhone`, `useSyncContacts`. Sem realtime — refetch on-focus + invalidação pós-mutation.

### 6.2 Tela de conquistas (`app/(app)/achievements.tsx`, nova)
- Sem §spec no DESIGN_SYSTEM → segue tokens e padrões (Card, badges `rounded-full`, ícones lucide de `achievement.icon`).
- Lista/grid do catálogo: desbloqueadas (ícone colorido + `unlocked_at`) vs bloqueadas (grayscale + descrição do critério).
- Entrada: a partir de **Perfil** + tap no Toast de conquista (§12.12) navega pra cá.
- Reusa `useAchievements` + `useMyAchievements` (criados no M5.2).

### 6.3 StreakCounter "em risco"
- O componente já tem a prop `atRisk` (§12.4: grayscale, sem pulse). Só ligar o dado: `useStreak` expõe `at_risk` (do `GET /me/streak`) → `HomeHeader` repassa pro `StreakCounter`.

---

## 7. Privacidade / RLS

- Só **hashes** de telefone trafegam device→servidor; números em claro nunca chegam ao backend.
- `contact_links` e `follows` são owner-scoped por RLS.
- `following_summaries_view` e `/leaderboard/weekly` **nunca** retornam kcal/macros — só `goal_hit`, `meals_count`, `weekly_hits`, `window_streak` derivado.
- Descoberta só casa contra usuários **verificados** (`phone_verified_at IS NOT NULL`).

---

## 8. Itens fora do escopo / dependências

- **FEATURES.md/PLAN.md** — PR de alinhamento doc (amigos/pedido→aceite → follow/contatos). Não bloqueia este PR.
- **M6/LGPD** — export/delete precisa incluir `follows` e `contact_links`. Anotado para M6.
- **M4/WhatsApp** — `goal-reminder` permanece dormente até a janela WA voltar.
- **`wa_meals_total`** (conquista `first_wa_meal`) — segue sem dados até M4.

---

## 9. Critérios de "feito"

- Dois usuários verificam o telefone (OTP real) e sincronizam contatos → passam a se seguir; aparecem no ranking um do outro.
- Usuário B verifica depois → A passa a auto-seguir B e recebe push "seu contato entrou".
- Ranking semanal ordena por `weekly_hits`; SELECT na view/RPC com JWT de terceiro **não** traz nenhuma coluna de macro (assert SQL).
- Conquista "Primeiro amigo" desbloqueia no primeiro follow → Toast + push.
- StreakCounter fica cinza (`atRisk`) perto do boundary com hoje sem `goal_hit`.
- `streak-alert` enfileira push idempotente (rodar 2x no mesmo dia → 1 notificação); `goal-reminder` enfileira linha WA dormente.
- Inspeção do payload de `/contacts/sync`: só hashes, nenhum número em claro.
- Mobile tipado + lintado; fluxo OTP/contatos exige device real → validação visual manual (como o push no M5.2).

---

## 10. Arquivos-chave

- **Migrations:** `supabase/migrations/0030_follows.sql`, `0031_contact_links.sql`, `0032_profiles_phone_hash.sql`, `0033_following_view_leaderboard.sql`, `0034_achievements_follows.sql`, `0035_alerts.sql` (numeração final no plano).
- **Config:** `supabase/config.toml` (`[auth.sms]` + `[auth.sms.test_otp]`).
- **Backend:** `apps/server/src/routes/{me,contacts,following,leaderboard}.ts`, `apps/server/src/workers/{streak-alert,goal-reminder}.ts`, `apps/server/src/services/notifications.ts`.
- **Shared:** `packages/shared/src/schemas.ts`.
- **Mobile:** `apps/mobile/app/(app)/{friends,achievements}.tsx`, `apps/mobile/app/(app)/profile.tsx` (entrada conquistas), `apps/mobile/components/domain/{LeaderboardRow,StreakCounter}.tsx`, `apps/mobile/lib/hooks/{useFollowing,useWeeklyLeaderboard,useVerifyPhone,useSyncContacts,useStreak}.ts`, `apps/mobile/lib/contacts.ts` (hash SHA-256).
