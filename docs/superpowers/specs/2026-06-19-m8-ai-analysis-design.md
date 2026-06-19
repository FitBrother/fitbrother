# M8 — Análise com IA (design)

**Data:** 2026-06-19
**Fase:** 2 (rede social). Segunda de três: M7 ✅ → **M8** → M9.
**Roadmap canônico:** [`docs/PLAN.md`](../../PLAN.md) §M8. Decisões transversais da Fase 2: [`2026-06-12-m7-m9-rede-social-master-plan-design.md`](2026-06-12-m7-m9-rede-social-master-plan-design.md).
**Status:** aprovado para implementação.

---

## 1. Objetivo

Usar a IA não só para registrar, mas como **conselheira** sobre os dados já coletados, em dois níveis:

1. **Feedback imediato da refeição** — frase curta logo após o registro ("Ótima fonte de proteína 💪").
2. **Insights de período (dia / semana / mês)** — gerados automaticamente por cron, avaliando tendências e entregues por push + numa tela de Análises.

## 2. Restrição de dados (decisão fixada)

O app só rastreia, por dia (`daily_summaries`): **kcal, proteína, carbo, gordura, metas correspondentes, `goal_hit`, `meals_count`**. Há também `meal_type` e `consumed_at` (timing) por refeição e o `streaks`. **Não há** açúcar, micronutrientes ou hidratação.

Os insights se ancoram **somente nesse substrato**: consistência de bater meta, tendência de calorias/macros, adesão de proteína, frequência/horário das refeições e streak. Não inventamos métricas sem dado. (Hidratação/açúcar ficam para uma fase futura que adicione captura própria.)

## 3. Decisões fechadas (brainstorm)

| Tema | Decisão |
|------|---------|
| Escopo dos insights | Ancorado no dado existente (sem açúcar/hidratação). |
| Feedback da refeição | **Piggyback** na extração — a mesma chamada devolve macros + `feedback`. |
| Geração de insights | **Cron automático** (dia/semana/mês). Lazy-on-open descartado por engajamento. |
| UI | **Tela de Análises própria** (ícone no header, ao lado do Feed). |
| Quota | Idempotência por `source_hash` + cap global de custo (`AI_CAP_COST_CENTS`). Sem linha dedicada nova no MVP. |
| Versionamento | `INSIGHT_PROMPT_VERSION` separado do `LLM_PROMPT_VERSION`. |

## 4. Arquitetura

> Numeração de migrations: existentes vão até `0048`; M8 começa em `0049`.

### 4.1 Camada LLM
- `LLMProvider` ganha `generateInsight(input: { periodType, locale, data }): Promise<{ output: InsightContent; usage }>`, irmão de `extractMeal`. Implementado em `gemini.ts` (e `openai.ts`) com saída estruturada.
- `packages/shared`: `InsightContentSchema = { title: string, headline: string, bullets: string[] (1..5), score: number 0..100 | null, tone: enum('celebrate'|'encourage'|'nudge') }`.
- `INSIGHT_PROMPT_VERSION` em `packages/shared/src/prompt-version.ts`.

### 4.2 Feedback da refeição (piggyback) — **M8.1**
- `MealExtractionSchema` ganha `feedback: string` (≤120 chars). O prompt de extração passa a pedir, além dos itens/macros, uma frase curta de feedback ancorada nos macros do prato.
- Migration `0049_meals_ai_feedback.sql`: `ALTER TABLE meals ADD COLUMN ai_feedback text`.
- `services/meals.ts` (criação) grava `ai_feedback` a partir de `extraction.output.feedback`.
- **Cache:** o feedback entra no `ai_extractions.result_json` (cache global por hash do texto — feedback de "2 ovos" é o mesmo pra todos). Bumpar `LLM_PROMPT_VERSION` invalida (mudança de schema/prompt de extração).
- **UI:** mostrado no detalhe da refeição (`meal/[id]`) e/ou no card após salvar. Degrada para vazio se ausente.

### 4.3 Insights de período — **M8.2**
- Migration `0050_ai_insights.sql`:
  - enum `insight_period AS ENUM ('day','week','month')`.
  - `ai_insights(id uuid PK, user_id uuid FK auth.users ON DELETE CASCADE, period_type insight_period, period_start date, payload jsonb, source_hash text NOT NULL, created_at timestamptz DEFAULT now())`, UNIQUE `(user_id, period_type, period_start)`.
  - RLS: `owner_read` (`auth.uid() = user_id`); escrita via service-role.
- **Worker de geração** (`apps/server/src/workers/`, pg-boss, padrão `streak-tick`/`streak-alert`):
  - *Dia:* cron horário (UTC) seleciona usuários cujo dia nutricional acabou de fechar (mesma lógica de boundary do `streak-tick`); gera o insight do dia que fechou.
  - *Semana:* cron diário gera para usuários cuja semana nutricional fechou ontem (período = 7 dias).
  - *Mês:* cron diário gera no 1º dia do mês nutricional (período = mês anterior).
  - **Elegibilidade:** só gera se o período tem **≥3 dias com refeição** (evita insight vazio/custo à toa).
- **Idempotência/frescor:** monta payload agregado → `source_hash = sha256(json(payload) + INSIGHT_PROMPT_VERSION)`. Se já existe row para `(user, period_type, period_start)` com mesmo `source_hash`, **pula** (não paga IA). Se difere (dado mudou por edição/backfill), regenera e faz upsert.
- **Contabilidade:** `recordUsage` (cost_cents) após a chamada real; cache hit (source_hash igual) não registra.
- **Entrega:** ao criar/atualizar um insight, enfileira `notifications` `kind='insight_ready'` (push, reusa `dispatchPendingPush` + render case novo).

### 4.4 Backend (rotas)
- `GET /me/insights?period=day|week|month` — lista insights do usuário (mais recentes primeiro, paginado/limit 30).
- `GET /me/insights/:id` — um insight.
- (Geração é interna ao worker; não há rota pública de "gerar".)

### 4.5 Mobile
- `app/(app)/insights/index.tsx` — segmento Dia · Semana · Mês; lista de `InsightCard` (título, headline, bullets, score visual). Empty state ("Registre alguns dias pra desbloquear sua análise").
- `components/domain/InsightCard.tsx` — reusa tokens; é a base do `ShareCard` (M9).
- `HomeHeader`: novo ícone (ex: `Sparkles`/`LineChart` do lucide) → `/(app)/insights`.
- Hooks React Query: `useInsights(period)`, `useInsight(id)`.
- `lib/notifications`/push: ao receber `insight_ready`, deep-link para a tela de Análises.

## 5. Fluxo de dados

```
# Feedback (M8.1)
registro de refeição ──► extractMeal (cache global) ──► { itens, macros, feedback }
   ──► meals.ai_feedback ──► detalhe da refeição

# Insight de período (M8.2)
cron (boundary do user) ──► elegível? (≥3 dias c/ refeição)
   ──► monta payload agregado (daily_summaries do período + streak)
   ──► source_hash já existe igual? sim → pula | não → generateInsight
   ──► upsert ai_insights ──► notifications(insight_ready) ──► push
                          └─► tela de Análises (GET /me/insights)
```

## 6. Tratamento de erros
- Feedback da refeição falha/ausente → registro segue normal, `ai_feedback` fica NULL, UI esconde.
- LLM falha no cron → loga, **não** grava row parcial, re-tenta no próximo tick (idempotência cobre).
- Período sem dados suficientes → não gera (não é erro).
- Quota de custo estourada → cron pula a geração e loga; tenta no próximo ciclo.

## 7. Testes (padrão do repo)
- **SQL/RLS:** `ai_insights` owner-only (terceiro não lê); UNIQUE por `(user, period, period_start)`; enum `insight_period` válido. Check em `scripts/checks/m8-insights.sql` (cria user sintético + summaries em transação rolled-back).
- **Lógica de elegibilidade/idempotência:** função/worker testável via SQL+e2e rolled-back (mesmo `source_hash` não duplica; <3 dias não gera).
- **TS:** `npm run typecheck` + `lint`. Schemas zod (`InsightContent`, responses).
- **Mobile/push:** e2e manual em device (registrar, não automatizável).

## 8. Fora de escopo (M8) / follow-ups
- Hidratação, açúcar, micronutrientes (precisa nova captura) → fase futura.
- Insight "ao vivo" sob demanda (botão "analisar agora") → v2.
- **M9:** `InsightCard` vira base do card compartilhável externo.
- **M6/LGPD:** incluir `ai_insights` + `meals.ai_feedback` no export/delete.

## 9. Fatiamento e "feito quando"
- **M8.1 — Feedback da refeição (piggyback):** `meals.ai_feedback`, `feedback` no `MealExtractionSchema` + prompt, UI no detalhe. *Feito quando:* registrar refeição mostra uma frase de feedback coerente; sem feedback não quebra o registro; cache continua funcionando.
- **M8.2 — Insights de período:** `ai_insights` + `generateInsight` + workers cron + rotas + tela de Análises + push. *Feito quando:* um usuário com ≥3 dias de dados recebe insight de dia/semana/mês gerado por cron, vê na tela de Análises, recebe push, e re-rodar o cron com o mesmo dado não gera/paga de novo (idempotência por `source_hash`).

Cada fatia ganha seu próprio plano em `docs/superpowers/plans/`. Começar pelo **M8.1**.
