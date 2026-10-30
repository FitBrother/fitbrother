# Integração Stripe Checkout — pendências e referência

Este arquivo é a fonte única do que falta configurar. Os parâmetros do Checkout Studio já estão aplicados no código.

## Valores a substituir

Nenhum parâmetro `sample_only` ficou com valor de exemplo: `mode`, `success_url`, `cancel_url` e `line_items` já têm valores reais no código. O que falta é **configurar os valores de ambiente** de que eles dependem.

**Arquivo:** [apps/server/src/services/billing.ts](apps/server/src/services/billing.ts)

| Parâmetro | Valor atual | O que configurar |
| --- | --- | --- |
| `mode` | `subscription` | Nada. Assinatura recorrente. |
| `success_url` | `${APP_URL}/billing-return?status=success` | Defina `APP_URL` com a URL pública do PWA de cada ambiente. |
| `cancel_url` | `${APP_URL}/billing-return?status=cancel` | Mesmo `APP_URL`. |
| `line_items[].price` | `STRIPE_PRICE_MONTHLY` ou `STRIPE_PRICE_ANNUAL` | IDs `price_...` do Dashboard em <https://dashboard.stripe.com/prices>, um por intervalo. Use IDs de **teste** em dev. |
| `subscription_data.trial_period_days` | `STRIPE_TRIAL_DAYS` | Dias de teste grátis. `0` desliga o trial. |

## Parâmetros configurados

Vêm do Checkout Studio e já estão aplicados.

**Arquivo:** [apps/server/src/services/billing.ts](apps/server/src/services/billing.ts)

| Parâmetro | Valor |
| --- | --- |
| `ui_mode` | `hosted_page` (SDK `stripe` 23.0.1; para SDK anterior a 21.0.0 o valor seria `hosted`) |
| `billing_address_collection` | `auto` |
| `phone_number_collection` | `{ enabled: false }` |
| `automatic_tax` | `{ enabled: false }` |
| `allow_promotion_codes` | `false` |
| `payment_method_collection` | `always` (só vale em `subscription`) |
| `submit_type` | `auto` |
| `integration_identifier` | `hosted_mobile_app_0001` |
| `origin_context` | `mobile_app` |

### Parâmetros mantidos fora do Checkout Studio

As instruções originais mandavam remover parâmetros ausentes da lista. Estes **foram mantidos de propósito**, porque o Checkout Studio não os controla e removê-los quebra a integração:

- `customer`: reaproveita o cliente Stripe do usuário.
- `client_reference_id` e `metadata.user_id`: o webhook usa para achar o usuário.
- `subscription_data.metadata.user_id` e `subscription_data.trial_period_days`: roteamento do webhook e trial.

## Configuração e próximos passos

### Variáveis de ambiente do servidor

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_TRIAL_DAYS` e `APP_URL`. Os nomes do Stripe estão em [apps/server/.env.example](apps/server/.env.example). O `APP_URL` não está lá: é lido em [apps/server/src/lib/env.ts](apps/server/src/lib/env.ts), onde o padrão é a URL de produção, então defina-o em cada ambiente. Chaves em <https://dashboard.stripe.com/test/apikeys>. Nunca commite valores reais.

**Ainda falta no deploy:** o `template.yaml` e o `.github/workflows/ci.yml` não repassam as variáveis do Stripe ao Lambda. Sem elas, o checkout responde 503 `billing_not_configured` e o webhook responde 400.

### Webhook

Cadastre um endpoint em <https://dashboard.stripe.com/workbench/webhooks> apontando para `POST /webhooks/stripe` da API, com os eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.payment_failed`. Copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET`. Em desenvolvimento local: `stripe listen --forward-to localhost:3000/webhooks/stripe`.

### Como funciona

1. O app chama `POST /billing/checkout` com `{ interval: "month" | "year" }`.
2. O servidor cria ou reaproveita o cliente Stripe e cria a Checkout Session hospedada.
3. O app abre a URL no navegador. Depois do pagamento, o Stripe volta para `${APP_URL}/billing-return`.
4. O webhook é a única escrita em `subscriptions`. O app reflete o plano por Realtime.

### Estrutura

- [apps/server/src/services/billing.ts](apps/server/src/services/billing.ts): checkout, portal, leitura e cancelamento.
- [apps/server/src/services/stripe-webhook.ts](apps/server/src/services/stripe-webhook.ts) e [apps/server/src/routes/stripe-webhook.ts](apps/server/src/routes/stripe-webhook.ts): webhook idempotente.
- [supabase/migrations/0080_stripe_billing.sql](supabase/migrations/0080_stripe_billing.sql): schema e RLS.

### Cartões de teste (modo teste)

- Sucesso: `4242 4242 4242 4242`
- Exige autenticação 3D Secure: `4000 0025 0000 3155`
- Recusado por saldo insuficiente: `4000 0000 0000 9995`

Qualquer data futura, qualquer CVC e qualquer CEP.

### Próximos passos

- Rodar o smoke test ponta a ponta em modo teste: trial, cobrança, falha de pagamento e cancelamento.
- Confirmar a política das lojas Apple e Google para checkout web antes de publicar.
- Só ativar as chaves `live` depois de revisão de outra pessoa.

## Recursos

- <https://support.stripe.com>
- <https://docs.stripe.com/mcp>
