# 🍏 FEATURES.md — Fitbrother (App de Nutrição com IA)

> Fonte de verdade do produto e da arquitetura. Este documento é lido pelo Claude Code antes de gerar qualquer feature. Mudanças aqui devem refletir decisões já consolidadas.
>
> **Escopo:** este doc cobre a **Fase 1** (app de nutrição — M0–M6). A **Fase 2** (M7–M9: feed social, análise com IA, compartilhamento externo) está no roadmap em [`docs/PLAN.md`](docs/PLAN.md) e será documentada aqui conforme cada milestone for implementado. Em pontos onde a implementação pivotou do desenho original, este doc já foi realinhado (ver §3.3 `follows`, §4.5 verificação por OTP/SMS).

---

## 📖 1. Visão Geral

App e assistente nutricional que **elimina a fricção do log de calorias**. O usuário registra refeições em **linguagem natural** (texto ou áudio), tanto pelo app quanto pelo WhatsApp. A IA transcreve, identifica os alimentos, calcula os macros e sincroniza tudo em tempo real entre os canais. O engajamento é sustentado por **gamificação estilo Duolingo** (ofensivas, ranking de amigos, conquistas).

**Diferenciais:**
- Input multi-modal (texto + áudio, app + WhatsApp).
- Sincronização em tempo real entre canais.
- Gamificação social com leaderboard de amigos.

---

## 🛠 2. Stack Tecnológica

| Camada | Tecnologia | Observação |
|---|---|---|
| Mobile | React Native + Expo | Único cliente. |
| Estilização | NativeWind v4 + Tailwind v3 | Ver `DESIGN_SYSTEM.md`. |
| Backend / API | Node.js + Fastify | Webhooks de baixa latência. |
| Banco & Auth | Supabase (Postgres) | Auth, Storage, Realtime e RLS nativos. |
| Realtime | Supabase Realtime | Canais filtrados por `user_id`. |
| IA — NLP/Macros | Gemini 1.5 Flash *ou* GPT-4o mini | Function calling → JSON. |
| IA — Transcrição | OpenAI Whisper (`whisper-1`) | Áudio → texto. |
| Mensageria | WhatsApp Cloud API (Meta) | Webhooks in/out. |
| Push | Expo Push Notifications | Canal primário proativo. |
| Filas | pg-boss (Postgres) | Jobs assíncronos (transcrição, IA, streak). |
| Observabilidade | Sentry (RN + Node) + pino (logs JSON) | |
| Pagamentos (futuro) | Stripe ou RevenueCat | Schema pronto, lógica desativada no MVP. |

---

## 🗄 3. Arquitetura do Banco de Dados

### 3.1 Princípios

1. **`auth.users` é fonte de identidade.** Toda tabela aplicacional referencia `auth.users.id`.
2. **Separar identidade de métricas mutáveis.** Peso, altura, metas e TMB mudam → histórico append-only em tabelas próprias.
3. **Normalizar refeições.** `meals` é o evento; `meal_items` são os alimentos.
4. **Catálogo `foods` canônico** reduz custo de IA e padroniza macros.
5. **Cache de IA** (`transcriptions`, `ai_extractions`) evita reprocessar.
6. **Idempotência de webhooks** via `wa_messages.provider_message_id UNIQUE`.
7. **Agregação pré-computada** (`daily_summaries`) via trigger.
8. **RLS em toda tabela com `user_id`.** Policy padrão `auth.uid() = user_id`.
9. **Tipos consistentes:** `uuid` (PK), `timestamptz` (datas), `numeric(8,2)` (macros), enums Postgres.
10. **Soft delete** (`deleted_at`) em `meals` e `meal_items`.
11. **Cap de IA por usuário/dia** (`ai_usage`) para evitar explosão de custo.
12. **Janela de 24h WhatsApp controlada** (`profiles.wa_window_expires_at`) — nunca enviar template pago automaticamente.
13. **LGPD por design.** `consent_log`, endpoints de export/delete.

### 3.2 Diagrama Lógico

```
auth.users ──┬── profiles (1:1)
             ├── anthropometrics (1:N — histórico de peso/altura)
             ├── nutrition_goals (1:N — histórico de metas)
             ├── meals (1:N) ── meal_items (1:N) ── foods (N:1, opcional)
             ├── daily_summaries (1:N — uma linha por dia nutricional)
             ├── streaks (1:1)
             ├── user_achievements (N:M ↔ achievements)
             ├── follows (assimétrico — follower→followee)
             ├── contact_links (descoberta por contatos, hasheada)
             ├── wa_conversations (1:1) ── wa_messages (1:N)
             ├── push_tokens (1:N)
             ├── notifications (1:N)
             ├── ai_usage (1:N — quota diária)
             ├── consent_log (1:N — LGPD)
             └── subscriptions (1:1 — placeholder)
```

### 3.3 Schema Detalhado

#### `profiles`
| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid PK | FK → `auth.users.id` ON DELETE CASCADE. |
| `full_name` | text | |
| `phone_e164` | text UNIQUE | Formato `+5511999999999`. Chave de match WhatsApp. |
| `phone_verified_at` | timestamptz NULL | Ver §4.5. |
| `birth_date` | date | Idade é derivada — não duplicar. |
| `sex` | enum (`male`,`female`,`other`) | Necessário para Mifflin-St Jeor. |
| `activity_level` | enum (`sedentary`,`light`,`moderate`,`active`,`very_active`) | |
| `goal` | enum (`lose`,`maintain`,`gain`,`recomp`) | |
| `timezone` | text NOT NULL | IANA (`America/Sao_Paulo`). Auto-detect via Expo + override no onboarding. |
| `day_start_hour` | smallint NOT NULL DEFAULT 0 | **Boundary do dia nutricional** (0-23). |
| `locale` | text DEFAULT `'pt-BR'` | |
| `wa_window_expires_at` | timestamptz NULL | Janela de 24h Meta. Atualizada por trigger em `wa_messages` (in). |
| `lgpd_consent_at` | timestamptz NULL | Consentimento ao Termo+Privacidade (escopo agregado). Granular em `consent_log`. |
| `created_at` / `updated_at` | timestamptz | |

#### Boundary do dia nutricional

O usuário escolhe o "horário de virada" do dia (0-23h). Refeições registradas antes desse horário contam para o **dia anterior**. Útil para usuários nocturnos (`day_start_hour=4` é comum).

**Derivação (SQL):**
```sql
day := ((consumed_at AT TIME ZONE p.timezone) - (p.day_start_hour || ' hours')::interval)::date
```

Exemplos com `timezone='America/Sao_Paulo'`, `day_start_hour=4`:
- Refeição às `2026-05-10 02:00` local → `day = 2026-05-09` (conta no dia anterior).
- Refeição às `2026-05-10 05:00` local → `day = 2026-05-10`.

#### `anthropometrics` — histórico de peso/altura (append-only)
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `weight_kg` | numeric(5,2) | |
| `height_cm` | numeric(5,2) | |
| `bmr_kcal` | numeric(7,2) | Mifflin-St Jeor, calculada por trigger BEFORE INSERT. |
| `tdee_kcal` | numeric(7,2) | `bmr * activity_factor` (snapshot do `activity_level` no momento). |
| `measured_at` | timestamptz | |

**Sempre INSERT, nunca UPDATE.** Vigente = `ORDER BY measured_at DESC LIMIT 1`.

#### `nutrition_goals` — metas diárias versionadas
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `kcal` | numeric(7,2) | |
| `protein_g` / `carbs_g` / `fat_g` | numeric(7,2) | |
| `effective_from` | date NOT NULL | |
| `effective_to` | date NULL | NULL = meta vigente. |

Constraint: por usuário, no máximo uma linha com `effective_to IS NULL`. Garantido por unique index parcial.

#### `foods` — catálogo canônico
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | "Ovo cozido". |
| `name_normalized` | text | lowercase + sem acento. |
| `serving_label` | text | "1 unidade média (50g)". |
| `serving_grams` | numeric(7,2) | |
| `kcal_per_100g` / `protein_per_100g` / `carbs_per_100g` / `fat_per_100g` | numeric(7,2) | |
| `source` | enum (`taco`,`usda`,`openfoodfacts`,`ai`,`user`) | |
| `verified` | boolean | `true` para `taco`/`usda`. |

Índices: `name_normalized` com `gin_trgm_ops` (fuzzy), `(verified, source)`.

Catálogo `source='taco'`: 591 alimentos da TACO 4ª ed. (migration `0083_foods_taco_catalog.sql`; dados em `supabase/seed/taco-4ed.json`), `verified=true`. Ficam de fora os nº 516/517 (sem kcal) e os nº 450, 457, 458 e 591, marcados com `*` na TACO ("análises sendo reavaliadas"; inclui os leites de vaca integral e desnatado UHT): sem dado, não entram com macros zerados. A `0083` removeu as linhas `taco` do seed antigo cujo nome não consta na tabela oficial (`meal_items.food_id` vira NULL via `ON DELETE SET NULL`; macros históricos ficam, pois `meal_items` guarda snapshot).

> **Pendência conhecida:** os alimentos que substituíram o seed antigo entram sem `serving_label`/`serving_grams` (só os que já existiam com o mesmo nome preservam). Sem `serving_grams`, unidades como "2 ovos" não convertem em gramas e o macro cai no valor da LLM até as porções serem curadas.

#### `food_aliases` — termos de busca do autocomplete
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `food_id` | uuid FK → `foods` ON DELETE CASCADE | |
| `alias` | text | Como o usuário digita ("arroz branco"). |
| `alias_normalized` | text | lowercase + sem acento. |

`UNIQUE (food_id, alias_normalized)`. Só texto de busca: os macros vêm sempre de `foods`. Migration `0084_food_aliases.sql` (45 aliases em `supabase/seed/taco-aliases.json`; o seed falha se algum nome TACO não for encontrado).

#### `meals` — eventos de refeição
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `source` | enum (`app_text`,`app_audio`,`wa_text`,`wa_audio`,`manual`) | |
| `raw_input` | text | Texto original ou transcrição. |
| `audio_path` | text NULL | Path no bucket `meal-audios` (ver §7.1). |
| `meal_type` | enum (`breakfast`,`lunch`,`snack`,`dinner`,`other`) | Inferido pela IA. |
| `consumed_at` | timestamptz | Default `now()`. |
| `total_kcal` / `total_protein_g` / `total_carbs_g` / `total_fat_g` | numeric(8,2) | **Mantidos por trigger** em `meal_items`. Não usar `GENERATED` (Postgres não permite referenciar outra tabela). |
| `confidence` | numeric(3,2) | 0–1, vindo da IA. |
| `review_required` | boolean DEFAULT false | `true` se `confidence < 0.6` **ou** se o payload da RPC `create_meal_with_items` trouxer `require_confirmation: true` (migration `0088`; o app novo manda o flag em texto/áudio/foto, então a refeição de IA nasce pendente). Não computa em `daily_summaries` enquanto `true`. Vira `false` por `PATCH /meals/:id` com `confirm: true` (ou `POST /meals/:id/confirm`). |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | |

Índice: `(user_id, consumed_at DESC) WHERE deleted_at IS NULL`.

#### `meal_items`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `meal_id` | uuid FK ON DELETE CASCADE | |
| `food_id` | uuid FK NULL | Link ao catálogo quando match. |
| `description` | text | "2 ovos" (snapshot do entendimento da IA). |
| `quantity` | numeric(7,2) | |
| `unit` | enum (`g`,`ml`,`unit`,`slice`,`cup`,`tbsp`,`tsp`) | |
| `kcal` / `protein_g` / `carbs_g` / `fat_g` | numeric(7,2) | Snapshot — não recalcular se `foods` mudar. |

#### `daily_summaries` — agregação pré-computada
| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid | PK composto. |
| `day` | date | PK composto. Derivado conforme §3.3 boundary. |
| `kcal` / `protein_g` / `carbs_g` / `fat_g` | numeric(8,2) | |
| `goal_kcal` / `goal_protein_g` / `goal_carbs_g` / `goal_fat_g` | numeric(8,2) | Snapshot da meta vigente no `day`. |
| `goal_hit` | boolean | Ver regra abaixo. |
| `meals_count` | int | Exclui `review_required = true`. |
| `updated_at` | timestamptz | |

**Regra de `goal_hit` (default — configurável v2):**
```
goal_hit := kcal BETWEEN goal_kcal * 0.9 AND goal_kcal * 1.1
        AND protein_g >= goal_protein_g * 0.85
```
Racional: o usuário acerta a meta calórica com folga de ±10% **e** atinge ≥85% da proteína. Proteína é o macro estruturalmente mais importante; carbs/fat ficam livres no MVP.

**Manutenção:** trigger em `meal_items` (AFTER INSERT/UPDATE/DELETE) recalcula a `meal` pai e em seguida a linha de `daily_summaries` daquele dia/usuário. Edits que mudam `consumed_at` recalculam ambos os dias afetados.

#### `streaks`
| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid PK | |
| `current_streak` | int | |
| `longest_streak` | int | |
| `last_hit_day` | date | Último `day` com `goal_hit=true`. |
| `freezes_available` | int DEFAULT 0 | "Streak freeze" — v2. |
| `updated_at` | timestamptz | |

#### Job de Streak (cron horário)
A cada hora UTC, varre usuários cujo "novo dia" começou agora:
```sql
SELECT user_id FROM profiles
WHERE EXTRACT(HOUR FROM now() AT TIME ZONE timezone)::int = day_start_hour
```
Para cada um, lê `daily_summaries` do dia anterior. Se `goal_hit=true`, incrementa `current_streak` e atualiza `longest_streak`. Se `false`, reseta (ou consome `freezes_available` em v2).

#### `achievements` / `user_achievements`
- `achievements(id, code UNIQUE, title, description, icon, criteria_json)`
- `user_achievements(user_id, achievement_id, unlocked_at)` — PK composta.

Worker reavalia critérios após cada update em `daily_summaries` ou `streaks`.

#### `follows` / `contact_links` (modelo social — M5.3)

> **Pivot (mai/2026):** o modelo de amizade pedido→aceite foi substituído por **follow assimétrico estilo Duolingo**, descoberto por contatos do telefone (sem aceite). Migrations `0030`–`0034`.

- `follows(follower_id, followee_id, created_at)` — PK composta `(follower_id, followee_id)` + CHECK anti-self. Seguir é unilateral, sem aceite.
- `contact_links(owner_id, phone_hash, created_at)` — grafo de contatos hasheado (SHA-256); usado no reverse-match quando alguém da sua agenda entra no app. Nenhum número em claro trafega.
- `profiles.phone_hash` — chave de match contra `contact_links.phone_hash`.
- View `following_summaries_view` (security_invoker) expõe de quem você segue **apenas** `day`, `goal_hit`, `meals_count` — nunca macros. RPC `fitbrother_weekly_leaderboard` agrega a rede.

> **Fase 2 (M7):** será adicionado `profiles.username` (descoberta por busca) e `profiles_private` (telefone movido para tabela isolada, RLS owner+service-role). Ver `docs/PLAN.md` §M7.

#### `wa_conversations` / `wa_messages`
- `wa_conversations(user_id PK, wa_phone_id, last_inbound_at, last_outbound_at)`
- `wa_messages(id, user_id, provider_message_id UNIQUE, direction enum('in','out'), kind enum('text','audio','image','status'), payload jsonb, processed_at, created_at)`

`provider_message_id UNIQUE` = chave de idempotência. Trigger AFTER INSERT em `wa_messages` com `direction='in'` atualiza `profiles.wa_window_expires_at = now() + interval '24 hours'`.

#### `transcriptions` — cache Whisper
`(audio_hash sha256 PK, text, language, duration_ms, created_at)`. Lookup antes de chamar a API.

#### `ai_extractions` — cache NLP
`(input_hash sha256 PK, model, prompt_version, output_json jsonb, created_at)`. Lookup antes de chamar LLM.

#### `push_tokens`
`(id, user_id, token UNIQUE, platform enum('ios','android'), created_at, revoked_at)`.

#### `notifications`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `channel` | enum (`push`,`wa`) | Mesma notificação pode gerar dois registros (um por canal). |
| `kind` | enum (`streak_alert`,`goal_reminder`,`friend_activity`,`meal_confirmation`,`achievement`) | |
| `template` | text | Slug do template. |
| `payload` | jsonb | Variáveis. |
| `sent_at` | timestamptz | |
| `delivered_at` | timestamptz NULL | |
| `error` | text NULL | |

#### `ai_usage` — cap diário de custo
| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid | PK comp. |
| `day` | date | PK comp (dia nutricional do usuário). |
| `transcription_seconds` | int DEFAULT 0 | |
| `llm_input_tokens` | int DEFAULT 0 | |
| `llm_output_tokens` | int DEFAULT 0 | |
| `llm_cost_cents` | int DEFAULT 0 | Estimado por preço-tabela do provider. |
| `updated_at` | timestamptz | |

**Caps default (configuráveis por env):**
- 600s de áudio/dia (10 min)
- 50.000 tokens LLM/dia
- 200 centavos USD de custo total/dia

Excedido → backend rejeita com `AI_QUOTA_EXCEEDED` → cliente cai em **modal de entrada manual**.

#### `consent_log` — LGPD
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `scope` | enum (`terms`,`privacy`,`marketing`,`ai_processing`,`data_export`) | |
| `granted_at` | timestamptz | |
| `revoked_at` | timestamptz NULL | |
| `policy_version` | text | Hash/semver do documento aceito. |

Endpoints (§7):
- `GET /account/export` → dump JSON do usuário (LGPD Art. 18 II).
- `DELETE /account` → soft delete + cascade físico após 30 dias. Cancela a assinatura Stripe antes: estrito para `plan='pro'` (falha → `502 billing_cancel_failed`, exclusão bloqueada), best-effort para os demais.

#### `subscriptions` — cobrança Stripe
Todo usuário nasce `plan='free'` (via `complete_onboarding`). A integração Stripe Checkout (M-Billing) atualiza a linha via webhook.

Endpoints de cobrança:
- `POST /billing/checkout` `{interval:'month'|'year', ui?:'hosted'|'embedded'}` → `{url}` (hosted, padrão, usado no nativo) ou `{client_secret}` (embedded, usado pela web em `/checkout`). `409 already_subscribed`, `503 billing_not_configured`.
- `POST /billing/portal` → `{url}` do Customer Portal. `404 no_customer`.
- `GET /billing/subscription` → `{plan, status, current_period_end, has_customer}`.
- `POST /webhooks/stripe` → assinatura obrigatória (`Stripe-Signature`); idempotente via `stripe_events`.

| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | uuid PK | |
| `plan` | enum (`free`,`pro`) | |
| `status` | enum (`active`,`past_due`,`canceled`,`trialing`) | |
| `current_period_start` / `current_period_end` | timestamptz | |
| `provider` | text NULL | `stripe` \| `revenuecat`. |
| `provider_subscription_id` | text NULL | |
| `stripe_customer_id` | text NULL UNIQUE | Cliente Stripe do usuário (0080). |

RLS: policy `subscriptions_owner_select` (SELECT com `auth.uid() = user_id`). INSERT/UPDATE/DELETE revogados de `anon`/`authenticated`: escrita só por `service_role` (webhook/servidor) ou funções `SECURITY DEFINER` (`complete_onboarding`). Tabela publicada no Realtime para o app reagir à mudança de plano.

#### `stripe_events` — idempotência de webhooks Stripe

| Coluna | Tipo | Notas |
|---|---|---|
| `event_id` | text PK | ID do evento Stripe (`evt_...`); conflito = já recebido. |
| `type` | text NOT NULL | |
| `received_at` | timestamptz NOT NULL DEFAULT now() | |
| `processed_at` | timestamptz NULL | NULL = ainda não processado. |

RLS ligado, sem policy, `REVOKE ALL` de `anon`/`authenticated`: só `service_role` acessa.

### 3.4 Índices Críticos

- `meals (user_id, consumed_at DESC) WHERE deleted_at IS NULL`
- `meal_items (meal_id)`
- `daily_summaries (user_id, day DESC)`
- `wa_messages (provider_message_id)` UNIQUE
- `wa_messages (user_id, processed_at) WHERE processed_at IS NULL` — fila
- `foods USING GIN (name_normalized gin_trgm_ops)` — fuzzy
- `food_aliases USING GIN (alias_normalized gin_trgm_ops)` — autocomplete
- `follows (followee_id)` — quem segue um usuário; `profiles (phone_hash) WHERE phone_hash IS NOT NULL` — reverse-match de contatos
- `nutrition_goals (user_id) WHERE effective_to IS NULL` — UNIQUE parcial (meta vigente)
- `ai_usage (user_id, day)` PK
- `notifications (user_id, sent_at DESC)`

### 3.5 RLS — Política Padrão

Toda tabela com `user_id`:
```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON <t>
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Exceções:
- `foods`: SELECT público; INSERT/UPDATE só com `service_role`.
- `food_aliases`: sem `user_id`; SELECT para `anon`/`authenticated` só de aliases cujo `foods.verified = true`; escrita só `service_role`.
- `follows`: SELECT permitido se `auth.uid()` é o `follower_id` ou o `followee_id`.
- `contact_links`: SELECT só do `owner_id`.
- `subscriptions`: só SELECT pelo dono (`subscriptions_owner_select`); escrita só `service_role`/`SECURITY DEFINER`.
- `stripe_events`: sem `user_id`; RLS ligado sem policy, acesso só `service_role`.
- `daily_summaries` da rede: view `following_summaries_view` (security_invoker) que filtra por quem o caller segue e expõe **apenas** `day`, `goal_hit`, `meals_count` (NUNCA macros absolutos — privacidade).

---

## 🚀 4. Funcionalidades Core (MVP)

### 4.1 Onboarding e Anamnese

Multi-step, captura na ordem:
1. Nome + e-mail (auth).
2. Telefone E.164 (validado por regex; verificação real em §4.5).
3. Data de nascimento.
4. Sexo, peso, altura.
5. Nível de atividade, objetivo.
6. **Timezone** (auto-detect `Intl.DateTimeFormat().resolvedOptions().timeZone`) + override.
7. **`day_start_hour`** com explicação: "A que horas seu dia nutricional vira?" (default 0; opções comuns: 0, 3, 4).
8. Termo + Política de privacidade + consentimento de processamento por IA (`consent_log` 3 entradas).

Ao concluir:
- Cria `profiles`.
- INSERT em `anthropometrics` (trigger calcula `bmr_kcal` Mifflin-St Jeor e `tdee_kcal`).
- INSERT em `nutrition_goals` (kcal derivada de TDEE + ajuste por `goal`: -20% lose, 0 maintain, +10% gain).
- INSERT em `subscriptions(plan='free', status='active')`.

### 4.2 Registro de Refeições via IA

Entrada: texto ou áudio, no app ou via WhatsApp.

**Pipeline:**
1. Verifica `ai_usage` do dia. Se excedeu cap → erro `AI_QUOTA_EXCEEDED` → modal de entrada manual.
2. Se áudio: hash SHA-256 → lookup em `transcriptions`. Miss → chama Whisper → grava cache.
3. Hash `(texto + prompt_version)` → lookup em `ai_extractions`. Miss → chama LLM com function calling, schema:
   ```json
   {
     "meal_type": "breakfast|lunch|snack|dinner|other",
     "items": [
       { "description": "2 ovos", "quantity": 2, "unit": "unit",
         "kcal": 140, "protein_g": 12, "carbs_g": 1, "fat_g": 10,
         "food_match_hint": "ovo cozido" }
     ],
     "confidence": 0.85
   }
   ```
4. Para cada item, fuzzy match em `foods.name_normalized` e em `food_aliases` (RPC `fitbrother_foods_fuzzy_match`, limiar 0,4; desde a `0086` o nome com cru/crua/crus/cruas perde 0,2 na ordenação quando o termo não diz "cru", e alias não é rebaixado; desde a `0087`, termo de uma palavra só casa com similarity >= 0,5, senão mantém os macros da IA). Se match com `verified=true`, **sobrescreve macros** pelo catálogo (mais confiável que IA).
5. Insere `meals` + `meal_items` em transação (RPC `create_meal_with_items`). Trigger atualiza `daily_summaries` só quando a refeição não nasce pendente (ver passo 7).
6. Atualiza `ai_usage` (tokens consumidos, segundos transcritos, custo estimado).
7. `POST /meals/{text,audio,photo}` aceitam `require_confirmation` (boolean opcional) e repassam à RPC (`true` só quando o corpo diz `true`). Com o flag a refeição nasce com `meals.review_required = true` (desde a `0088`) e só entra no dia, streak, `goal_hit` e conquistas quando o usuário confirma no drawer de confirmação (§4.2.1; `PATCH /meals/:id` com `confirm: true`). O app atual manda `require_confirmation: true` sempre (`lib/api/meals.ts`). O flag é ativado pelo cliente, e não pelo `source`, para não quebrar builds nativos antigos: sem o flag vale o comportamento anterior (pendente só com `confidence < 0.6`), e um app novo contra um servidor antigo só cria refeições já confirmadas. **Ordem de deploy segura:** (a) servidor + migration `0088`, (b) app. Código de barras (`app_barcode`, nunca manda o flag), `manual` e WhatsApp continuam pendentes só com `confidence < 0.6`; no WhatsApp esse caso notifica "Confirme o que entendi" (push + WA se janela aberta).

**Pendentes na Home.** Refeições com `review_required = true` (exceto os cards otimistas em processamento) ficam visíveis na Home do dia: o `MealCard` leva o selo "Confirmar" (no lugar de "Revisar"), abaixo do resumo do dia aparece a nota "+<kcal> kcal quando você confirmar o <refeição>" (ou "...as refeições pendentes" com mais de uma, somando as kcal) e um banner âmbar "N refeição(ões) aguardando confirmação" com o botão "Confirmar", que abre o drawer de confirmação (§4.2.1) da pendente **mais antiga** (`consumed_at`); tocar no card de uma pendente também abre o drawer. Nota e banner somem quando não há pendentes. O resumo continua excluindo as pendentes (`daily_summaries`). O banner e a nota "+kcal" cobrem só o dia exibido na Home (o dia nutricional de hoje); pendentes de outros dias (backfill ou não confirmadas após a virada do dia) são confirmadas pela tela de histórico daquele dia, tocando no card com o selo "Confirmar" (abre o mesmo drawer). Não há consulta entre dias na v1.

#### 4.2.1 Detalhe da refeição = edição (lista + sheet) e autocomplete de alimentos

A tela de detalhe da refeição (`meal/[id]`) **é** a tela de edição: renderiza o `MealEditor`, sem lápis e sem rota `edit` separada. Ela mostra a refeição como lista: no topo, chips editáveis de **tipo** e **horário** (`MealMetaChips`; o horário muda mantendo a data local, em passos de 5 minutos no seletor, e confirmar sem mexer não altera nada; o dia da refeição não é editável) e o card de resumo fixo (`MealSummaryCard`: kcal total, delta em relação ao total ao abrir e `MacroSplitBar`); abaixo, uma linha por item (`MealItemRow`) com stepper `− 150 g +` (passo por unidade: `g`/`ml` 10, `cup` 0,5, demais 1; nunca chega a zero), o botão "Buscar e adicionar alimento". A barra fixa "Descartar" / "Salvar alterações" só aparece quando há alteração não salva, e sair da tela (voltar, gesto, botão do sistema) com alteração pede confirmação para descartar. Depois de salvar com sucesso a tela continua aberta, mostra o toast "Alterações salvas" e passa a usar a refeição salva como nova base (o delta do resumo zera e a barra some). No web, só o botão voltar do app é protegido; o voltar do navegador, recarregar e fechar a aba não pedem confirmação. Os botões "Compartilhar" e "Novo post" ficam no fim da lista, escondidos enquanto há alteração não salva. Tocar no nome abre o sheet do item (`MealItemSheet`, implementado com `Modal` do RN): campo do alimento com autocomplete, quantidade com − / + e atalhos, unidade, macros e o switch "Ajustar macros manualmente". Item salvo escala os macros proporcionalmente à quantidade (âncora no valor salvo, mesma unidade) até um macro ser editado à mão (selo "Ajustado"). Fechar o sheet de um item novo ainda sem nome remove o item; ficar sem itens e salvar cai no fluxo de excluir a refeição. O `PATCH` só leva `meal_type`/`consumed_at` quando mudaram e só leva `items` quando algum item mudou (trocar só tipo/horário não recria os itens); quantidade fica entre 0,01 e 99.999,99 e macros até 99.999,99 (`numeric(7,2)`), validados no `PatchMealItemSchema` antes do envio; se o novo horário mudar o dia nutricional, as queries do novo dia também são invalidadas. O campo de descrição de cada item (no sheet) sugere alimentos enquanto o usuário digita.

**Confirmação da refeição pendente (drawer global).** A refeição com `review_required = true` não é confirmada nesta tela: a confirmação é um drawer global (`BottomDrawer` + `ConfirmMealDrawer`, overlay absoluto no layout `(app)`, sem `Modal` nativo), aberto por `useConfirmMealSheet().open(mealId)` (`lib/confirm-meal/confirm-meal-context.tsx`). O `ConfirmMealProvider` fica na raiz (o onboarding também abre); o `ConfirmMealHost` fica no `GuardedStack`, montado depois do conteúdo e antes do `TourOverlay`, mas o overlay do drawer tem `zIndex` 1000 e pinta **por cima** do tour. Enquanto o drawer está aberto, o conteúdo de trás fica oculto para leitor de tela; ao abrir, o teclado é dispensado (na web, o campo focado perde o foco) e o foco vai para o painel (`sendAccessibilityEvent(focus)` no nativo, `focus()` no web). Com o teclado aberto, o painel não soma o inset de baixo. `open()` com outra refeição já aberta é ignorado (o rascunho e a confirmação em andamento são dela; a nova pendente continua no banner/selo da Home), e sair da conta (`SIGNED_OUT`) fecha o drawer. O host busca a refeição por `mealDetailKey` e só mostra o drawer com ela carregada e ainda pendente (sem skeleton); se ela vier confirmada (outro aparelho) ou der 404, fecha sozinho e sem aviso; outra falha ao carregar mostra o toast "Não foi possível abrir a refeição" e fecha. Três visões no mesmo drawer: **compacto** ("Entendi isto" até 3 itens, "Entendi N itens" acima; frase com os nomes curtos dos 3 primeiros itens; total em kcal; "Almoço · 12:40 ▾" abre o seletor de tipo/horário; transcrição entre aspas para áudio, miniatura de 72 pt para foto; com `confidence < 0.6`, a linha âmbar "Não tive certeza das quantidades."; botões **Ajustar** e **Confirmar** e o link "Descartar"), **ajustar** (título "Ajustar refeição", total sempre visível, itens com stepper, "Adicionar item", só a lista rola, altura máxima ~88% da tela) e **item** (o editor de item no próprio drawer, com "‹" de volta à lista). Confirmar roda a validação do salvar e envia **um** `PATCH /meals/:id` com `confirm: true` mais `items`/`meal_type`/`consumed_at` só do que mudou (sem edição: `{ "confirm": true }`); um segundo toque não reenvia. Sucesso: toast "Refeição registrada" e o drawer fecha. Falha (inclusive resposta 200 ainda com `review_required: true`, servidor anterior à `0088`): toast "Não foi possível confirmar" e o drawer continua aberto com o rascunho. Confirmar sem itens ou remover o último item cai em descartar. "Descartar" pede confirmação ("Descartar refeição?") e exclui. Fechar (toque no fundo ou voltar do Android; sem arrastar) mantém a refeição pendente; com ajustes não confirmados pergunta antes "Descartar alterações?". **Quem abre o drawer:** o registro por texto/áudio/foto na Home (`useRegisterMeal` → `useOpenMealAfterRegister`, só com a tela em foco e o app ativo; `already_existed` abre a mesma refeição uma vez); o registro retroativo (`history/[day]/new`, um `formSheet` nativo que cobriria o overlay: a tela fecha com `router.back()` e o drawer abre ~400 ms depois, quando o sheet já saiu); o onboarding (`FirstMealBlock`: vai para a Home e abre); o fallback de IA do código de barras (`scan-confirm`: vai para a Home e abre, sem disparar o tour, que continua pelo gatilho da Home); e, na Home e no histórico do dia, o card/selo "Confirmar" e o banner de pendentes (`useOpenMeal`: pendente abre o drawer, confirmada abre `meal/[id]`). **`meal/[id]` é só para refeição confirmada:** abrir a rota de uma pendente (deep link, URL) abre o drawer e sai da tela (`backOrHome`) sem mostrar o editor; o `MealEditor` não tem mais modo pendente. O tour começa pela Home: o gatilho (`hasConfirmedMeal`) só dispara com a Home em foco (`useOnceWhenFocused`). A rota `POST /meals/:id/confirm` continua no servidor, mas o app não a usa mais.

- **RPC** `fitbrother_foods_autocomplete(p_query text, p_limit int DEFAULT 8)` (migration `0085_foods_autocomplete.sql`), `SECURITY INVOKER`, `EXECUTE` só para `authenticated`. Une o catálogo `foods` (por nome e por `food_aliases`, só `verified`) com os **recentes** do usuário (`meal_items` dos últimos 90 dias, resolvidos pela RLS de `meals`/`meal_items`).
  - Retorna `kind` (`catalog` | `recent`), `food_id`, `name`, porção e macros por 100 g do catálogo; nos recentes, também `quantity`/`unit`/macros do último uso.
  - `''` → só recentes (frequência, depois recência); 1 caractere → vazio; 2 → só prefixo (início do texto ou de palavra); 3+ → prefixo e depois `similarity >= 0.3`. Score: alias igual ao termo 4, alias começando pelo termo 3,5, nome começando pelo termo 3, início de palavra 2, `similarity` no resto; nome com cru/crua/crus/cruas perde 0,5 quando o termo não tem "cru" (alias não é rebaixado); recentes somam 0,5. Desempate: recente antes de catálogo, depois nome mais curto.
  - Recente com `food_id` suprime a linha de catálogo do mesmo alimento.
- **Rota** `GET /foods/search?q=` (`apps/server/src/routes/foods.ts`, auth obrigatória; `q` opcional, ≤ 60 caracteres, vazio → só recentes): normaliza `q` (`services/food-search.ts`), chama a RPC com o JWT do usuário e responde `{ suggestions: FoodSuggestion[] }` (schema em `packages/shared`).
- **`PATCH /meals/:id`:** cada item de `items` aceita `food_id` (uuid, nullable/opcional) e o persiste em `meal_items.food_id`; omitido/null = item de texto livre.
- **`PATCH /meals/:id` com `confirm: true`:** aplica `meal_type`/`consumed_at`/`items` e só depois, como última escrita, faz `review_required = false` (o trigger recalcula o dia já com os itens finais). Se o payload for inválido (400) ou alguma etapa anterior falhar, a refeição não é confirmada. `{ "confirm": true }` sozinho é válido e só confirma; confirmar uma refeição já confirmada responde 200. `confirm` ausente ou `false` não mexe em `review_required`.
- **Macros no cliente** (`packages/shared/src/food-macros.ts`): `quantityInGrams`, `macrosForQuantity` (catálogo → macros da quantidade) e `scaleMacros` (recentes: escala proporcional ao último uso). `g`/`ml` convertem direto (ml com densidade 1); `unit` exige `serving_grams`; `slice`/`cup`/`tbsp`/`tsp` não convertem (mantém os macros atuais). Escolher do catálogo preenche 1 porção (`unit`) se houver `serving_grams`, senão 100 g; editar macro à mão (`adjusted`) para o recálculo e editar a descrição desvincula o item (`food_id = null`). Estado do item em `apps/mobile/lib/meal-item-draft.ts`; hook `useFoodSuggestions` (debounce 250 ms, `retry: 1`, mantém a lista anterior enquanto o próximo termo carrega), `FoodAutocomplete` e `FoodSuggestionsSkeleton` em `apps/mobile/components/domain/`.

> **Pendência conhecida:** o `PATCH` de itens é delete-then-insert sem transação. Um `food_id` inexistente/obsoleto (ex.: alimento removido do catálogo entre a sugestão e o salvar) faz o insert falhar depois do delete e a refeição pode ficar sem itens.

### 4.3 Integração WhatsApp (Bot Nutricionista)

Webhook Fastify em `POST /webhooks/whatsapp`:
- Valida `x-hub-signature-256` (HMAC SHA-256 do body com `WHATSAPP_APP_SECRET`).
- GET de subscrição valida `verify_token`.
- Rate limit 60 req/min por IP.

#### Janela de 24h do WhatsApp

A Meta só permite envio **livre** nas 24h após a última mensagem inbound do usuário. Fora dessa janela, apenas templates pré-aprovados (pagos).

**Estratégia Fitbrother:**
- Trigger AFTER INSERT em `wa_messages` (`direction='in'`):
  ```sql
  UPDATE profiles
  SET wa_window_expires_at = now() + interval '24 hours'
  WHERE user_id = NEW.user_id;
  ```
- Outbound só sai pelo WA se `profiles.wa_window_expires_at > now()`.
- **Nunca** enviar template pago automaticamente. Templates ficam reservados para v2 (com flag explícita por feature).

#### Comandos especiais (texto)
- `/hoje` → resumo de macros do dia.
- `/meta` → metas vigentes.
- `/streak` → status do streak.
- Sem comando + texto livre → assume registro de refeição.

### 4.4 Dashboard Realtime

- Tela principal lê `daily_summaries` do dia + lista de `meals` do dia (filtrada por boundary).
- Subscrição Realtime: canal `realtime:public:daily_summaries:user_id=eq.<id>`.
- Componentes (ver `DESIGN_SYSTEM.md` §12): Progress Ring central (calorias), 3 rings menores (P/C/G) ou Macro Bars, lista de Meal Cards, FAB com Audio Recorder.

### 4.5 Verificação de Telefone (OTP/SMS via Supabase Auth)

> **Pivot (M5.3):** o handshake original via WhatsApp foi substituído por **OTP/SMS via Supabase Auth**, porque o gate social precisava funcionar sem depender da aprovação da Meta (M4 pausado). O handshake via WA pode voltar como canal adicional quando o WhatsApp destravar.

1. No onboarding/Amigos, usuário informa o telefone.
2. Supabase Auth envia um código OTP por SMS (provider configurado em staging/prod).
3. Usuário digita o código → Supabase confirma → `auth.users.phone_confirmed_at` é setado.
4. `POST /me/verify-phone` (service-role) lê esse timestamp, carimba `profiles.phone_verified_at` + `phone_hash`, e dispara o reverse-match de contatos.

**Limite:** features sociais (descoberta por contatos; no M7, busca por username) só liberam após `phone_verified_at`.

---

## 🎮 5. Gamificação e Retenção

| Mecânica | Como funciona | Tabelas |
|---|---|---|
| **Ofensivas (🔥)** | Dia com `daily_summaries.goal_hit = true` conta. Cron horário atualiza `streaks` no `day_start_hour` de cada usuário. | `daily_summaries`, `streaks` |
| **Seguir** | Follow assimétrico (sem aceite), descoberto por contatos do telefone. No M7, também por busca de username. | `follows`, `contact_links` |
| **Ranking Semanal** | Top da rede pelas 7 noites anteriores: contagem de `goal_hit`. | `following_summaries_view` |
| **Conquistas** | `criteria_json` (ex.: `{"type":"streak","value":7}`). Worker avalia após cada update relevante. | `achievements`, `user_achievements` |

### 5.1 Roteamento de Notificações

**Política:**
```
function dispatch(user_id, notif):
  send_push(user_id, notif)                          # SEMPRE
  if profiles.wa_window_expires_at > now():
    send_wa(user_id, notif)                          # mensagem livre, custo zero
  # NUNCA enviar template pago sem flag explícita
```

`notifications` registra cada canal separadamente. Se o usuário não tiver `push_tokens` ativos, push é skipado mas WA pode rolar mesmo assim (e vice-versa).

**Tipos (`kind`):**
- `streak_alert` — risco de quebra (envio 21h do dia nutricional)
- `goal_reminder` — faltam macros (envio 19h se kcal < 70% e janela WA aberta)
- `friend_activity` — amigo bateu meta / superou streak
- `meal_confirmation` — `review_required = true` no registro (refeição do app por texto/áudio/foto criada com `require_confirmation: true` nasce pendente por design e já abre o drawer de confirmação; push para ela está fora da v1)
- `achievement` — conquista desbloqueada

---

## 🔄 6. Fluxo Técnico — Registro via WhatsApp (Referência)

**Toda implementação DEVE seguir esta ordem.** Pontos críticos: idempotência (passo 2), quota (passo 3), caches (passos 4 e 5).

1. **Meta → Webhook Fastify.** Valida `x-hub-signature-256`.
2. **Persistência idempotente.** INSERT em `wa_messages` com `provider_message_id`. Conflito → 200 OK e encerra.
3. **Match de usuário + quota.** Lookup `profiles.phone_e164`. Se não encontrado → mensagem de onboarding com deep link e encerra. Se quota de `ai_usage` excedida → responde "Limite diário atingido, registre manualmente no app" e encerra.
4. **Transcrição (se áudio).** Hash SHA-256 → lookup `transcriptions`. Miss → Whisper → cache.
5. **Extração.** Hash `(texto + prompt_version)` → lookup `ai_extractions`. Miss → LLM → cache.
6. **Link com `foods`.** Fuzzy match em `name_normalized`. Match `verified` → sobrescreve macros pelo catálogo.
7. **Persistência transacional.** `BEGIN; INSERT meals; INSERT meal_items; UPDATE ai_usage; COMMIT;` — trigger recalcula `daily_summaries`.
8. **Realtime.** App escuta o canal e atualiza automaticamente.
9. **Resposta ao usuário.** Bot envia confirmação via WA Cloud API (janela está aberta — inbound acabou de chegar). Marca `wa_messages.processed_at = now()`.
10. **Pós-processamento (async).** Worker reavalia `achievements` e enfileira notificações se aplicável.

**Sad paths:**
- `confidence < 0.6` → `review_required=true`, **não** computa em `daily_summaries`, envia confirmação interativa.
- Falha após passo 5: `processed_at` fica NULL, retry job processa de novo — caches em §4/§5 evitam pagar IA duas vezes.
- Áudio > 25MB ou > 10min: rejeita com mensagem clara.

---

## 🛠 7. Operações e Infraestrutura

### 7.1 Storage de Áudio

- Bucket Supabase: `meal-audios` (privado).
- RLS por path: `auth.uid() = (storage.foldername(name))[1]`.
- Path: `{user_id}/{meal_id}.opus`.
- Retenção: cron diário deleta áudios cujo `meals.created_at < now() - interval '30 days'`.
- Reprodução no histórico: signed URL com TTL 1h.

### 7.2 Observabilidade

- **Sentry** (RN + Node) com `user_id` no contexto e `release` por build.
- **Logs estruturados** (pino) com `user_id`, `wa_message_id`, `meal_id`, `request_id` em todos eventos do pipeline §6.
- **Métricas mínimas:**
  - Taxa de sucesso de extração (`confidence >= 0.6`).
  - Latência p50/p95 por etapa (Whisper, LLM, persist).
  - Custo agregado diário por modelo.
  - `wa_messages` com `processed_at IS NULL` há > 5 min → alerta.

### 7.3 Ambientes

- `dev` (Supabase local via `supabase start`), `staging` (projeto Supabase dedicado), `prod`.
- Migrations: `supabase migration new <slug>` → SQL versionado em `supabase/migrations/`.
- Secrets: `.env.local` (dev), `1Password / Doppler` (staging/prod). Nunca commitar.

### 7.4 LGPD — Endpoints

- `GET /account/export` → JSON com todos dados pessoais (`profiles`, `anthropometrics`, `nutrition_goals`, `meals`, `meal_items`, `consent_log`, `notifications`, `wa_messages` redacted).
- `DELETE /account` → marca `auth.users.deleted_at` + soft delete em cascata; job purga fisicamente após 30 dias.
- Revogação de consentimento por `scope`: `POST /account/consent { scope, granted }` → atualiza `consent_log.revoked_at`.

### 7.5 Variáveis de Ambiente (resumo)

```
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# WhatsApp Cloud API
WHATSAPP_APP_SECRET=          # HMAC do webhook
WHATSAPP_VERIFY_TOKEN=        # subscrição GET
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=

# IA
OPENAI_API_KEY=               # Whisper
GEMINI_API_KEY=               # ou OPENAI_API_KEY para GPT-4o mini
LLM_PROVIDER=gemini|openai
LLM_PROMPT_VERSION=v1         # invalida cache de ai_extractions ao bumpar

# Caps de IA (defaults sobreescrevíveis)
AI_CAP_TRANSCRIPTION_SECONDS=600
AI_CAP_LLM_TOKENS=50000
AI_CAP_COST_CENTS=200

# Observabilidade
SENTRY_DSN=
LOG_LEVEL=info
```

---

*Última atualização: 2026-05-10. Mudanças em schema requerem migration; mudanças em fluxo (§4–6) requerem alinhamento com `DESIGN_SYSTEM.md` quando afetam UI.*
