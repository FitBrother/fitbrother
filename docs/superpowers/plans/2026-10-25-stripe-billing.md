# Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar o plano `pro` (mensal/anual, com trial) via Stripe Checkout hospedado e manter `subscriptions` fiel ao Stripe pelo webhook.

**Architecture:** O servidor Fastify cria sessões de Checkout/Portal e recebe o webhook Stripe (idempotente via `stripe_events`). O webhook é a única escrita em `subscriptions` (o cliente passa a só ler). O app abre o Checkout no navegador e reflete o plano por Realtime.

**Tech Stack:** Fastify 5, `stripe` (SDK, só no servidor), Supabase (Postgres + RLS + Realtime), Vitest, Expo Router, React Query, `expo-web-browser` (já instalado).

**Spec:** `docs/superpowers/specs/2026-10-25-stripe-billing-design.md`

## Global Constraints

- Comentários só se estritamente necessário, sempre em inglês e com no máximo 1 linha.
- Commits em Conventional Commits, sem nome de agente e sem trailer `Co-Authored-By`. Nunca commitar na `main`: criar branch antes (Task 1, Step 1).
- Migrations imutáveis: tudo vai em `0080_stripe_billing.sql`, sem editar anteriores.
- Webhook idempotente: `INSERT` em `stripe_events` com `event_id` UNIQUE **antes** de qualquer efeito (regra de ouro de backend nº 2).
- `service_role` e chaves Stripe nunca vão ao cliente. Nenhuma chave real no repo; só placeholders em `.env.example`.
- Valores comerciais (Price IDs, dias de trial) vêm de env, nunca fixos no código.
- `plan='pro'` para `active`, `trialing` e `past_due`; `free` para `canceled` e `incomplete_expired`. `past_due` é premissa a confirmar com produto.
- UI: skeleton para loading (nunca `ActivityIndicator` de tela), hit target 44×44, `accessibilityLabel`/`accessibilityRole`, números com `tabular-nums`, cores por token, ícones só `lucide-react-native`, tipografia só `font-sans-*`.
- Ao final de cada task: `npm run typecheck` e `npm run test` do workspace tocado passam. No fim do plano, `npm run lint` do monorepo (inclui `lint:legal-copy`).
- Migration, webhook e virada para chaves `live` afetam banco e produção: executar primeiro em ambiente controlado, com revisão de outra pessoa.

## Review Focus

- Webhook reenviado enquanto o primeiro processamento falhou (`processed_at` NULL): deve reprocessar e chegar ao mesmo estado, sem duplicar efeito.
- Evento de um `customer` sem usuário correspondente: responde 200, loga com Sentry e não entra em loop de retry.
- `POST /billing/checkout` com assinatura já `active`/`trialing`: 409 `already_subscribed`, sem criar sessão.
- Eventos fora de ordem (`updated` chega depois de `deleted`): vale o estado lido do Stripe, nunca o payload do evento.
- Quem já teve assinatura e volta a assinar não recebe trial de novo.

---

### Task 1: Migration, RLS e docs

**Files:**
- Create: `supabase/migrations/0080_stripe_billing.sql`
- Modify: `FEATURES.md` (§ `subscriptions`, §3.5), `docs/PLAN.md` (novo milestone), `packages/db-types/index.ts` (regenerado)

**Interfaces:**
- Produces: coluna `subscriptions.stripe_customer_id text UNIQUE NULL`; tabela `stripe_events(event_id text PK, type text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz NULL)`; `subscriptions` legível só pelo dono e gravável só por `service_role`.

- [ ] **Step 1: Criar a branch.** `git switch -c feat/stripe-billing` (a `main` tem mudanças locais não relacionadas em `supabase/config.toml`; não incluí-las nos commits desta feature).
- [ ] **Step 2: Escrever o smoke test SQL primeiro** em `supabase/tests/0080_stripe_billing.sql`, em transação com `ROLLBACK`: como `authenticated` com `request.jwt.claims` de um usuário, `SELECT` na própria linha funciona, `UPDATE subscriptions SET plan='pro'` falha ou afeta 0 linhas, `SELECT` em `stripe_events` falha; como `service_role`, `UPDATE` e `INSERT` em `stripe_events` funcionam; `SELECT public.complete_onboarding(...)` ainda insere a linha de `subscriptions` (reaproveitar payload do smoke de M16).
- [ ] **Step 3: Rodar contra o banco local e ver falhar.** `supabase db reset` (antes da migration) e `psql "$DATABASE_URL" -f supabase/tests/0080_stripe_billing.sql`. Esperado: falha, pois `authenticated` ainda consegue escrever.
- [ ] **Step 4: Implementar `0080_stripe_billing.sql`.** Adicionar `stripe_customer_id`; `DROP POLICY subscriptions_owner_all`; `CREATE POLICY subscriptions_owner_select ... FOR SELECT USING (auth.uid() = user_id)`; `REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated, anon`; criar `stripe_events` com RLS ligado, sem policy e `REVOKE ALL ... FROM anon, authenticated`; `ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions`.
- [ ] **Step 5: Rodar de novo.** `supabase db reset` e o smoke test. Esperado: todas as asserções passam.
- [ ] **Step 6: Regenerar tipos e atualizar docs.** `npm run db:types`. Em `FEATURES.md`: coluna nova, a policy SELECT-only e `stripe_events` como exceção em §3.5. Em `docs/PLAN.md`: novo milestone "M-Billing" com meta, "Feito quando" e Status.
- [ ] **Step 7: Commit.** `git add supabase/migrations/0080_stripe_billing.sql supabase/tests packages/db-types FEATURES.md docs/PLAN.md docs/superpowers && git commit -m "feat(db): schema de cobrança Stripe e RLS somente leitura em subscriptions"`

---

### Task 2: Schemas compartilhados, env, cliente Stripe e mapeamento de status

**Files:**
- Modify: `packages/shared/src/schemas.ts`, `apps/server/src/lib/env.ts`, `apps/server/.env.example`, `apps/server/package.json`
- Create: `apps/server/src/lib/stripe.ts`, `apps/server/src/services/billing-status.ts`
- Test: `apps/server/src/services/billing-status.test.ts`

**Interfaces:**
- Produces (shared): `BillingIntervalSchema = z.enum(["month","year"])`, `CreateCheckoutRequestSchema = z.object({ interval: BillingIntervalSchema })`, `BillingUrlResponseSchema = z.object({ url: z.string().url() })`, `SubscriptionResponseSchema = z.object({ plan: z.enum(["free","pro"]), status: z.enum(["active","past_due","canceled","trialing"]), current_period_end: z.string().nullable(), has_customer: z.boolean() })`, e os tipos `BillingInterval`, `CreateCheckoutRequest`, `BillingUrlResponse`, `SubscriptionResponse`.
- Produces (server): `env.STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` (todos `str({ default: "" })`) e `STRIPE_TRIAL_DAYS` (`num({ default: 0 })`); `stripeClient(): Stripe` (lança `BillingError("billing_not_configured")` se a chave estiver vazia); `type SubscriptionUpdate = { plan: "free"|"pro"; status: "active"|"past_due"|"canceled"|"trialing"; current_period_start: string | null; current_period_end: string | null; provider: "stripe"; provider_subscription_id: string }`; `mapStripeSubscription(sub: Stripe.Subscription): SubscriptionUpdate`; `class BillingError extends Error { code: "billing_not_configured" | "already_subscribed" | "no_customer" }` em `services/billing-status.ts`.

- [ ] **Step 1: Escrever os testes de `mapStripeSubscription`** em `billing-status.test.ts`, com assertions: `trialing→{plan:"pro",status:"trialing"}`, `active→{pro,active}`, `past_due→{pro,past_due}`, `unpaid→{pro,past_due}`, `canceled→{free,canceled}`, `incomplete_expired→{free,canceled}`, `active` com `cancel_at_period_end=true` continua `{pro,active}`, e `current_period_*` convertidos de segundos Unix para ISO.
- [ ] **Step 2: Rodar e ver falhar.** `npm run test --workspace apps/server -- billing-status` → FAIL (módulo inexistente).
- [ ] **Step 3: Instalar o SDK e implementar.** `npm install stripe --workspace apps/server`. Implementar `mapStripeSubscription` e `BillingError`. Se as definições de tipo da versão instalada não expuserem `current_period_*` no topo da assinatura, lê-los de `items.data[0]`.
- [ ] **Step 4: Adicionar schemas em `schemas.ts`, vars em `env.ts` e placeholders em `.env.example`** (`STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`, `STRIPE_PRICE_MONTHLY=`, `STRIPE_PRICE_ANNUAL=`, `STRIPE_TRIAL_DAYS=`). Implementar `stripeClient()` em `lib/stripe.ts`, memoizado.
- [ ] **Step 5: Rodar.** `npm run test --workspace apps/server -- billing-status` → PASS; `npm run typecheck`.
- [ ] **Step 6: Commit.** `git commit -m "feat(billing): schemas, env e mapeamento de status Stripe"`

---

### Task 3: Serviço e rotas de checkout, portal e leitura da assinatura

**Files:**
- Create: `apps/server/src/services/billing.ts`, `apps/server/src/routes/billing.ts`
- Modify: `apps/server/src/app.ts` (registrar `billingRoutes` junto das demais)
- Test: `apps/server/src/services/billing.test.ts`

**Interfaces:**
- Consumes: `stripeClient`, `BillingError`, `env`, `BillingInterval`, `SubscriptionResponse` (Task 2).
- Produces:
  - `type BillingRow = { plan: "free"|"pro"; status: "active"|"past_due"|"canceled"|"trialing"; stripe_customer_id: string | null; provider_subscription_id: string | null; current_period_end: string | null }`
  - `type BillingStore = { getRow(userId: string): Promise<BillingRow | null>; saveCustomerId(userId: string, customerId: string): Promise<void> }`
  - `type BillingDeps = { stripe: Stripe; store: BillingStore }`; `defaultBillingDeps(): BillingDeps` (store via `supabaseService()`)
  - `createCheckoutUrl(userId: string, email: string | null, interval: BillingInterval, deps?: BillingDeps): Promise<string>`
  - `createPortalUrl(userId: string, deps?: BillingDeps): Promise<string>`
  - `getSubscription(userId: string, deps?: BillingDeps): Promise<SubscriptionResponse>`
  - Rotas (auth `authTokenRequired` + `activeAccountRequired`): `POST /billing/checkout` → `{ url }`, `POST /billing/portal` → `{ url }`, `GET /billing/subscription` → `SubscriptionResponse`. `BillingError` mapeia: `already_subscribed`→409, `no_customer`→404, `billing_not_configured`→503.

- [ ] **Step 1: Escrever os testes** em `billing.test.ts` com `BillingDeps` falsos (stripe stub com `customers.create`, `checkout.sessions.create`, `billingPortal.sessions.create`). Assertions: cria o Customer e chama `saveCustomerId` na primeira vez e não cria de novo se já existir; a sessão usa o Price de `STRIPE_PRICE_MONTHLY` ou `STRIPE_PRICE_ANNUAL` conforme `interval`, `mode:"subscription"`, `client_reference_id` e `metadata.user_id` iguais ao `userId`, `success_url`/`cancel_url` começando com `APP_URL`; `subscription_data.trial_period_days` presente só quando `STRIPE_TRIAL_DAYS > 0` **e** `provider_subscription_id` é nulo (sem trial repetido); `active` ou `trialing` lança `BillingError("already_subscribed")` sem chamar o Stripe; `createPortalUrl` sem `stripe_customer_id` lança `no_customer`; `getSubscription` devolve `has_customer` conforme a coluna.
- [ ] **Step 2: Rodar e ver falhar.** `npm run test --workspace apps/server -- billing.test` → FAIL.
- [ ] **Step 3: Implementar `services/billing.ts` e `routes/billing.ts`**, validando o body com `CreateCheckoutRequestSchema` (400 `invalid_payload` com `issues`, como em `account.ts`). Registrar em `app.ts`.
- [ ] **Step 4: Rodar.** Testes → PASS; `npm run typecheck --workspace apps/server`.
- [ ] **Step 5: Commit.** `git commit -m "feat(billing): checkout, portal e leitura da assinatura"`

---

### Task 4: Webhook Stripe idempotente

**Files:**
- Create: `apps/server/src/services/stripe-webhook.ts`, `apps/server/src/routes/stripe-webhook.ts`
- Modify: `apps/server/src/app.ts` (registrar `stripeWebhookRoute`)
- Test: `apps/server/src/services/stripe-webhook.test.ts`, `apps/server/src/routes/stripe-webhook.test.ts`

**Interfaces:**
- Consumes: `mapStripeSubscription`, `SubscriptionUpdate` (Task 2), `stripeClient`.
- Produces:
  - `type WebhookDeps = { claimEvent(id: string, type: string): Promise<"new" | "retry" | "done">; retrieveSubscription(id: string): Promise<Stripe.Subscription>; userIdForCustomer(customerId: string): Promise<string | null>; applySubscription(userId: string, customerId: string, update: SubscriptionUpdate): Promise<void>; markProcessed(id: string): Promise<void> }`
  - `processStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<"processed" | "duplicate" | "ignored">`
  - `defaultWebhookDeps(): WebhookDeps` (`claimEvent` faz `INSERT` em `stripe_events` e, em conflito, devolve `"done"` se `processed_at` está preenchido e `"retry"` se está NULL)
  - Rota `POST /webhooks/stripe`: 400 com assinatura inválida ou ausente; 200 em `processed`/`duplicate`/`ignored`; 5xx em exceção (o Stripe reenvia).

- [ ] **Step 1: Escrever os testes do serviço** com `WebhookDeps` falsos. Assertions: `claimEvent→"done"` devolve `"duplicate"` sem chamar nenhuma outra dependência; `"retry"` reprocessa e termina em `applySubscription` com o mesmo estado; `customer.subscription.updated` chama `retrieveSubscription(sub.id)` e aplica o estado **lido**, não o do payload (evento `updated` com `status:"active"` e leitura devolvendo `canceled` aplica `{free,canceled}`); `checkout.session.completed` resolve o usuário por `client_reference_id`; `customer.subscription.deleted` aplica `free/canceled`; `invoice.payment_failed` reaplica o estado lido; `userIdForCustomer→null` sem `client_reference_id` devolve `"ignored"` e chama `markProcessed` (sem loop de retry); tipo de evento não tratado devolve `"ignored"`; `markProcessed` só é chamado após `applySubscription` bem-sucedido.
- [ ] **Step 2: Escrever o teste da rota** com `app.inject`: sem header `stripe-signature` → 400; assinatura inválida → 400; assinatura válida (gerada com `stripe.webhooks.generateTestHeaderString` e um `STRIPE_WEBHOOK_SECRET` de teste) com `WebhookDeps` injetáveis → 200.
- [ ] **Step 3: Rodar e ver falhar.** `npm run test --workspace apps/server -- stripe-webhook` → FAIL.
- [ ] **Step 4: Implementar o serviço e a rota.** A rota vive num plugin encapsulado com `addContentTypeParser("application/json", { parseAs: "buffer" }, ...)` para guardar o corpo cru, valida com `stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET)` e só então chama `processStripeEvent`. A rota não usa `authTokenRequired`.
- [ ] **Step 5: Rodar.** Testes → PASS; `npm run typecheck --workspace apps/server`.
- [ ] **Step 6: Commit.** `git commit -m "feat(billing): webhook Stripe idempotente com sincronização de subscriptions"`

---

### Task 5: Cancelar assinatura ao excluir a conta

**Files:**
- Modify: `apps/server/src/services/billing.ts`, `apps/server/src/routes/account.ts:723-760`
- Test: `apps/server/src/services/billing.test.ts`

**Interfaces:**
- Consumes: `BillingDeps`, `BillingStore` (Task 3).
- Produces: `cancelUserSubscription(userId: string, deps?: BillingDeps): Promise<void>` (no-op sem `provider_subscription_id` ou sem `stripe_customer_id`; caso contrário `stripe.subscriptions.cancel` e ignora o erro `resource_missing`). `DELETE /account` chama essa função **depois** de `fitbrother_consume_account_action_authorization` e **antes** de `fitbrother_request_account_deletion`; se lançar, responde 502 `{ error: "billing_cancel_failed" }` e não marca a exclusão.

- [ ] **Step 1: Escrever os testes** em `billing.test.ts`: sem assinatura não chama o Stripe; com assinatura chama `subscriptions.cancel` com o ID certo; `resource_missing` é engolido; qualquer outro erro propaga.
- [ ] **Step 2: Rodar e ver falhar.** `npm run test --workspace apps/server -- billing.test` → FAIL.
- [ ] **Step 3: Implementar `cancelUserSubscription` e ligar em `DELETE /account`** no ponto descrito, com `req.log.error` e Sentry no caminho de falha.
- [ ] **Step 4: Rodar.** Testes → PASS; `npm run test --workspace apps/server` inteiro (garante que `account.test.ts` segue passando).
- [ ] **Step 5: Commit.** `git commit -m "feat(billing): cancela assinatura Stripe ao solicitar exclusão de conta"`

---

### Task 6: Mobile — API, hook, Realtime e rótulos

**Files:**
- Create: `apps/mobile/lib/api/billing.ts`, `apps/mobile/lib/hooks/useSubscription.ts`, `apps/mobile/lib/billing-labels.ts`
- Test: `apps/mobile/lib/billing-labels.test.ts`

**Interfaces:**
- Consumes: `SubscriptionResponse`, `BillingInterval`, `BillingUrlResponse` (`@fitbrother/shared`); `authedFetch` de `@/lib/api`.
- Produces: `createCheckout(interval: BillingInterval): Promise<BillingUrlResponse>`, `createPortal(): Promise<BillingUrlResponse>`, `getSubscription(): Promise<SubscriptionResponse>`; `subscriptionKey = ["billing","subscription"] as const`; `useSubscription()` (React Query sobre `getSubscription`); `useSubscriptionRealtime(userId: string | undefined)` (padrão de `useAchievementsRealtime`: canal `sub:${userId}`, evento `*` em `public.subscriptions` com `filter: user_id=eq.${userId}`, invalida `subscriptionKey`); `subscriptionLabel(sub: SubscriptionResponse): string`.

- [ ] **Step 1: Escrever os testes de `subscriptionLabel`**: `free→"Plano gratuito"`, `pro`+`active→"Premium"`, `pro`+`trialing→"Premium (teste grátis)"`, `pro`+`past_due→"Premium (pagamento pendente)"`, `canceled→"Plano gratuito"`.
- [ ] **Step 2: Rodar e ver falhar.** `npm run test --workspace apps/mobile -- billing-labels` → FAIL.
- [ ] **Step 3: Implementar** `billing-labels.ts`, `lib/api/billing.ts` (mesmo helper `json<T>` de `lib/api/account.ts`) e `useSubscription.ts`. Chamar `useSubscriptionRealtime(user.id)` no mesmo ponto onde `useAchievementsRealtime` é montado.
- [ ] **Step 4: Rodar.** Testes → PASS; `npm run typecheck --workspace apps/mobile`.
- [ ] **Step 5: Commit.** `git commit -m "feat(mobile): api, hook e realtime da assinatura"`

---

### Task 7: Mobile — paywall real, Perfil e página de retorno

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/PaywallBlock.tsx`, `apps/mobile/app/(app)/profile.tsx` (novo `MenuItem` ao lado dos itens de `/settings` e `/privacy`)
- Create: `apps/mobile/lib/hooks/useBillingActions.ts`, `apps/mobile/components/domain/PaywallSkeleton.tsx`, `apps/mobile/app/billing-return.tsx`

**Interfaces:**
- Consumes: `createCheckout`, `createPortal`, `useSubscription`, `subscriptionLabel` (Task 6); `WebBrowser` de `expo-web-browser`.
- Produces: `useBillingActions(): { startCheckout(interval: BillingInterval): Promise<void>; openPortal(): Promise<void>; pending: boolean }` (abre a URL com `WebBrowser.openBrowserAsync` e, ao fechar, invalida `subscriptionKey`; erros viram toast via `useToast`); rota `billing-return` que faz `router.replace("/")`.

- [ ] **Step 1: Implementar `useBillingActions`** conforme a interface acima.
- [ ] **Step 2: Reescrever `PaywallBlock`.** Título e subtítulo novos, sem prometer preço (o valor vem do Stripe Checkout, não do app). CTAs "Assinar mensal" e "Assinar anual" (`Button` com `loading={pending}`) e "Continuar grátis" chamando `onNext`. Enquanto `useSubscription` carrega, mostrar `PaywallSkeleton` com o mesmo shape. Se já for `pro`, pular direto com `onNext`.
- [ ] **Step 3: Item "Assinatura" no Perfil.** `MenuItem` com ícone de `lucide-react-native`, `label="Assinatura"` e subtítulo `subscriptionLabel(...)`; sem subtítulo (não spinner) enquanto carrega. Toque abre `openPortal()` se `has_customer`; senão navega para o paywall.
- [ ] **Step 4: Criar `app/billing-return.tsx`** (rota simples, sem UI além de um skeleton, redireciona para a Home).
- [ ] **Step 5: Verificar.** `npm run typecheck` e `npm run lint` no monorepo (inclui `lint:legal-copy`: ajustar o texto do paywall se a regra de cópia legal reclamar). Rodar o app (`npm run dev:mobile`) e conferir o fluxo do paywall e do Perfil na tela.
- [ ] **Step 6: Commit.** `git commit -m "feat(mobile): paywall com Stripe Checkout e gestão de assinatura no perfil"`

---

### Task 8: Verificação ponta a ponta (modo teste)

Só verificação; não há código novo.

- [ ] **Step 1: Preparar o Stripe em modo teste.** Criar produto "Pro" com dois Prices recorrentes (mensal, anual), configurar o Customer Portal e copiar os IDs para `apps/server/.env` (`STRIPE_PRICE_*`, `STRIPE_TRIAL_DAYS`). Não colar chaves no chat nem no repo; se alguma vazar, rotacionar.
- [ ] **Step 2: Subir tudo local.** `supabase start`, `npm run dev:server` e `stripe listen --forward-to localhost:3000/webhooks/stripe` (copiar o `whsec_` para `STRIPE_WEBHOOK_SECRET`).
- [ ] **Step 3: Percorrer o ciclo no app.** Assinar com cartão de teste e confirmar `subscriptions` em `pro/trialing` e o app mostrando "Premium (teste grátis)" sem recarregar; `stripe trigger invoice.payment_failed` → `past_due`; cancelar pelo Portal → `free/canceled`; reenviar o mesmo evento com `stripe events resend` → sem efeito duplicado; assinar de novo com o mesmo usuário → sem trial.
- [ ] **Step 4: Exclusão de conta.** Excluir uma conta de teste com assinatura ativa e conferir no painel que ela foi cancelada.
- [ ] **Step 5: Registrar o resultado** no Status do milestone em `docs/PLAN.md` e commitar: `git commit -m "docs(plan): status do milestone de cobrança Stripe"`.
- [ ] **Step 6: Antes de `live`.** Revisão por outra pessoa, validação de produto/jurídico sobre as lojas, aplicar a migration em staging e só então configurar chaves `live` e o endpoint do webhook de produção.
