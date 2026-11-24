# Stripe Checkout embutido (web) — design curto

## Intenção
No PWA, tocar num plano deve mostrar o checkout dentro do app, numa página própria, sem janela flutuante nem saída para outro site. Hoje o app abre a sessão hospedada com `WebBrowser.openBrowserAsync` (um `window.open` após `await`), que o PWA instalado bloqueia: nada aparece.

## Metas
- Rota `/checkout?interval=month|year` com o Checkout embutido (web).
- Servidor cria sessão `embedded` e devolve `client_secret`.
- Retorno via `return_url` para `/billing-return`; plano confirmado pelo Realtime/webhook (webhook continua única escrita em `subscriptions`).

## Não metas
- Embutir no iOS/Android nativo (WebView). Nativo mantém o fluxo hospedado atual.
- Gating de features, chaves `live`, mudanças em produção.

## Anti-metas
- Expor `STRIPE_SECRET_KEY` ao cliente. Só a chave publicável vai ao app.
- Perder as guardas de `createCheckoutUrl` (409 `already_subscribed`, trial só sem assinatura prévia, customer reaproveitado).

## Restrições
- Checkout Studio: parâmetros aplicados hoje são de `hosted_page`; verificar na documentação do Stripe quais valem em `embedded` (ao menos `submit_type` e `origin_context`) e remover os inválidos.
- `embedded` não aceita `success_url`/`cancel_url`: usa `return_url` com `{CHECKOUT_SESSION_ID}`.
- Stripe.js só roda na web. Nova variável `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` na variante dev do app.
- CLAUDE.md UI: skeleton ao carregar, `font-sans-*`, hit target 44x44, sem hex inline.
- Dependências novas (aprovadas): `@stripe/stripe-js`, `@stripe/react-stripe-js`.

## Abordagens
1. **Embedded na web + hospedado no nativo (escolhida).** Resolve o PWA, mudança contida.
2. Só corrigir o hospedado (redirecionar na mesma aba): mais simples, mas sai do app, contra o pedido.
3. Embedded também no nativo via WebView: cobre tudo, mas muito mais escopo e risco.

## Decisões
- `POST /billing/checkout` aceita `ui: "embedded" | "hosted"` (padrão `hosted`, compatível com nativo) e responde `{ url }` ou `{ client_secret }`.
- `PlanChoice` e `PaywallBlock` navegam para `/checkout` na web; no nativo seguem com `startCheckout` atual.
- `/billing-return` passa a receber `session_id`; a copy de sucesso só aparece com retorno de checkout concluído.

## Fica para quem implementa
Nomes de tipos/schemas em `packages/shared`, layout exato da página, tratamento de erro do carregamento do Stripe.js, testes (servidor com Stripe injetado; mobile com lógica de rota/labels).
