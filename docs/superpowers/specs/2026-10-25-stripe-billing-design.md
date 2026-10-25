# Integração Stripe — cobrança do plano pro

Status: rascunho para revisão. Sujeito a validação de produto e jurídico (políticas Apple/Google).

## 1. Objetivo

Cobrar o plano `pro` via Stripe e manter `subscriptions` sempre fiel ao estado real da assinatura. Nesta entrega **não há gating de features**: o app apenas cobra e exibe o plano.

## 2. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Fluxo | Stripe Checkout hospedado, aberto no navegador (web). Sem IAP e sem PaymentSheet. |
| Fonte de verdade | Webhook do Stripe. O app nunca escreve em `subscriptions`. |
| Planos | Mensal e anual, ambos com trial. Valores e duração do trial vêm de configuração, nunca fixos no código. |
| Escopo | Só cobrança e status. Gating, IAP/RevenueCat, cupons e nota fiscal ficam de fora. |

Premissas a confirmar:

- `past_due` mantém `plan='pro'` durante a tolerância de cobrança. **A confirmar com produto.**
- A política das lojas permite o fluxo web no(s) país(es) de distribuição. **A confirmar com jurídico e produto.**

## 3. Banco de dados

Migration nova `0079_stripe_billing.sql`. Nenhuma migration anterior é editada.

- `subscriptions`: adicionar `stripe_customer_id text UNIQUE NULL`.
- `subscriptions`: hoje a policy `subscriptions_owner_all` (`0006_subscriptions.sql`) é `FOR ALL`, ou seja, o cliente pode escrever na própria linha. A migration remove essa policy e cria uma de SELECT (`auth.uid() = user_id`). INSERT/UPDATE/DELETE passam a ser só do servidor com `service_role`. Registrar como exceção à policy padrão em `FEATURES.md` §3.5.
- `complete_onboarding_impl` faz `INSERT INTO subscriptions`, mas é chamada pelo wrapper `complete_onboarding`, que é `SECURITY DEFINER` (`0054_m6_account_reactivation.sql`). A mudança de policy não deve quebrá-lo, e o smoke test do plano confirma isso.
- `subscriptions` entra na publicação `supabase_realtime` (como `meals`, em `0023`) para o `useSubscription` receber o webhook.
- Nova tabela `stripe_events`:

| Coluna | Tipo | Notas |
|---|---|---|
| `event_id` | text PK | ID do evento Stripe. |
| `type` | text | |
| `received_at` | timestamptz | default `now()`. |
| `processed_at` | timestamptz NULL | NULL = pendente de retry. |

- `stripe_events` não tem `user_id`. RLS ligado e sem policy: só `service_role` acessa. Registrar como exceção em `FEATURES.md` §3.5.
- Atualizar `FEATURES.md` (§ `subscriptions`) com a coluna nova e `docs/PLAN.md` com o novo milestone.

## 4. Servidor (`apps/server`)

Dependência nova: `stripe` (SDK oficial), somente no servidor.

### 4.1 `POST /billing/checkout`

- Auth obrigatória. Body: `{ interval: 'month' | 'year' }` (schema zod em `packages/shared`).
- Cria o Customer se `stripe_customer_id` for nulo e persiste o ID. Reaproveita se existir.
- Cria a Checkout Session em modo `subscription` com o Price do intervalo, `client_reference_id = user_id`, `metadata.user_id` e URLs de retorno em `APP_URL` (página web do app, não deep link). `subscription_data.trial_period_days` (de env) só é enviado se o usuário nunca teve assinatura, para não conceder trial repetido.
- Se já houver assinatura `active` ou `trialing`, responde erro tipado e não cria nova sessão.
- Resposta: `{ url }`.

### 4.2 `POST /billing/portal`

- Auth obrigatória. Exige `stripe_customer_id`. Devolve `{ url }` do Customer Portal.

### 4.3 `POST /webhooks/stripe`

Ordem obrigatória, espelhando a regra dos webhooks do WhatsApp:

1. Valida a assinatura com o corpo cru e `STRIPE_WEBHOOK_SECRET`. Falha → 400.
2. `INSERT` em `stripe_events` com `event_id` UNIQUE, antes de qualquer efeito. Conflito com `processed_at` preenchido → 200 e encerra.
3. Processa o evento e atualiza `subscriptions` por `stripe_customer_id` (ou `metadata.user_id` no primeiro evento).
4. Marca `processed_at = now()`. Falha no passo 3 deixa `processed_at` NULL e responde 5xx para o Stripe reenviar.

Eventos tratados: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

Eventos fora de ordem: o handler lê o estado atual da assinatura no Stripe em vez de confiar só no payload, para não regredir o status.

### 4.4 Mapeamento de status

| Stripe | `status` | `plan` |
|---|---|---|
| `trialing` | `trialing` | `pro` |
| `active` | `active` | `pro` |
| `past_due`, `unpaid` | `past_due` | `pro` (premissa, ver §2) |
| `canceled`, `incomplete_expired` | `canceled` | `free` |

`current_period_start/end`, `provider='stripe'` e `provider_subscription_id` são sempre gravados.

### 4.5 `DELETE /account`

`DELETE /account` é um soft delete com purge posterior; reativar a conta é possível nesse intervalo. Depois da autorização e antes de `fitbrother_request_account_deletion`, cancela a assinatura Stripe ativa do usuário imediatamente, para parar a cobrança. Falha ao cancelar interrompe a exclusão com erro (`billing_cancel_failed`), sem deixar cobrança ativa em silêncio. Consequência aceita: uma conta reativada volta como `free` e precisa assinar de novo. **A confirmar com produto.**

### 4.6 Configuração

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_TRIAL_DAYS`. Placeholders em `.env.example`. Nenhuma chave real no repositório. Chave secreta nunca vai para o cliente.

## 5. Mobile (`apps/mobile`)

- `lib/api.ts`: funções `createCheckout(interval)` e `createPortal()`.
- `lib/hooks/useSubscription.ts`: lê `subscriptions` do usuário com Realtime, para refletir o webhook sem polling manual.
- Bloco `paywall` do onboarding: deixa de ser placeholder. CTAs mensal e anual, e "continuar grátis" que segue o fluxo normal. Abre o Checkout com `expo-web-browser`. Ao voltar, o `useSubscription` atualiza o estado.
- Perfil: linha "Gerenciar assinatura" abre o portal. Exibe plano e status.
- Loading com skeleton (`<Tela>Skeleton.tsx`), nunca `ActivityIndicator` de tela. Hit target 44×44, `accessibilityLabel`/`accessibilityRole`, números com `tabular-nums`, cores por token.
- `expo-web-browser` já está em `apps/mobile/package.json`, então não há dependência nova no mobile.

## 6. Testes e verificação

- Unitários: mapeamento de status (§4.4), idempotência do webhook (evento duplicado), evento fora de ordem e erro de assinatura.
- Smoke test ponta a ponta em modo teste com Stripe CLI (`stripe listen` + `stripe trigger`), cobrindo trial → ativo → falha de pagamento → cancelamento.
- `npm run typecheck` e `npm run lint` no monorepo.

## 7. Riscos e operação

- Migration e webhook afetam banco e produção. Executar primeiro em ambiente controlado, com revisão de outra pessoa.
- Só ativar chaves `live` depois do smoke test em modo teste e da validação jurídica das lojas.
- Revisar o RLS de `subscriptions` com cuidado: hoje o cliente pode escrever (`FOR ALL`), o que anularia a cobrança. Esse ajuste é pré-requisito para o resto.

## 8. Fora do escopo

Gating de features e cap de IA por plano, IAP/RevenueCat, cupons, nota fiscal e impostos, e múltiplas moedas.
