# Stripe Checkout embutido (web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No PWA, tocar num plano abre uma página `/checkout` com o Stripe Checkout embutido; no iOS/Android nativo o fluxo hospedado atual continua.

**Architecture:** `POST /billing/checkout` ganha `ui: "hosted" | "embedded"` (padrão `hosted`) e responde `{ url }` ou `{ client_secret }`. O mobile, só na web, navega para `app/checkout.web.tsx`, que monta `EmbeddedCheckout` do Stripe.js com a chave publicável. O `return_url` aponta para `/billing-return?session_id=...`; o webhook segue como única escrita em `subscriptions`.

**Tech Stack:** Fastify + Stripe SDK 23.0.1 (server), Expo Router 6 + react-native-web (mobile), `@stripe/stripe-js` e `@stripe/react-stripe-js` (novas, aprovadas), vitest (server/shared), jest-expo (mobile).

**Spec:** `docs/superpowers/specs/2026-11-23-stripe-embedded-checkout-design.md`

## Global Constraints

- Nunca expor `STRIPE_SECRET_KEY` ao cliente; só `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_...`).
- Sessão `embedded`: `ui_mode: "embedded_page"` (SDK 23.0.1), **sem** `success_url`/`cancel_url`, com `return_url` contendo `{CHECKOUT_SESSION_ID}`, `redirect_on_completion: "always"`, `origin_context: "web"`. `submit_type`, `integration_identifier`, `billing_address_collection`, `phone_number_collection`, `automatic_tax`, `allow_promotion_codes`, `payment_method_collection` continuam válidos (verificado nos tipos do SDK).
- Sessão `hosted` (padrão, nativo) fica **idêntica** à de hoje, inclusive `origin_context: "mobile_app"` e os testes existentes.
- Manter as guardas de `createCheckoutUrl`: 409 `already_subscribed`, customer reaproveitado, trial só sem assinatura prévia.
- UI (CLAUDE.md): skeleton ao carregar (nunca `ActivityIndicator` solto), `font-sans-*`, hit target 44x44, `accessibilityRole`/`accessibilityLabel`, sem hex inline, sem `dark:`, ícones só `lucide-react-native`.
- Comentários só se indispensáveis, em inglês, 1 linha. Commits em Conventional Commits, sem trailer de agente. Sem produção, sem chaves `live`.
- Dependências novas permitidas: apenas `@stripe/stripe-js` e `@stripe/react-stripe-js`, em `apps/mobile`.

## Review Focus

1. Nativo não pode quebrar: sem `ui` o servidor devolve `{ url }` hospedado; no mobile `embeddedCheckoutSupported("ios"|"android")` é `false`.
2. `409 already_subscribed` na página `/checkout`: mostra mensagem e botão de voltar, nunca iframe vazio.
3. Chave publicável ausente ou Stripe.js bloqueado (ad blocker): estado de erro com botão de voltar, nunca página em branco.
4. Montagem dupla/recarga de `/checkout`: `fetchClientSecret` estável (não cria sessão a cada render).
5. `/billing-return` sem `status`/`session_id` mostra copy neutra, não "Pagamento recebido".

---

### Task 1: Contrato compartilhado e sessão embedded no servidor

**Files:**
- Modify: `packages/shared/src/schemas.ts` (bloco Billing, ~linha 725)
- Test: arquivo de testes de schemas já existente em `packages/shared/src` (achar com `ls packages/shared/src | grep test`; criar `schemas.billing.test.ts` se não houver)
- Modify: `apps/server/src/services/billing.ts` (`createCheckoutUrl`, ~linhas 66-123)
- Modify: `apps/server/src/routes/billing.ts` (rota `/billing/checkout`)
- Test: `apps/server/src/services/billing.test.ts`

**Interfaces:**
- Produces (shared):
  - `CheckoutUiSchema = z.enum(["hosted", "embedded"])`, `type CheckoutUi`.
  - `CreateCheckoutRequestSchema = z.object({ interval: BillingIntervalSchema, ui: CheckoutUiSchema.default("hosted") })`.
  - `CheckoutResponseSchema = z.union([z.object({ url: z.string().url() }), z.object({ client_secret: z.string().min(1) })])`, `type CheckoutResponse`.
  - `BillingUrlResponseSchema` permanece (portal).
- Produces (server): `createCheckout(userId: string, email: string | null, interval: BillingInterval, ui: CheckoutUi, deps?: BillingDeps): Promise<CheckoutResponse>` substitui `createCheckoutUrl`.

- [ ] **Step 1: Write failing tests (shared)**

```ts
it("defaults ui to hosted", () => {
  expect(CreateCheckoutRequestSchema.parse({ interval: "month" }).ui).toBe("hosted");
});
it("rejects an unknown ui", () => {
  expect(CreateCheckoutRequestSchema.safeParse({ interval: "month", ui: "x" }).success).toBe(false);
});
it("accepts url or client_secret responses", () => {
  expect(CheckoutResponseSchema.safeParse({ url: "https://c.test/s" }).success).toBe(true);
  expect(CheckoutResponseSchema.safeParse({ client_secret: "cs_test_1" }).success).toBe(true);
  expect(CheckoutResponseSchema.safeParse({}).success).toBe(false);
});
```

- [ ] **Step 2: Run** `npm run test --workspace packages/shared`. Expected: FAIL (símbolos inexistentes).

- [ ] **Step 3: Implement** os schemas e tipos acima em `packages/shared/src/schemas.ts`. Rodar de novo: PASS.

- [ ] **Step 4: Write failing tests (server)** em `billing.test.ts`: renomear as chamadas de `createCheckoutUrl(..., "month", m.deps)` para `createCheckout(..., "month", "hosted", m.deps)` (o resultado vira `{ url }`; ajustar `expect(url).toBe` para `expect(result).toEqual({ url: "https://checkout.test/s" })`), e adicionar:

```ts
it("creates an embedded session and returns the client secret", async () => {
  const m = makeDeps(row());
  m.sessionsCreate.mockResolvedValueOnce({ client_secret: "cs_test_1" } as never);
  const result = await createCheckout(USER, "a@b.co", "month", "embedded", m.deps);
  expect(result).toEqual({ client_secret: "cs_test_1" });
  const params = m.sessionsCreate.mock.calls[0]![0];
  expect(params).toMatchObject({
    ui_mode: "embedded_page",
    mode: "subscription",
    return_url: "https://app.test/billing-return?session_id={CHECKOUT_SESSION_ID}",
    redirect_on_completion: "always",
    origin_context: "web",
    client_reference_id: USER,
    metadata: { user_id: USER },
    subscription_data: { metadata: { user_id: USER } },
  });
  expect(params).not.toHaveProperty("success_url");
  expect(params).not.toHaveProperty("cancel_url");
});
it("keeps the already_subscribed guard for embedded", async () => {
  const m = makeDeps(row({ plan: "pro" }));
  await expect(createCheckout(USER, null, "month", "embedded", m.deps)).rejects.toMatchObject({
    code: "already_subscribed",
  });
});
it("throws when an embedded session has no client secret", async () => {
  const m = makeDeps(row());
  m.sessionsCreate.mockResolvedValueOnce({ client_secret: null } as never);
  await expect(createCheckout(USER, null, "month", "embedded", m.deps)).rejects.toThrow(
    "stripe_checkout_without_client_secret",
  );
});
```

- [ ] **Step 5: Run** `npm run test --workspace apps/server -- billing`. Expected: FAIL (`createCheckout` não existe).

- [ ] **Step 6: Implement** `createCheckout` em `billing.ts`: manter guardas, customer e trial como estão; extrair os parâmetros comuns (`mode`, `billing_address_collection`, `phone_number_collection`, `automatic_tax`, `allow_promotion_codes`, `payment_method_collection`, `submit_type`, `customer`, `client_reference_id`, `metadata`, `line_items`, `subscription_data`) e variar só o que muda por `ui`: `hosted` mantém `ui_mode: "hosted_page"`, `integration_identifier: "hosted_mobile_app_0001"`, `origin_context: "mobile_app"`, `success_url`, `cancel_url`; `embedded` usa `ui_mode: "embedded_page"`, `integration_identifier: "embedded_web_app_0001"`, `origin_context: "web"`, `return_url`, `redirect_on_completion: "always"`. Retorno: `{ url }` (lança `stripe_checkout_without_url` se faltar) ou `{ client_secret }` (lança `stripe_checkout_without_client_secret`). Na rota, ler `parsed.data.ui`, chamar `createCheckout` e fazer `reply.send(result)`.

- [ ] **Step 7: Run** `npm run test --workspace apps/server` e `npm run typecheck`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared apps/server
git commit -m "feat(billing): sessão de checkout embedded e parâmetro ui no endpoint"
```

---

### Task 2: Roteamento do checkout no mobile (web embedded, nativo hospedado)

**Files:**
- Create: `apps/mobile/lib/billing-checkout.ts`
- Test: `apps/mobile/lib/billing-checkout.test.ts`
- Modify: `apps/mobile/lib/api/billing.ts`
- Modify: `apps/mobile/lib/hooks/useBillingActions.ts`

**Interfaces:**
- Produces: `embeddedCheckoutSupported(os: string): boolean` (`true` só para `"web"`); `checkoutHref(interval: BillingInterval): string` → `/checkout?interval=<interval>`; `createCheckout(interval, ui = "hosted"): Promise<CheckoutResponse>` em `lib/api/billing.ts`; `createEmbeddedCheckout(interval): Promise<string>` que devolve o `client_secret` (lança `Error("checkout_without_client_secret")` se a resposta vier sem ele).
- `useBillingActions().startCheckout(interval)`: se `embeddedCheckoutSupported(Platform.OS)`, faz `router.push(checkoutHref(interval))` sem chamar a API; senão mantém o fluxo hospedado atual (pega `url` e `openUrl`).

- [ ] **Step 1: Write failing tests**

```ts
test("only web embeds the checkout", () => {
  expect(embeddedCheckoutSupported("web")).toBe(true);
  expect(embeddedCheckoutSupported("ios")).toBe(false);
  expect(embeddedCheckoutSupported("android")).toBe(false);
});
test("builds the checkout href", () => {
  expect(checkoutHref("year")).toBe("/checkout?interval=year");
});
```

- [ ] **Step 2: Run** `npm run test --workspace apps/mobile -- billing-checkout`. Expected: FAIL.

- [ ] **Step 3: Implement** o helper, os ajustes de `lib/api/billing.ts` (corpo `{ interval, ui }`; `createCheckout` hospedado devolve `{ url }` e deve lançar `Error("checkout_without_url")` se a resposta vier sem `url`) e o `startCheckout` do hook (usar `useRouter` de `expo-router` e `Platform` de `react-native`; preservar `run`/tratamento de erro existente para o ramo nativo).

- [ ] **Step 4: Run** testes do mobile e `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): navega para a página de checkout embutido na web"
```

---

### Task 3: Página `/checkout` com Stripe embutido (web)

**Files:**
- Modify: `apps/mobile/package.json` (via `npm install @stripe/stripe-js @stripe/react-stripe-js --workspace apps/mobile`) e `package-lock.json`
- Create: `apps/mobile/app/checkout.web.tsx` (página real, só web)
- Create: `apps/mobile/app/checkout.tsx` (nativo: `<Redirect href="/" />`)
- Create: `apps/mobile/components/domain/CheckoutSkeleton.tsx`
- Create: `apps/mobile/lib/checkout-state.ts`
- Test: `apps/mobile/lib/checkout-state.test.ts`
- Modify: `apps/mobile/.env.example`

**Interfaces:**
- Consumes: `createEmbeddedCheckout(interval)` e `checkoutHref` (Task 2), `billingErrorMessage`/`BILLING_UNAVAILABLE_MESSAGE` de `lib/billing-errors.ts`.
- Produces: `checkoutErrorMessage(code: string): string` — `already_subscribed` → "Você já tem uma assinatura ativa."; qualquer outro código → `BILLING_UNAVAILABLE_MESSAGE`. `parseInterval(raw: string | string[] | undefined): BillingInterval | null` — só `"month"`/`"year"`, senão `null`.

- [ ] **Step 1: Write failing tests**

```ts
test("maps already_subscribed to its own message", () => {
  expect(checkoutErrorMessage("already_subscribed")).toBe("Você já tem uma assinatura ativa.");
});
test("falls back to the unavailable message", () => {
  expect(checkoutErrorMessage("billing_not_configured")).toBe(BILLING_UNAVAILABLE_MESSAGE);
  expect(checkoutErrorMessage("")).toBe(BILLING_UNAVAILABLE_MESSAGE);
});
test("parseInterval accepts only month and year", () => {
  expect(parseInterval("month")).toBe("month");
  expect(parseInterval("year")).toBe("year");
  expect(parseInterval("week")).toBeNull();
  expect(parseInterval(undefined)).toBeNull();
  expect(parseInterval(["month"])).toBeNull();
});
```

- [ ] **Step 2: Run** `npm run test --workspace apps/mobile -- checkout-state`. Expected: FAIL.

- [ ] **Step 3: Implement** `lib/checkout-state.ts`; instalar as duas dependências; adicionar `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=` com comentário de uma linha em `.env.example`.

- [ ] **Step 4: Implement** `app/checkout.web.tsx`: lê `interval` com `useLocalSearchParams` + `parseInterval`; sem intervalo válido, `<Redirect href="/" />`. Módulo carrega `loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY)` uma única vez (promise no escopo do módulo; chave ausente → estado de erro). Renderiza `EmbeddedCheckoutProvider` com `options={{ fetchClientSecret }}`, onde `fetchClientSecret` é `useCallback`/`useMemo` estável baseado em `interval` e chama `createEmbeddedCheckout`. Para conhecer o erro antes de montar o iframe, busca o `client_secret` num `useEffect` (uma vez) e só monta o provider com `fetchClientSecret: async () => secret` depois de resolvido; enquanto carrega mostra `CheckoutSkeleton`; em erro mostra `checkoutErrorMessage(err.message)` e `Button` "Voltar" (`router.replace("/")`, hit target 44x44). Tela dentro de `SafeAreaView` com `ScrollView`, fundo `bg-neutral-50`, header com título "Assinar Fitbrother Premium" (`font-display-bold`) e botão voltar icon-only (`ArrowLeft` do lucide, `accessibilityLabel="Voltar"`). `CheckoutSkeleton` espelha o formato da página (bloco do título + dois blocos grandes do formulário) com `SkeletonBlock`.

- [ ] **Step 5: Run** `npm run test --workspace apps/mobile`, `npm run typecheck`, `npm run lint`. Expected: PASS. Verificar manualmente que `npm run build:web --workspace apps/mobile` conclui sem erro (confirma que `checkout.web.tsx` resolve e que o bundle nativo não importa o Stripe).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile package-lock.json
git commit -m "feat(mobile): página de checkout com Stripe embutido na web"
```

---

### Task 4: Retorno do checkout e documentação

**Files:**
- Modify: `apps/mobile/lib/billing-labels.ts` (ou arquivo novo `apps/mobile/lib/billing-return.ts` se `billing-labels` ficar sem coesão)
- Test: teste ao lado do arquivo escolhido
- Modify: `apps/mobile/app/billing-return.tsx`
- Modify: `FEATURES.md` (linha do `POST /billing/checkout`, ~296)
- Modify: `STRIPE_INTEGRATION_TODO.md`

**Interfaces:**
- Produces: `billingReturnState(params: { status?: string; session_id?: string }): "success" | "cancel" | "neutral"` — `session_id` presente ou `status === "success"` → `success`; `status === "cancel"` → `cancel`; demais (inclui `portal` e vazio) → `neutral`.

- [ ] **Step 1: Write failing tests**

```ts
test("session_id means success", () => {
  expect(billingReturnState({ session_id: "cs_test_1" })).toBe("success");
});
test("status success and cancel map directly", () => {
  expect(billingReturnState({ status: "success" })).toBe("success");
  expect(billingReturnState({ status: "cancel" })).toBe("cancel");
});
test("portal return and empty params are neutral", () => {
  expect(billingReturnState({ status: "portal" })).toBe("neutral");
  expect(billingReturnState({})).toBe("neutral");
});
```

- [ ] **Step 2: Run** os testes do mobile. Expected: FAIL.

- [ ] **Step 3: Implement** `billingReturnState` e usá-lo em `billing-return.tsx`: `success` → ícone `CircleCheck` e "Pagamento recebido. Estamos ativando seu plano." ; `cancel` → copy atual de assinatura não concluída; `neutral` → `CircleCheck` com "Tudo certo. Você já pode voltar ao app." Manter o `invalidateQueries` e o botão "Continuar".

- [ ] **Step 4: Update docs.** `FEATURES.md`: `POST /billing/checkout` `{interval, ui?:'hosted'|'embedded'}` → `{url}` (hosted, padrão) ou `{client_secret}` (embedded, usado pela web). `STRIPE_INTEGRATION_TODO.md`: seção "Checkout embutido (web)" com: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (chave `pk_test_...` na Vercel do ambiente de dev, requer novo build do web), `return_url` com `session_id`, `origin_context` e `integration_identifier` do modo embedded, e o fato de que o nativo segue hospedado.

- [ ] **Step 5: Run** `npm run test`, `npm run typecheck`, `npm run lint`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile FEATURES.md STRIPE_INTEGRATION_TODO.md
git commit -m "feat(billing): retorno do checkout embutido e docs"
```

---

### Task 5: Verificação ponta a ponta em dev (feita pelo usuário)

Fora do código; requer o ambiente de dev.

- [ ] Definir `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`) no projeto web de dev e refazer o build.
- [ ] No PWA instalado: Perfil → assinar → `/checkout` mostra o formulário embutido; pagar com `4242 4242 4242 4242`; voltar em `/billing-return`; plano muda para pro por Realtime/webhook.
- [ ] Repetir com `4000 0025 0000 3155` (3DS) e conferir que a volta fica dentro do app (no iOS, redirecionamento pode sair do escopo do PWA).
- [ ] Assinar de novo com plano pro: `/checkout` mostra "Você já tem uma assinatura ativa."
