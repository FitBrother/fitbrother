# Plano de Desenvolvimento — Fitbrother

## Contexto

> **Nota histórica:** este plano nasceu com o repo greenfield. Hoje (jun/2026) a **Fase 1 está majoritariamente entregue** — M0–M3 e M5 completos, M4 pausado (Meta), M6 em planejamento. O monorepo (`apps/mobile`, `apps/server`, `packages/*`, `supabase/`) existe e roda. Os Status de cada milestone abaixo são o registro vivo. A **Fase 2 (M7–M9)** está descrita na seção própria mais abaixo.

Objetivo original: entregar **todas** as features de `FEATURES.md §4–7` funcionando ponta a ponta. Sucesso = um usuário novo consegue: (1) completar onboarding, (2) registrar refeição por texto/áudio no app **e** via WhatsApp, (3) ver dashboard realtime, (4) ganhar streak e conquistas, (5) competir com amigos no ranking semanal, (6) exportar/deletar conta (LGPD).

Decisões já fixadas:
- **Monorepo** com `npm workspaces` (`apps/mobile`, `apps/server`, `packages/shared`, `supabase/`).
- **LLM:** Gemini 1.5 Flash default, atrás de interface `LLMProvider` plugável (`LLM_PROVIDER` env troca para OpenAI).
- **Contas externas:** nenhuma criada — M0 inclui walkthrough.
- **Ritmo:** solo full-time, ~1 semana por milestone.
- **Formato:** incremental, cada milestone com critério de "feito". **Fase 1 = M0–M6** (app de nutrição); **Fase 2 = M7–M9** (transição para rede social — ver seção própria abaixo).

---

## Shape do plano

```mermaid
flowchart TB
    M0[M0 · Fundação<br/>monorepo, Expo, server,<br/>Supabase local, CI, contas] --> M1
    M1[M1 · Auth + Onboarding<br/>profiles, anthropometrics,<br/>nutrition_goals, consent_log] --> M2
    M2[M2 · Registro IA no app<br/>foods, meals, meal_items,<br/>triggers, caches, LLM provider] --> M3
    M2 --> M4
    M3[M3 · Dashboard realtime<br/>ProgressRing, MacroBar,<br/>Realtime hooks] --> M5
    M4[M4 · WhatsApp e2e<br/>webhook, idempotência,<br/>handshake §4.5] --> M5
    M5[M5 · Gamificação social<br/>streaks, achievements,<br/>follow por contatos, push] --> M6
    M6[M6 · LGPD + Prod<br/>export/delete, Sentry,<br/>TestFlight + Play Internal]

    %% ── Fase 2 · Transição para rede social ──
    M5 --> M7
    M7[M7 · Feed Social<br/>identidade+username, profiles_private,<br/>posts, foto, likes, comentários] --> M8
    M7 --> M9
    M8[M8 · Análise com IA<br/>insights refeição/dia/semana/mês<br/>via cron, ai_insights] --> M9
    M9[M9 · Compartilhamento externo<br/>cards estilo Strava<br/>client-side view-shot]

    classDef bg fill:#F0FDFC,stroke:#2DD4BF,color:#0F172A
    classDef fase2 fill:#FEF9F0,stroke:#FBBF24,color:#0F172A
    class M0,M1,M2,M3,M4,M5,M6 bg
    class M7,M8,M9 fase2
```

M3 e M4 são independentes depois de M2 (dashboard vs WhatsApp). Tudo o resto é linear.

**Fase 1 = M0–M6** (app de nutrição). **Fase 2 = M7–M9** (transição para rede social), construída sobre o baseline social do M5. M7→M8→M9 é linear; M9 depende de M7 **e** M8 (precisa de "algo" — post ou insight — para compartilhar). O brainstorm e as decisões transversais da Fase 2 estão em [`docs/superpowers/specs/2026-06-12-m7-m9-rede-social-master-plan-design.md`](superpowers/specs/2026-06-12-m7-m9-rede-social-master-plan-design.md).

---

## Riscos e premissas

- **Aprovação WhatsApp/Meta** leva 1–5 dias úteis. Inicia em **M0** mesmo sem usar até M4; o test number da Meta serve para dev.
- **Gemini function calling** ≠ OpenAI tool calls em shape de schema — a camada `LLMProvider` normaliza para o schema canônico de `FEATURES §4.2`.
- **Expo Go não basta** (push, gravação opus, signed audio upload). Dev build EAS desde M2.
- **Server precisa URL pública** para webhook Meta (M4). Plano assume Fly.io (alternativas: Render, Railway).
- TACO pt-BR (~600 alimentos UNICAMP) basta para `foods` no MVP; USDA fica para v2.
- `expo-av` no MVP; migrar para `expo-audio` quando upgrade de SDK.

---

## Layout final do monorepo

```
fitbrother/
├── package.json                # workspaces: apps/*, packages/*
├── .env.example                # vars consolidadas mobile + server
├── tsconfig.base.json
├── .github/workflows/ci.yml
├── apps/
│   ├── mobile/                 # Expo Router
│   │   ├── app/                # rotas (auth, onboarding, tabs, settings)
│   │   ├── components/         # Button, Card, Input (movidos) + domain/
│   │   ├── lib/                # supabase, colors, motion, hooks
│   │   ├── tailwind.config.ts  # movido do root
│   │   └── package.json
│   └── server/                 # Fastify + pg-boss workers
│       ├── src/{routes,services,workers,lib}/
│       └── package.json
├── packages/
│   ├── shared/                 # zod schemas, LLMProvider, prompt-version
│   └── db-types/               # tipos gerados por supabase gen types
└── supabase/
    ├── config.toml
    ├── migrations/             # 0001_*.sql ... 00NN_*.sql
    └── seed/                   # foods (TACO), achievements
```

`CLAUDE.md`, `FEATURES.md`, `DESIGN_SYSTEM.md` permanecem no root.

---

## M0 — Fundação e provisionamento (semana 1)

**Meta:** repo executável; Expo abrindo home com Plus Jakarta carregada; backend `/health` OK; Supabase local subindo; CI verde; contas externas criadas e `.env` preenchido.

### Walkthrough de contas (ordem importa)

1. **Supabase** — org gratuita; projetos `fitbrother-dev` e `fitbrother-staging` (prod só no M6). Salvar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` no 1Password. CLI já vem como `devDependency` do monorepo (`npm install` na raiz).
2. **Google Cloud / Gemini** — projeto GCP → habilitar "Generative Language API" → API key restrita a essa API. `GEMINI_API_KEY`.
3. **OpenAI** — billing com **hard cap USD 20/mês**, `OPENAI_API_KEY` (escopo Whisper).
4. **Meta for Developers** — Business Manager → app *Business* → adicionar produto WhatsApp → usar test number gratuito. Salvar `WHATSAPP_APP_SECRET` (app), `WHATSAPP_VERIFY_TOKEN` (string sua), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`. **Submissão para revisão** (1–5 dias) — não bloqueia M0–M3.
5. **Expo / EAS** — `npx eas-cli@latest login` → `eas init` em `apps/mobile`. `EAS_PROJECT_ID`.
6. **Sentry** — 2 projetos: `fitbrother-mobile` (React Native) e `fitbrother-server` (Node). `SENTRY_DSN_MOBILE`, `SENTRY_DSN_SERVER`.
7. **Cloudflare Tunnel** (dev): `cloudflared tunnel login` — para expor webhook local no M4.

### Tasks de código

- `package.json` raiz com `workspaces: ["apps/*", "packages/*"]` e scripts `dev:mobile`, `dev:server`, `db:start`, `db:reset`, `db:types`, `typecheck`, `lint`.
- `apps/mobile`: `npx create-expo-app . -t blank-typescript`. Deps: `nativewind@^4`, `tailwindcss@^3`, `expo-font`, `@expo-google-fonts/plus-jakarta-sans`, `lucide-react-native`, `react-native-svg`, `react-native-reanimated`, `@gorhom/bottom-sheet`, `expo-haptics`, `@tanstack/react-query`, `zustand`, `@supabase/supabase-js`, `expo-router`, `expo-secure-store`.
- Mover `tailwind.config.ts` raiz → `apps/mobile/tailwind.config.ts`; ajustar `content` para `./app/**/*`, `./components/**/*`.
- Mover `components/{Button,Card,Input}.tsx` → `apps/mobile/components/`. Trocar `EyeIcon` por `<Eye />`/`<EyeOff />` de `lucide-react-native` em `Input.tsx` (linhas 23–39, 100–103).
- `apps/mobile/app/_layout.tsx` carrega fontes via `useFonts`; `SplashScreen.preventAutoHideAsync()` até pronto.
- `apps/mobile/lib/colors.ts` (espelho JS dos tokens Tailwind para SVG/Reanimated), `lib/motion.ts`, `lib/supabase.ts` (client + helpers), `lib/storage.ts` (audio uploads).
- `apps/server`: Fastify + TypeScript + `pino` + `envalid`; rota `GET /health`. Estrutura `src/{routes,services,workers,lib}/`. `tsx watch src/server.ts`.
- `packages/shared`: `zod` schemas (`MealExtractionSchema`, `OnboardingPayloadSchema`), `lib/prompt-version.ts` exporta `LLM_PROMPT_VERSION = "v1"`.
- `supabase init`; primeira migration `0000_init.sql` vazia. `supabase start` (Docker).
- `.env.example` consolidado conforme `FEATURES §7.5` + `EAS_PROJECT_ID`.
- Sentry SDK no mobile (`@sentry/react-native`) e server (`@sentry/node`), DSNs opcionais (no-op se ausentes).
- Husky + lint-staged: ESLint + Prettier + typecheck pre-commit.
- GitHub Actions (`.github/workflows/ci.yml`): typecheck + lint + `supabase db push --dry-run`.

**Feito quando:** `npm run dev:mobile` abre Expo na home com fonte correta; `npm run dev:server` responde `GET /health → 200`; `supabase start` sobe Postgres local; CI verde no primeiro push.

---

## M1 — Auth, onboarding e identidade (semana 2)

**Meta:** novo usuário se cadastra (email+senha), completa os 8 steps de `FEATURES §4.1`, banco fica com `profiles`, `anthropometrics`, `nutrition_goals`, `subscriptions`, `consent_log` populados e protegidos por RLS.

### Migrations (ordem fixa)

- `0001_extensions.sql` — `pgcrypto`, `pg_trgm`, `unaccent`.
- `0002_enums.sql` — todos enums de `FEATURES §3.3` (`activity_level`, `goal`, `meal_type`, `meal_source`, `unit`, `notification_kind`, `wa_direction`, `wa_kind`, `food_source`, `friendship_status`, `consent_scope`, `subscription_plan`, `subscription_status`, `sex`).
- `0003_profiles.sql` — schema completo + trigger `set_updated_at` + RLS `owner_all`.
- `0004_anthropometrics.sql` — append-only + trigger `BEFORE INSERT` calcula `bmr_kcal` (Mifflin-St Jeor) e `tdee_kcal` snapshot do `activity_level` (`sedentary=1.2, light=1.375, moderate=1.55, active=1.725, very_active=1.9`).
- `0005_nutrition_goals.sql` — UNIQUE parcial `WHERE effective_to IS NULL`.
- `0006_subscriptions.sql` — placeholder com default `plan=free, status=active`.
- `0007_consent_log.sql`.
- RLS `owner_all` em todas.

### Backend

- `POST /onboarding/complete` (auth required) — valida payload zod, em transação: insere `profiles`, `anthropometrics`, `nutrition_goals` inicial, `subscriptions`, 3 rows em `consent_log`. Meta inicial: `kcal = TDEE × {lose: 0.8, maintain: 1.0, gain: 1.1, recomp: 0.95}`; `protein_g = peso × {2.0 lose/recomp, 1.6 maintain/gain}`; `fat_g = kcal × 0.25 / 9`; `carbs_g = (kcal − 4·protein − 9·fat) / 4`.
- `GET /me` — profile + meta vigente + último anthropometric.
- Middleware Supabase Auth via JWT no header.

### Mobile

- `app/(auth)/welcome.tsx` — referenciar mocks em `app_example/Welcome Screen*.png`.
- `app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx` — Supabase Auth email+senha. Google/Apple **fora do MVP**.
- `app/(onboarding)/index.tsx` … `step-8.tsx` — 8 telas com Progress Bar (`DESIGN_SYSTEM §11.6`) + Onboarding Nav Buttons (§11.4).
- Wheel picker para peso/altura/idade (`react-native-wheel-pick`).
- Timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` com override.
- Estado entre steps via Zustand (`useOnboardingStore`) — descarta após `POST /onboarding/complete`.
- Tela de termos: 3 checkboxes (`terms`, `privacy`, `ai_processing`) — todos obrigatórios; `policy_version` fixo `"v1.0"`.

**Feito quando:** conta nova → sign-up → completa 8 steps → cai na `(tabs)/index` (placeholder); banco tem 1 row em `profiles`, 1 em `anthropometrics` com BMR/TDEE corretos, 1 em `nutrition_goals` com `effective_to IS NULL`, 3 em `consent_log`, 1 em `subscriptions`; SELECT em `profiles` de A com JWT de B retorna vazio.

---

## M2 — Catálogo `foods` + registro IA no app (semana 3)

**Meta:** usuário registra refeição por texto ou áudio **dentro do app** e ela aparece na lista da home com macros corretos. Pipeline `FEATURES §4.2` end-to-end **sem** WhatsApp.

### Migrations

> Numeração ajustada: M1 ocupou até `0009_anthropometrics_allow_delete.sql`, então M2 começa em `0010`.

- `0010_foods.sql` + índice GIN `name_normalized gin_trgm_ops`.
- `0011_meals.sql` (com `deleted_at`, `review_required`, `total_*` mantidos por trigger — **não** GENERATED, `id uuid PK sem default` pra optimistic UI), índice `(user_id, consumed_at DESC) WHERE deleted_at IS NULL`.
- `0012_meal_items.sql` (ON DELETE CASCADE de `meals` + soft delete próprio em sincronia com parent).
- `0013_meal_triggers.sql` — **STATEMENT-level** trigger em `meal_items` (transition tables) recalcula `meals.total_*` e enfileira recompute de `daily_summaries`. `AFTER UPDATE OF deleted_at ON meals` e `AFTER UPDATE OF review_required ON meals` também disparam recompute.
- `0014_daily_summaries.sql` + função `fitbrother_recompute_daily_summary(p_user_id uuid, p_day date)` que **respeita boundary `day_start_hour`**, pega `pg_advisory_xact_lock` (race-safe) e seta `goal_hit` segundo regra fixa.
- `0015_ai_usage.sql` + função `fitbrother_assert_ai_cap(user, kind)` lança `AI_QUOTA_EXCEEDED`.
- `0016_transcriptions.sql` (`audio_hash` PK).
- `0017_ai_extractions.sql` (`input_hash` PK) + tabela `ai_extraction_hits` separada pra analytics per-user.
- `0018_create_meal_with_items.sql` — RPC atômico (espelhando `complete_onboarding` do M1).
- **Storage bucket `meal-audios`** privado, RLS `auth.uid()::text = (storage.foldername(name))[1]`.
- **Seed `foods`** — script `supabase/seed/foods-taco.ts` baixa CSV TACO/UNICAMP, normaliza (`lower(unaccent(name))`), insere ~600 rows `verified=true source='taco'`.

### Backend

- `packages/shared/llm/provider.ts`:
  ```ts
  export interface LLMProvider {
    extractMeal(input: { text: string; locale: string }): Promise<MealExtraction>;
  }
  ```
- `packages/shared/llm/gemini.ts` — `@google/generative-ai`, function calling com schema canônico (`FEATURES §4.2`).
- `packages/shared/llm/openai.ts` — alternativa via tool calls. Seleção por `LLM_PROVIDER` env (`gemini` default).
- `apps/server/src/services/transcription.ts` — SHA-256 do áudio → lookup `transcriptions` → miss → Whisper (`whisper-1`) → cache.
- `apps/server/src/services/extraction.ts` — `input_hash = sha256(text + LLM_PROMPT_VERSION + locale)` → lookup `ai_extractions` → miss → `LLMProvider.extractMeal` → cache + mede tokens.
- `apps/server/src/services/foods.ts` — para cada item, query `SELECT id, kcal_per_100g, ... FROM foods WHERE name_normalized % $1 AND verified=true ORDER BY similarity DESC LIMIT 1`; se match ≥ 0.6, **sobrescreve macros** pelo catálogo (ajustado para `quantity*unit`).
- `apps/server/src/services/ai-usage.ts` — `assertWithinCap(user_id, day, kind)`; `recordUsage(kind, units, cost_cents)`. `day` calculado pelo boundary.
- `apps/server/src/services/meals.ts` — `createMealFromExtraction(...)` em transação: INSERT `meals`, INSERT `meal_items[]`, UPDATE `ai_usage`. Trigger faz o resto.
- Storage: bucket `meal-audios` privado; RLS `auth.uid() = (storage.foldername(name))[1]`; path `{user_id}/{meal_id}.opus`; signed upload URL via service role.
- **Rotas:**
  - `POST /meals/text` `{ text, consumed_at? }`
  - `POST /meals/audio` (multipart, ≤25MB / ≤10min) — upload → transcribe → extract → create
  - `GET /meals?day=YYYY-MM-DD`
  - `PATCH /meals/:id` (editar items)
  - `POST /meals/:id/confirm` (sai de `review_required`)
  - `DELETE /meals/:id` (soft)
  - `GET /me/daily-summary?day=...`

### Mobile — capture-first (composer persistente)

> Decisão de UX (mai/2026): em vez de FAB + Bottom Sheet, o app adota composer fixo no rodapé (estilo iMessage/WhatsApp) e remove a tab bar. Friends/Profile viram ícones no header superior. Pattern apropriado pra app onde toda visita tem a mesma intenção (registrar refeição).

- `app/index.tsx` — Home com HomeHeader (saudação + ícones Users/User), lista de Meal Cards, EmptyMealsState, MealComposer fixo no rodapé.
- `app/friends.tsx`, `app/profile.tsx` — push do header (placeholders pra M5/M6).
- `app/meal/[id].tsx` — detalhe + edição inline (M3 expande com rings).
- **MealComposer** (`components/domain/MealComposer.tsx`): state machine `idle | typing | recording | processing`. TextInput multiline + mic à direita. Mic vira ➤ quando há texto. Tap mic = recording in-place (input vira waveform + timer + cancel/stop). Long-press mic = hold-to-record. Long-press input = "Adicionar manualmente".
- **AudioRecorder** com `expo-av` (opus 24kbps + metering) — haptics: `Heavy` start, `Success` stop, `Warning` cancel, `Medium` processing, `Success` saved.
- **MealCard** (`components/domain/MealCard.tsx`): §12.3 do DESIGN_SYSTEM, amber border + chip "Revisar" quando `review_required=true`. Swipe-left revela delete.
- **MealSkeleton** durante processamento (2-8s).
- **Optimistic UI** com `client_meal_id` gerado no cliente — server usa como `meals.id`, Realtime de-dup automático.
- **ErrorBanner** sticky abaixo do header pra `AI_QUOTA_EXCEEDED` — desabilita mic, mantém input pra cache hits, CTA full-screen manual.
- React Query para `GET /meals?day=...`; `useMealsRealtime` invalida em UPDATE/INSERT em `meals`.

### Tech debt carregado de M1

- **SecureStore > 2048 bytes** (warning na boot do app, vira erro em SDKs futuros): a sessão Supabase (access + refresh token serializados num único valor) ultrapassa o limite do `expo-secure-store` no iOS. Trocar o storage adapter em `apps/mobile/lib/supabase.ts` por: (a) split em 2 keys (`sb-access` / `sb-refresh`), ou (b) `AsyncStorage` + criptografia em camada acima. Card no Trello (Backlog).

**Feito quando:** "Comi 2 ovos e café" no app → 5–8s depois Meal Card visível com ~140 kcal, ~12g P; segundo registro idêntico não chama Gemini/Whisper (log mostra cache hit); `AI_CAP_LLM_TOKENS=10` → segunda tentativa retorna `AI_QUOTA_EXCEEDED`; `daily_summaries` atualiza após INSERT em `meal_items`; `confidence < 0.6` → `review_required=true` e Meal Card mostra borda warning + chip Confirmar.

**Status M2.3 (texto, sem áudio):** ✅ implementado em 2026-05-23 via branch `m2-3-mobile-capture-first`. Composer + Home + Detalhe com optimistic UI; áudio segue em M2.4 (mic já aparece no composer com handler stub).

**Status M2.4 (áudio):** ✅ implementado em 2026-05-24 via branch `m2-4-audio-capture`. Hold-to-record WhatsApp-style com waveform animado, upload direto pro Storage, Whisper-1 com cache SHA-256, extração reaproveita Gemini (agora normalizando pra PT-BR canonical). MealCard atualizado pra listar itens em linhas. Pull-to-refresh + skeleton em linhas como polimento. PR #5 + #6 merged.

---

## M3 — Dashboard realtime, edição, histórico (semana 4)

**Meta:** home final renderizando Progress Ring hero + 3 rings de macro, atualizando em tempo real, com edição inline e histórico navegável.

### Backend

- View `vw_today_summary(user_id)` retorna linha de `daily_summaries` para o `day` atual calculado por boundary.
- Função `fitbrother_today(user_id)` retorna `date` atual respeitando `timezone + day_start_hour`.
- Habilitar Realtime no Supabase em `daily_summaries` e `meals`.

### Mobile

- `components/domain/ProgressRing.tsx` — SVG circular, animação Reanimated com `Motion.duration.slow` decelerate. Props conforme `DESIGN_SYSTEM §12.1`.
- `components/domain/MacroBar.tsx` (§12.2).
- `components/domain/MealCard.tsx` (§12.3) — estados `review_required`, fonte WA.
- `app/(tabs)/index.tsx` finalizada — header (saudação + StreakCounter placeholder), Progress Ring hero 160 (calorias), 3 rings 80 (P/C/G), lista Meal Cards, Empty State (§12.10).
- `app/meal/[id].tsx` — detalhe + edição de items; botão Confirmar; Skeleton (§12.11) no loading.
- `app/history/index.tsx` — agrupada por dia, infinite scroll por semana via `daily_summaries`.
- Hooks: `useDailySummaryRealtime(user_id)` assina `realtime:public:daily_summaries:user_id=eq.<id>` e invalida React Query. `useMealsRealtime(user_id, day)` análogo.
- (Sem tab bar — Friends/Profile via ícones no HomeHeader já implementados em M2.4. M3 só polirá o header com StreakCounter.)

**Feito quando:** dia com 3 refeições renderiza com macros e rings corretos; deletar meal → ring atualiza em <1s sem refresh manual; 2 dispositivos do mesmo user logados refletem em <2s; edição de `quantity` recalcula totais.

**Status M3.1 (rings + realtime):** ✅ implementado em 2026-05-24 via branch `m3-1-dashboard`. ProgressRing SVG animado, 1 hero kcal (160) + 3 rings macro (80) como `ListHeaderComponent` na Home, hooks `useDailySummary` + `useDailySummaryRealtime` + `useMealsRealtime`, view `vw_today_summary` (security_invoker), RPC `fitbrother_today()`, endpoint `GET /me/daily-summary` com empty fallback. Edição inline + history em M3.2.

**Status M3.2 (edit + history):** ✅ implementado em 2026-05-25 via branch `m3-2-edit-history`. EditMealModal full-screen com `useReducer`, validação via `PatchMealItemSchema`, add/remove items, totais derivados. History list paginada por semana via `useInfiniteQuery` + `GET /me/daily-summaries` (cap 31d). HistoryDayCard com hero kcal + 3 MacroBars + meals_count. HistoryEmptyDayCard (visual motivacional, sem CTA — backfill em M3.3). Drill-down: history → history/[day] (read-only) → meal/[id] (com edit/delete). Calendar icon no HomeHeader. M3 completo.

---

## M4 — WhatsApp end-to-end (PAUSADO — Meta business verification recusada em 2026-05-22)

> **Status:** Pausado. Meta recusou a business verification em mai/2026. Sequência ajustada: M0 → M1 → M2 → M3 → **M5 → M6** → M4 (quando Meta destravar). Test number da Meta continua funcionando pra dev sem verification.

**Meta:** áudio/texto no WhatsApp aparece no app em <8s; idempotência funciona; cota respeitada; verificação de telefone via handshake.

### Pipeline canônico (ordem obrigatória — `FEATURES §6`)

```
Meta WA ──► POST /webhooks/whatsapp
              │ 1. valida HMAC x-hub-signature-256
              │ 2. INSERT wa_messages (provider_message_id UNIQUE)
              │    └─ conflito → 200 OK, return
              │ 3. responde 200 imediato; enfileira pg-boss job
              ▼
         wa-processor worker
              │ 4. match profiles.phone_e164
              │    └─ sem match → reply onboarding deep link, return
              │ 5. ai_usage.assertWithinCap → excedido → reply "limite", return
              │ 6. áudio? Media URL + bearer → SHA-256 → transcriptions cache
              │ 7. comando (/hoje, /meta, /streak)? canned reply, return
              │ 8. extraction (ai_extractions cache, prompt_version)
              │ 9. foods fuzzy match (≥0.6 → sobrescreve macros)
              │ 10. tx: INSERT meals + meal_items + UPDATE ai_usage
              │ 11. wa-client.sendText (janela aberta — inbound recém-chegou)
              │ 12. UPDATE wa_messages.processed_at = now()
              ▼
   Trigger meal_items ──► daily_summaries ──► Realtime ──► app
```

Falha após passo 8 → `processed_at IS NULL` → cron retry; caches em 6 e 8 evitam pagar IA duas vezes.

### Migrations

- `0016_wa_conversations.sql`.
- `0017_wa_messages.sql` com `provider_message_id UNIQUE` + trigger `AFTER INSERT WHERE direction='in'` que atualiza `profiles.wa_window_expires_at = now() + interval '24 hours'` e (se primeira inbound) `phone_verified_at = now()`.
- Índice `wa_messages (user_id, processed_at) WHERE processed_at IS NULL` (fila de retry).

### Backend

- `apps/server/src/routes/webhooks/whatsapp.ts`:
  - GET: valida `hub.verify_token`.
  - POST: valida HMAC com `WHATSAPP_APP_SECRET` (timing-safe); responde 200 em <20s; enfileira `pg-boss` job `wa-process`.
- `apps/server/src/workers/wa-processor.ts` — segue ordem do diagrama acima.
- `apps/server/src/services/wa-client.ts` — `sendText(to, body)`, `sendInteractive(to, action)`. Lança `WaWindowClosed` se `wa_window_expires_at <= now()`. **Nunca** envia template pago.
- Cron 5min: reprocessa `wa_messages WHERE processed_at IS NULL AND created_at > now() - 24h`.

### Verificação de telefone (handshake — `FEATURES §4.5`)

- `app/(onboarding)/connect-whatsapp.tsx` — deep link `wa.me/<bot_phone>?text=Vamos%20começar` + QR (`react-native-qrcode-svg`).
- App polla `GET /me` até `phone_verified_at IS NOT NULL` (ou Realtime em `profiles`).
- Bot responde com mensagem de boas-vindas após primeira inbound.
- Skippable; pode ser concluído depois em Perfil.

### Operação

- Cloudflare Tunnel local: `cloudflared tunnel run` → URL pública estável apontada no Meta Developer Console.
- Deploy server staging em Fly.io: `fly launch` + `fly secrets set ...`. URL pública estável serve para Meta apontar.
- Test number Meta cobre validação enquanto app review está pendente.

**Feito quando:** áudio "almocei 200g de arroz e frango" no WhatsApp → 5–8s depois Meal Card no app; reenviar mesma `provider_message_id` não duplica meal; `/hoje` retorna macros do dia; `AI_CAP=0` → bot responde "limite atingido" e não cria meal; handshake → `phone_verified_at` setado + welcome chega.

---

## M5 — Gamificação social (semana 6)

**Meta:** streak diário funciona, conquistas desbloqueiam, amigos competem no ranking semanal, push notifications chegam.

> **Numeração:** M2/M3 ocuparam até `0024`, então o M5 começa em `0025` (não `0018` como rascunhado abaixo). Fatiado em M5.1 (streaks) → M5.2 (achievements + push) → M5.3 (friends + leaderboard + alertas).

### Migrations

- `0025_streaks.sql` (PK `user_id`) — **feito (M5.1)**.
- `achievements.sql` + seed 10 conquistas: streak 3/7/14/30, primeiro registro, 50 refeições totais, 7 dias com `goal_hit` numa semana, primeiro amigo, primeira refeição via WhatsApp, primeira semana completa.
- `user_achievements.sql` (PK composta).
- `friendships.sql` + view `friends_summaries_view` (UNION dos dois lados quando `status='accepted'`; expõe **apenas** `day, goal_hit, meals_count` — nunca macros).
- `push_tokens.sql`.
- `notifications.sql`.

### Backend

- Cron horário `streak-tick` (pg-boss): para usuários cujo `EXTRACT(HOUR FROM now() AT TIME ZONE timezone)::int = day_start_hour`, avalia o dia que fechou. **Feito (M5.1):** infra pg-boss criada (`lib/jobs.ts` + `workers/streak-tick.ts`, schema `pgboss`, agenda `0 * * * *` UTC). A lógica vive em SQL (`fitbrother_streak_tick` → `fitbrother_apply_streak`, migration `0025`): em vez de incrementar, **deriva** `current_streak` recontando o run consecutivo de `goal_hit` terminando no dia — idempotente e auto-corrige após edição/backfill de dias passados.
- Trigger `AFTER UPDATE` em `daily_summaries` → enfileira `evaluate-achievements`.
- Worker `evaluate-achievements` lê `achievements.criteria_json` (DSL: `{"type":"streak","value":N}`, `{"type":"meals_total","value":N}`, `{"type":"weekly_hits","value":N}`); avalia; INSERT em `user_achievements` se cruzar limiar; enfileira `dispatch-notification`.
- `services/notifications.ts → dispatch(user_id, notif)`:
  - sempre tenta push (Expo Push API) se houver `push_tokens` ativos;
  - se `wa_window_expires_at > now()` também envia WA;
  - grava 1 row em `notifications` por canal tentado.
- Cron 21h (boundary do usuário) — `streak-alert`: usuários com `last_hit_day = ontem` e nenhum meal hoje recebem aviso.
- Cron 19h — `goal-reminder`: kcal < 70% da meta e janela WA aberta → reminder.
- **Rotas:** `POST /push-tokens`, `POST /friends/request`, `POST /friends/:id/accept`, `POST /friends/:id/decline`, `GET /friends`, `GET /leaderboard/weekly` (agrega últimas 7 noites em `friends_summaries_view`), `GET /achievements`, `GET /me/achievements`.

### Mobile

- Pedido de permissão de notificação ao fim do onboarding (`expo-notifications`); token → `POST /push-tokens`.
- `components/domain/StreakCounter.tsx` (§12.4) — pulse infinito ativo; grayscale em risco; respeitar `useReducedMotion()`.
- `app/(tabs)/friends.tsx` — busca por phone (gate em `phone_verified_at`), pedidos pendentes, lista de amigos, leaderboard semanal (`LeaderboardRow` §12.13).
- Toast hero (§12.12 `variant=info` custom) quando recebe push `kind=achievement`.
- StreakCounter no header da Home (substitui placeholder M3).

**Feito quando:** 3 dias `goal_hit=true` consecutivos → `streaks.current_streak = 3`; adicionar amigo por phone funciona; ranking semanal mostra ambos; push de risco às 21h do dia nutricional (simulável); conquista "Primeiro Streak" mostra toast + push; `friends_summaries_view` **não** expõe macros (validar via SQL com JWT de amigo).

**Status M5.3 (social — follow por contatos + leaderboard + alertas):** ✅ implementado em 2026-05-27 na branch `m5-3-social-follow-contacts`. **Pivot de modelo:** em vez de amizade pedido→aceite, **follow assimétrico estilo Duolingo** descoberto por contatos do telefone. Migrations `0030` follows (PK composta + anti-self), `0031` contact_links (grafo hasheado), `0032` `profiles.phone_hash`, `0033` `following_summaries_view` (só day/goal_hit/meals_count — sem macros) + RPC `fitbrother_weekly_leaderboard` (`window_streak` derivado da janela de 7d, não vaza streak privado), `0034` `friends_total` real via follows + trigger `first_friend`, `0035` `fitbrother_streak_alert` (push 21h) + `fitbrother_goal_reminder` (WA dormente, M4 pausado), `0036` `fitbrother_streak_at_risk`. Gate social = **OTP/SMS via Supabase Auth** (substitui o handshake WA): rota `POST /me/verify-phone` (lê `auth.users.phone_confirmed_at` via service-role, carimba profile + dispara reverse-match). Rotas `POST /contacts/sync` (só hashes SHA-256 trafegam; nunca número em claro), `GET /following`, `GET /leaderboard/weekly`; `GET /me/streak` agora retorna `at_risk`. Workers `streak-alert`/`goal-reminder` (cron UTC, lógica em SQL). Mobile: `lib/contacts.ts` (expo-contacts + libphonenumber-js + expo-crypto), `lib/api/social.ts`, hooks (`useFollowing`/`useWeeklyLeaderboard`/`useVerifyPhone`/`useSyncContacts`), `LeaderboardRow` (§12.13), tela Amigos reescrita (OTP → conectar contatos → ranking), tela de Conquistas + entrada no Perfil, `StreakCounter.atRisk` ligado no `HomeHeader`. Verificado: typecheck + lint limpos, boot smoke (workers agendados), checks SQL (`scripts/checks/m5-3-social.*`) + teste e2e rolled-back (follow→first_friend, leaderboard ordena rede). **Não rodado visualmente** (OTP/contatos/push exigem device). **Follow-ups (fora do código deste PR):** alinhar `FEATURES.md` (amigos→follow, `friends_summaries_view`→`following_summaries_view`); M6/LGPD incluir `follows`+`contact_links` no export/delete; `goal_reminder` sai de dormente quando M4 (WA) voltar; configurar provider SMS real (Twilio/MessageBird) em staging/prod.

**Status M5.2 (achievements + push):** ✅ implementado em 2026-05-27 na branch `m5-2-achievements-push`. Migrations `0026` push_tokens, `0027` notifications (outbox), `0028` achievements + user_achievements + seed 10 + `fitbrother_evaluate_achievements` (DSL `criteria_json`: streak/meals_total/wa_meals_total/weekly_hits/days_active/friends_total) + triggers AFTER em daily_summaries/streaks, `0029` user_achievements no realtime. Rotas `GET /achievements`, `GET /me/achievements`, `POST /push-tokens`. `services/notifications.ts` + worker `dispatch-notification` (pg-boss 1/min, Expo Push, só push). Mobile: `expo-notifications`/`expo-device`, `lib/push.ts` (permissão + token no entry do app), `Toast` (§12.12) + `ToastProvider`, `useAchievementsRealtime` (toast instantâneo via Realtime). Backend verificado via SQL + e2e (dispatch → row stamped); UI mobile tipada/lintada mas **não rodada visualmente** (push exige device). **Pendentes pro M5.3:** `friends_total` (precisa friendships) e o estado "em risco" do StreakCounter. Tela de listagem de conquistas não foi feita (toast + dados via hooks já existem).

**Status M5.1 (streaks):** ✅ implementado em 2026-05-26 na branch `m5-1-streaks`. Migration `0025` (tabela + `fitbrother_apply_streak`/`fitbrother_streak_tick`, RLS owner-read, lógica derive-based testada via SQL em 5 cenários: 3-consecutivos, idempotência, miss-reseta, gap, goal_hit=false). Infra pg-boss nova (`lib/jobs.ts`, `workers/streak-tick.ts`, `DATABASE_URL` no env) com cron horário UTC — worker validado e2e (enfileira job → `streak_tick_done`). `GET /me/streak` + `StreakSchema` no shared. Mobile: `useStreak` + `StreakCounter` (§12.4, pulse/risco/quebrado, `useReducedMotion`) no `HomeHeader`. **Pendente pro M5.3:** estado "em risco" (`atRisk`) precisa do reset-time + hit de hoje. Achievements + push = M5.2.

---

## M6 — LGPD, observabilidade, produção (semana 7+)

**Meta:** app pronto para usuários reais — exportar/deletar dados, custos sob controle, alertas configurados, builds em TestFlight + Play Internal.

### Migrations

- Tabela auxiliar `metrics_daily(day, metric, value)` para histórico de custo/sucesso.

### Backend

- **LGPD:**
  - `GET /account/export` → ZIP com JSON dos dados próprios, incluindo perfil,
    nutrição, refeições, consentimentos, social, notificações e IA; binários
    aparecem apenas no manifesto.
  - `DELETE /account` → marca `auth.users.deleted_at` + soft delete em cascata.
  - Cron diário `purge-accounts`: hard delete de usuários com `deleted_at < now() - 30 days`.
  - `POST /account/consent` `{ scope, granted: boolean }` → atualiza `consent_log.revoked_at`.
- Cron diário `purge-audios`: deleta áudios de `meal-audios` cujo `meals.created_at < now() - 30 days`.
- **Sentry:** contexto `user_id`, breadcrumbs do pipeline §6 com `request_id`.
- **Logs pino** estruturados com `user_id`, `wa_message_id`, `meal_id`, `request_id` em cada etapa.
- **Métricas** (cron diário em `metrics_daily`): taxa de sucesso de extração (`confidence >= 0.6`), p50/p95 latência por etapa, custo agregado por modelo.
- **Alerta WA:** removido do M6 em 2026-07-24; volta ao M4 quando o pipeline
  WhatsApp e `wa_messages` forem retomados.

### Mobile

- `app/(tabs)/profile.tsx` — settings: exportar dados, deletar conta, gerenciar consentimento granular, alterar timezone, alterar `day_start_hour`.
- Tela "Sobre" com versão (`Constants.expoConfig.version`) + links Termos/Privacidade.

### Ops

- Provisionar Supabase **prod** (rodar TODAS migrations + seed `foods`).
- Deploy server prod (Fly.io) com autoscale básico + health check.
- EAS Build + Submit: TestFlight (iOS) e Play Console Internal Testing (Android).
- Submissão final WhatsApp Business à Meta (display name + ícone + business verification).
- Política de Privacidade + Termos publicados em URL fixa, versionados (`policy_version`).
- PITR backup Supabase (plano Pro — avaliar custo).
- **Runbook** (`docs/runbook.md`): webhook preso, cota Gemini/OpenAI estourada globalmente, Sentry alertando pipeline, RLS bug, recuperação de áudio deletado.

**Feito quando:** usuário exporta JSON do próprio dado; deleta conta; após 30d simulado, hard delete via cron; build TestFlight + Play Internal instalado; smoke test e2e funciona; Sentry recebe erros com `user_id`; custo diário visível em `metrics_daily`; runbook commitado.

**Status técnico sem deploy (2026-07-24):** backend LGPD endurecido com exclusão
reversível, reativação após novo login, consentimento de IA obrigatório e
imutável, purges D+30, métricas UTC, contexto estruturado e runbook. O gate de
produção (Supabase/Fly/Sentry externo/lojas/Meta/políticas/PITR) permanece
deliberadamente deferido e não bloqueia o início do M10.

---

# ═══ Fase 2 — Transição para rede social (M7–M9) ═══

> Expansão do app de nutrição para uma **rede social com foco em gamificação e engajamento**, sobre o core de IA já existente. Decisões transversais e rationale completo em [`docs/superpowers/specs/2026-06-12-m7-m9-rede-social-master-plan-design.md`](superpowers/specs/2026-06-12-m7-m9-rede-social-master-plan-design.md). Cada fase abaixo ganha seu próprio design datado em `specs/` antes de implementar, como os milestones anteriores.
>
> **Decisões já fixadas:** feed fechado a seguidores **com macros visíveis** (snapshot no post); foto opcional anexada no post (não mexe no core de registro); análises de IA **automáticas via cron**; `username` para descoberta + telefone movido para `profiles_private` (blindagem estrutural); geração de card **client-side** (`react-native-view-shot` + `expo-sharing`).

---

## M7 — Feed Social + Identidade & Descoberta

**Meta:** usuário escolhe username, encontra/segue alguém por busca, publica refeições (foto+legenda+macros) e vê/curte/comenta posts de quem segue num feed. Telefone migrado para `profiles_private`; nenhuma projeção social expõe telefone.

> **Numeração:** migrations existentes vão até `0036`, então M7 começa em `0037`.

### Infra — Identidade & Descoberta (pré-requisito)

- `0037_profiles_identity.sql` — `profiles.username citext UNIQUE`, validação `^[a-z0-9_.]{3,20}$` + `profiles.avatar_url`.
- `0038_profiles_private.sql` — tabela `profiles_private` (1:1, `phone_e164`/`phone_hash`/`phone_verified_at`), RLS owner + service-role only; **migration de movimentação** das colunas de `profiles` com backfill; atualizar `verify-phone` e o reverse-match de contatos para gravar/ler aqui.
- `0039_public_profiles.sql` — view/RPC `public_profiles` expondo **somente** `{user_id, username, display_name, avatar_url}`. Toda UI social lê só por aqui; `profiles` permanece `owner_all`.
- `0040_post_images_bucket.sql` — bucket `post-images` privado (RLS por prefixo `{user_id}/`, MIME image/jpeg|png|webp) — também serve avatares.

### Migrations (feed)

- `0041_posts.sql` — `posts(id, user_id, meal_id FK nullable, caption, image_path, total_kcal/protein_g/carbs_g/fat_g snapshot, created_at, deleted_at)`. RLS: leitura quando autor é o caller **ou** o caller segue o autor (join em `follows`); escrita só do dono.
- `0042_post_likes.sql` — PK composta `(post_id, user_id)`.
- `0043_post_comments.sql` — `id, post_id, user_id, body, created_at, deleted_at`.
- Realtime em `posts`/`post_likes`/`post_comments` para contagens ao vivo.

### Backend

- `GET /users/search?q=` (resolve via `public_profiles`).
- `POST /posts` `{ meal_id?, caption, image_path? }` — copia snapshot de macros da meal na publicação.
- `GET /feed` (posts de quem o caller segue, cronológico, paginado), `GET /posts/:id`, `DELETE /posts/:id` (soft).
- `POST /posts/:id/like` / `DELETE /posts/:id/like`; `POST /posts/:id/comments`, `GET /posts/:id/comments`, `DELETE /comments/:id` (soft).
- Notificações: novos `kind` `post_like`/`post_comment` reusando `notifications` + `dispatchPendingPush`.

### Mobile

- **Tab bar nova** (hoje é Stack): **Hoje · Feed · Amigos · Perfil**.
- CTA "Compartilhar no feed" na tela de detalhe/home após a IA salvar a refeição → tela **Novo Post** (foto opcional via camera/galeria + legenda + preview do card de macros).
- `FeedScreen` (lista de `PostCard`), `PostCard`/`PostHeader`/`LikeButton`/`CommentButton`/`CommentInput`.
- Busca de usuários por username; escolha de username no onboarding/perfil; upload assinado de avatar.

**Feito quando:** username escolhido; busca acha/segue usuário; post com foto+legenda+macros publicado; feed mostra posts de quem segue com like/comentário funcionando em realtime; telefone em `profiles_private` e `SELECT` em qualquer projeção social **não** retorna telefone (validar via SQL com JWT de terceiro).

**Status M7.1 (Identidade & Descoberta):** ✅ implementado em 2026-06-12 na branch `feat/social-media`. Migrations `0037–0040` adicionam `username`/`avatar_url`, movem telefone para `profiles_private` com RLS owner-only, criam `public_profiles` sem telefone, refatoram o leaderboard para a projeção pública e criam o bucket privado `post-images`. Backend atualizado: `/me/verify-phone`, `/contacts/sync`, reverse-match, `/following`, novas rotas `GET /users/search`, `GET /users/username-available`, `POST /follows`, `DELETE /follows/:followeeId`. Mobile atualizado: step de username/avatar opcional antes dos termos, busca de usuários por username no header e seguir por username. Verificação: `npm run db:reset`, `./scripts/checks/m7-1-identity.sh`, `npm run typecheck` e `npm run lint` passam; e2e visual/device de avatar/onboarding/busca não rodado nesta sessão. M7.2 começa em `0041` (posts/feed core).

**Status M7.2 (Feed core):** ✅ implementado em 2026-06-13 na branch `feat/social-media`. Migration `0041_posts.sql` cria `posts` com snapshot de macros, RLS de leitura para autor/seguidores, soft-delete e unicidade por `(user_id, meal_id)`; `0042_achievement_feed_posts.sql` permite posts de conquistas desbloqueadas no mesmo feed. Backend novo em `routes/posts.ts`: `POST /posts`, `POST /posts/achievement`, `GET /feed`, `GET /posts/:id`, `DELETE /posts/:id`; `GET /feed` retorna posts próprios + followees com `author` vindo de `public_profiles` e, quando aplicável, dados de `achievement`. Mobile: botão Feed no header, tela `Feed`, `PostCard` com variantes refeição/conquista, CTA "Compartilhar no feed" no detalhe da refeição, tela `Novo post` com legenda + preview de macros e botão de compartilhar conquistas desbloqueadas na tela Conquistas. Verificação: `npm run db:reset`, `npm run db:types`, `npm run typecheck`, `npm run lint` e smoke real `/feed` com JWT da Alice retornando 15 posts (10 refeições + 5 conquistas). Fora desta fatia: foto do post, likes, comentários, notificações sociais e realtime de contagens (M7.3).

**Status M7.3 (Engajamento — likes + comentários + foto no post):** ✅ implementado em 2026-06-19 na branch `feat/m7-3-engagement`. Migrations `0046` (kinds `post_like`/`post_comment`), `0047_post_likes` e `0048_post_comments` — ambas com RLS atrelada à visibilidade do post, triggers que mantêm `posts.like_count`/`comment_count` (padrão `meals.total_*`) e realtime (`posts`/`post_likes`/`post_comments` no publication). Backend (`routes/posts.ts`): `POST/DELETE /posts/:id/like` (notifica autor só em like novo; ator≠autor), `GET/POST /posts/:id/comments`, `DELETE /comments/:id`; `GET /feed` e `GET /posts/:id` agora retornam `liked_by_me`; novos cases de push `post_like`/`post_comment` em `notifications.ts`. Mobile: `LikeButton` (otimista), footer de like/comentário no `PostCard`, tela `post/[id]` com comentários + input, foto opcional no `Novo post` (`expo-image-picker` → bucket `post-images`, render via signed URL), `usePostsRealtime` ligado no Feed. Verificação: `npm run db:reset` + `./scripts/checks/m7-3-engagement.sh` (4 checks, triggers de contagem exercitados em transação) + `npm run typecheck`/`lint` passam. **Não rodado em device** (like/comentário/foto/realtime/push exigem device). **M7 (Feed Social) concluído.** Próximo: M8 (Análise com IA).

---

## M8 — Análise com IA (insights)

**Meta:** IA como conselheira sobre os dados já coletados, em 4 níveis (refeição/dia/semana/mês), com cache e quota respeitados.

> **Numeração:** começa após o M7 (≈ `0043+`).

### Camada de insights (infra §4.3 do master plan)

- `LLMProvider.generateInsight(payload, periodType)` — segundo método além de `extractMeal`.
- Cache próprio keyed por `hash(payload_agregado + INSIGHT_PROMPT_VERSION + period_type)`; **linha de quota dedicada** em `ai_usage`; `INSIGHT_PROMPT_VERSION` em `packages/shared`.
- Saída estruturada (zod): `{ title, bullets[], score, tone }`.

### Migrations

- `ai_insights(id, user_id, period_type enum[meal|day|week|month], period_start, payload jsonb, created_at)`.
- Enum `insight_period`.

### Backend

| Nível | Gatilho | Conteúdo |
|-------|---------|----------|
| Refeição | junto da extração (barato) | feedback curto ("Ótima fonte de proteínas!"). |
| Dia | cron no fim do dia (por timezone/`day_start_hour`) | wrap-up: metas batidas + incentivo. |
| Semana | cron semanal | tendências (açúcar, hidratação, consistência). |
| Mês | cron mensal | tendências de longo prazo. |

- Workers cron montam payload **agregado e compacto** (summaries por dia, nunca refeição crua); só geram para usuários com **dados suficientes** no período.
- Entrega: push `kind=insight_ready` + card no app.

### Mobile

- Tela/aba de análises com cards de insight (refeição/dia/semana/mês); card disponível para compartilhar (M9).

**Feito quando:** usuário recebe feedback de refeição, wrap-up diário e relatórios semanal/mensal gerados por cron; segunda geração idêntica do mesmo período é cache hit; quota dedicada respeitada.

> Design detalhado: [`docs/superpowers/specs/2026-06-19-m8-ai-analysis-design.md`](superpowers/specs/2026-06-19-m8-ai-analysis-design.md). Fatiado em M8.1 (feedback de refeição) e M8.2 (insights de período). Insights ancorados no dado existente (kcal/macros/goal_hit/refeições) — sem açúcar/hidratação (não rastreados).

**Status M8.1 (Feedback da refeição — piggyback):** ✅ implementado em 2026-06-19 na branch `feat/m8-ai-analysis` (PR #17 merged). Migration `0049` adiciona `meals.ai_feedback` e atualiza a RPC `create_meal_with_items` para persistir `payload.ai_feedback`. `MealExtractionSchema` ganha `feedback` e a function-declaration/system-prompt do Gemini passam a retornar uma frase curta junto da extração (zero chamada extra); `LLM_PROMPT_VERSION` bumpado para `v2` (invalida cache antigo). Os 3 fluxos de criação (texto/áudio/foto) threadam `ai_feedback` pela RPC; `MEAL_DETAIL_SELECT` e `MealResponseSchema` expõem o campo. Mobile mostra o feedback (com ícone Sparkles) no detalhe da refeição. Verificação: `db:reset` + `./scripts/checks/m8-1-feedback.sh` + `typecheck`/`lint`. **Testado em device.**

**Status M8.2 (Insights de período — dia/semana/mês):** ✅ implementado em 2026-06-19 na branch `feat/m8-2-insights`. Migrations `0050` (enum `insight_period` + tabela `ai_insights` com RLS owner-read + função `fitbrother_insight_targets(period)` que seleciona o período recém-fechado elegível — dia=ontem c/ refeição; semana só quando `ISODOW=1`; mês só no dia 1; ≥3 dias p/ semana/mês — e devolve payload agregado) e `0051` (kind `insight_ready`). `LLMProvider.generateInsight` + impl Gemini (structured output, `InsightContentSchema` = title/headline/bullets/score/tone); `INSIGHT_PROMPT_VERSION`. Serviço `insights.ts` é **idempotente por `source_hash`** (re-run com mesmo dado não paga IA), faz upsert e enfileira push `insight_ready`. Workers pg-boss: dia horário, semana/mês diário (a função SQL só retorna alvos no boundary). Rotas `GET /me/insights[?period=]` e `/me/insights/:id`. Mobile: tela de Análises (segmento Dia/Semana/Mês + `InsightCard`), ícone Sparkles no header. Verificação: `db:reset` (→0051) + `./scripts/checks/m8-2-insights.sh` (schema/RLS/targets) + `typecheck`/`lint`. **Não rodado em device** (geração real exige Gemini + cron/dados). Insights ancorados no dado existente (kcal/macros/goal_hit/refeições) — sem açúcar/hidratação. **M8 concluído.** Próximo: M9 (cards compartilháveis estilo Strava).

---

## M9 — Compartilhamento externo (cards estilo Strava)

**Meta:** motor de aquisição orgânica — usuário gera e compartilha externamente um card a partir de um post do feed **ou** de uma análise de IA.

> Sem infra nova de servidor (abordagem client-side). Depende de M7 (post) e M8 (insight).

### Mobile

- `ShareCard` (variantes 9:16 Stories e quadrado WhatsApp) renderizado com o próprio design system: foto do usuário + dados/insight + marca d'água/logo.
- Captura via `react-native-view-shot` → compartilhamento via `expo-sharing` (share sheet nativo).
- Entradas de "Gerar card" no `PostCard` e no card de insight.

### v2 (fora de escopo)

- Render server-side (canvas/headless) + deep-link público compartilhável.

**Feito quando:** usuário gera card (story e quadrado) a partir de um post e de uma análise de IA, com marca d'água do app, e dispara o share sheet nativo.

> Design detalhado: [`docs/superpowers/specs/2026-06-19-m9-share-cards-design.md`](superpowers/specs/2026-06-19-m9-share-cards-design.md). MVP: **só Stories 9:16** (quadrado fica pra v2).

**Status M9 (Compartilhamento externo):** ✅ implementado em 2026-06-19 na branch `feat/m9-share-cards` (empilhada em `feat/m8-2-insights`). Client-side, sem backend: deps `react-native-view-shot` + `expo-sharing` + `expo-media-library`. `ShareCard` 9:16 (variantes refeição/post com foto+macros e insight com título/headline/bullets/score, marca d'água wordmark+folha). `lib/share-card.ts` (`captureCard`/`shareCard`/`saveCardToGallery` com pedido de permissão). Tela de preview `share/[type]/[id]` busca o dado (`getMeal`/`fetchPost`/`fetchInsight`) e oferece **Compartilhar** (share sheet) + **Salvar** (galeria). Pontos de entrada: `PostCard`, `InsightCard` e detalhe da refeição (distinto do "Compartilhar no feed"). Verificação: `typecheck`/`lint` passam. **Não rodado em device** — os módulos nativos exigem um **novo dev build** (o dev client atual não os tem); sem checks SQL (UI pura). **M9 e a Fase 2 (rede social) concluídos.**

---

## Verificação end-to-end (após M6)

Cenário: **Maria** (nova) e **João** (existente), amigos.

1. Maria instala build TestFlight → sign-up email → completa onboarding 8 steps → conecta WhatsApp via handshake.
2. Maria envia áudio "café com pão e mamão" no WhatsApp → 5–8s depois Meal Card visível no app via Realtime.
3. Maria registra mais 2 refeições no app via texto, atinge meta → `daily_summaries.goal_hit=true`.
4. Cron horário no `day_start_hour` da Maria incrementa `streaks.current_streak = 1`.
5. João adiciona Maria por phone; aceite; leaderboard semanal mostra ambos.
6. Conquista "Primeiro Registro" desbloqueia para Maria; toast + push.
7. Aos 21h boundary, Maria sem refeição hoje → push de alerta.
8. Maria pede `GET /account/export` no Settings → recebe ZIP.
9. Maria deleta conta → some das views; D+30, hard delete via cron.

---

## Arquivos críticos por milestone (atalho)

- **M0:** `package.json` (root), `apps/mobile/{package.json, tailwind.config.ts, app/_layout.tsx, lib/colors.ts, lib/supabase.ts}`, `apps/server/src/server.ts`, `supabase/config.toml`, `.env.example`, `.github/workflows/ci.yml`.
- **M1:** `supabase/migrations/0001..0007*.sql`, `apps/server/src/routes/{onboarding,me}.ts`, `apps/mobile/app/(auth)/*`, `apps/mobile/app/(onboarding)/*`.
- **M2:** `supabase/migrations/0008..0015*.sql`, `supabase/seed/foods-taco.ts`, `packages/shared/llm/{provider,gemini,openai}.ts`, `apps/server/src/services/{transcription,extraction,foods,ai-usage,meals}.ts`, `apps/server/src/routes/meals.ts`, `apps/mobile/components/domain/MealCard.tsx`, `apps/mobile/app/(tabs)/index.tsx`.
- **M3:** `apps/mobile/components/domain/{ProgressRing,MacroBar}.tsx`, `apps/mobile/lib/hooks/{useDailySummaryRealtime,useMealsRealtime}.ts`, `apps/mobile/app/meal/[id].tsx`, `apps/mobile/app/history/index.tsx`.
- **M4:** `supabase/migrations/0016..0017*.sql`, `apps/server/src/routes/webhooks/whatsapp.ts`, `apps/server/src/workers/wa-processor.ts`, `apps/server/src/services/wa-client.ts`, `apps/mobile/app/(onboarding)/connect-whatsapp.tsx`.
- **M5:** `supabase/migrations/0018..0023*.sql`, `apps/server/src/workers/{streak-tick,evaluate-achievements,streak-alert,goal-reminder}.ts`, `apps/server/src/services/notifications.ts`, `apps/server/src/routes/{friends,push-tokens,achievements,leaderboard}.ts`, `apps/mobile/components/domain/{StreakCounter,LeaderboardRow}.tsx`, `apps/mobile/app/(tabs)/friends.tsx`.
- **M6:** `apps/server/src/routes/account.ts`, `apps/server/src/workers/{purge-accounts,purge-audios,metrics-daily}.ts`, `apps/mobile/app/(tabs)/profile.tsx`, `docs/runbook.md`.

---

## Reuso explícito

- Componentes `Button`, `Card`, `Input` já existentes em `components/` (movidos para `apps/mobile/components/` no M0) — não reimplementar.
- Tokens de cor/tipo/espaço de `tailwind.config.ts` — referência única, sem duplicar HEX em código (`lib/colors.ts` espelha para SVG/Reanimated).
- Schemas `zod` em `packages/shared/` consumidos por mobile e server — uma definição só.
- `LLMProvider` interface única — trocar provider sem mexer no resto.

---

## Decisões em aberto (sinalize se quiser mudar)

1. **Host do server:** Fly.io vs Render vs Railway. Plano assume Fly.io.
2. **OAuth sign-in** (Google/Apple): fora do MVP. Mover para M6 se sobrar tempo.
3. **Audio recorder UX:** tap-to-toggle no MVP; hold-to-record após UX test.
4. **Submissão Meta WABA** acontece em paralelo com M0–M3 (revisão = 1–5 dias); test number cobre dev até lá.
