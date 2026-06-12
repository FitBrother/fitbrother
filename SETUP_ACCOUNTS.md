# SETUP_ACCOUNTS.md — Provisionamento de contas externas (M0)

Walkthrough acionável para criar todas as contas que o Fitbrother precisa. Ordem otimizada: serviços com fila de aprovação (Meta WhatsApp) **começam primeiro**, para a espera correr em paralelo com o resto do M0.

**Tempo total estimado:** 2-3 horas de trabalho ativo + 1-5 dias de espera (Meta review).

---

## Antes de começar (5 min)

- [ ] **Gerenciador de secrets** funcionando — 1Password, Bitwarden, Doppler, ou similar. Nunca cole keys em chat/email.
- [ ] **Cartão de crédito** internacional ativo (OpenAI, Google Cloud, Fly.io).
- [ ] **Telefone próprio em E.164** (`+55119...`) que aceite WhatsApp — para handshake e teste do bot.
- [ ] **Email dedicado ao produto** (idealmente um alias tipo `fitbrother@<dominio>` em vez do pessoal) — facilita transferência depois.
- [ ] Criar `.env.local` na raiz do repo (já está no `.gitignore`). Vai preencher conforme avança.

```bash
# Na raiz do repo:
touch .env.local
echo ".env*" >> .gitignore  # garantir que não vaza
```

---

## 1. Meta for Developers + WhatsApp Cloud API ⏱️ ~40 min ativo + 1-5 dias review

**Começa primeiro** porque a revisão final da Meta leva dias. O **test number** gratuito permite desenvolver tudo enquanto espera.

### 1.1 Conta Meta Business

1. Abrir https://business.facebook.com → "Criar conta". Usar email do produto.
2. Preencher nome do negócio: `Fitbrother`. País: Brasil.
3. Em **Configurações → Verificação de Negócios**, iniciar o processo (pode pedir CNPJ, comprovante). **Não bloqueia o test number** — só é exigido para sair do sandbox.

### 1.2 Meta App + WhatsApp Product

1. Ir em https://developers.facebook.com/apps → **Criar App**.
2. Tipo: **Business** (não Consumer).
3. Nome: `Fitbrother Dev`. Email de contato. Associar à Business Manager criada acima.
4. Na home do app, **Adicionar Produto** → **WhatsApp** → Setup.
5. Selecionar a Business Manager. Meta gera automaticamente:
   - Um **test phone number** (formato `+1 555 ...`).
   - Um **WhatsApp Business Account (WABA)**.
   - Um **access token temporário** (24h — vamos trocar por permanente).

### 1.3 Capturar credenciais

Em **WhatsApp → API Setup**:

```bash
# .env.local
WHATSAPP_PHONE_NUMBER_ID=<phone number ID que aparece no painel>
WHATSAPP_BUSINESS_ACCOUNT_ID=<WABA ID>
WHATSAPP_ACCESS_TOKEN=<token temporário por enquanto>
```

Em **App Settings → Basic**:

```bash
WHATSAPP_APP_SECRET=<App Secret — clique em Show>
```

Definir um `WHATSAPP_VERIFY_TOKEN` qualquer (string aleatória que você escolhe):

```bash
WHATSAPP_VERIFY_TOKEN=$(openssl rand -hex 32)
echo "WHATSAPP_VERIFY_TOKEN=$WHATSAPP_VERIFY_TOKEN" >> .env.local
```

### 1.4 Token permanente (System User)

Tokens de usuário expiram. Para o backend, gerar um **System User token**:

1. Business Manager → **Configurações de negócios → Usuários → Usuários do sistema** → Adicionar.
2. Nome: `fitbrother-server`. Cargo: **Admin**.
3. Atribuir ativo: o WABA criado acima, com permissões totais.
4. **Gerar novo token** → app `Fitbrother Dev` → permissões `whatsapp_business_messaging` + `whatsapp_business_management` → **Nunca expira**.
5. Substituir `WHATSAPP_ACCESS_TOKEN` no `.env.local` pelo permanente.

### 1.5 Adicionar telefones de teste

No painel **WhatsApp → API Setup**, em "Para", adicionar seu próprio número (até 5 destinatários autorizados). Esses números recebem msgs do test number sem precisar de aprovação.

### 1.6 Submeter para revisão final (background)

Só depois que tiver app funcionando vale a pena submeter, mas pode iniciar agora:

- **Business Verification** (Configurações de Negócios → Segurança → Verificação) — exige CNPJ, comprovante de endereço. Leva 1-3 dias úteis.
- **Display Name approval** (WhatsApp Manager → seu telefone → Phone Numbers → Name) — solicitar o display name "Fitbrother" no número real (quando comprar). Leva ~3 dias.

> **Pitfall comum:** o teste inicial NÃO precisa de Business Verification. Só quando for trocar o test number por um número real do produto.

### Verificação

```bash
# Testar token:
curl -G \
  -d "access_token=$WHATSAPP_ACCESS_TOKEN" \
  "https://graph.facebook.com/v21.0/$WHATSAPP_PHONE_NUMBER_ID"
# Esperado: JSON com display_phone_number, etc.
```

---

## 2. Supabase ⏱️ ~15 min

### 2.1 Conta e projetos

1. https://supabase.com → Sign up (GitHub login funciona).
2. Criar organização: `Fitbrother`. Plano **Free** por enquanto (basta pra dev/staging).
3. Criar projeto **`fitbrother-dev`**:
   - Database password: gerar via `openssl rand -base64 32`, salvar no 1Password.
   - Region: `South America (São Paulo)` (`sa-east-1`) — mais próximo do user.
4. Criar projeto **`fitbrother-staging`**: mesma config, mesma region. `fitbrother-prod` fica para M6.

### 2.2 Capturar credenciais

Em cada projeto, **Settings → API**:

```bash
# .env.local — usar dev por enquanto
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret>
```

> ⚠️ `SERVICE_ROLE` bypassa RLS. **Nunca** ir para o app mobile. Só backend.

### 2.3 Supabase CLI local

A CLI vem como `devDependency` do monorepo — `npm install` na raiz já a coloca em `node_modules/.bin/supabase`, e os scripts `npm run db:*` resolvem automaticamente. Instalar globalmente **não** é suportado pela Supabase.

```bash
npx supabase --version   # ou: node_modules/.bin/supabase --version
```

Login (link com sua conta — opcional, só pra gerenciar projetos remotos):

```bash
npx supabase login
```

> **Pitfall:** Docker precisa estar rodando antes de `npm run db:start`. No Linux: `systemctl status docker`.

### Verificação

```bash
npm run db:start   # sobe Postgres + auth + studio local (~3min na 1ª vez)
npm run db:stop
```

---

## 3. Google Cloud + Gemini API ⏱️ ~15 min

### 3.1 Projeto GCP

1. https://console.cloud.google.com → criar projeto `fitbrother-prod` (sim, mesmo em dev — Google permite billing separado).
2. Habilitar billing — exige cartão. Google dá **$300 grátis** para conta nova (90 dias).
3. APIs e Serviços → Biblioteca → **"Generative Language API"** → Habilitar.

### 3.2 API Key

1. APIs e Serviços → Credenciais → **Criar Credencial → Chave de API**.
2. Editar a chave criada:
   - **Restrições da aplicação:** "Nenhum" (vamos usar do backend).
   - **Restrições de API:** **Restringir à** `Generative Language API` apenas.
3. Salvar:

```bash
# .env.local
GEMINI_API_KEY=<sua API key>
LLM_PROVIDER=gemini
LLM_PROMPT_VERSION=v1
```

### 3.3 Quota / cap de custo

Em **Faturamento → Orçamentos e alertas** → criar alerta a **$20 USD/mês**. Gemini 1.5 Flash é barato (~$0.075 / 1M input tokens), mas vale ter teto.

### Verificação

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | head
# Esperado: JSON listando modelos
```

---

## 4. OpenAI (apenas Whisper para áudio) ⏱️ ~10 min

### 4.1 Conta + billing

1. https://platform.openai.com → Sign up.
2. **Billing → Add payment method** (cartão).
3. **Usage limits** → **Hard limit USD 20/mês**. Soft limit 10. Isso barra qualquer surpresa.

### 4.2 API Key

1. **API keys → Create new secret key**.
2. Nome: `fitbrother-server`. Permissions: **Restricted** → ativar **só** `Model capabilities: Audio` (Whisper).
3. Copiar imediatamente (não dá pra ver de novo):

```bash
# .env.local
OPENAI_API_KEY=sk-...
```

### Verificação

```bash
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | head -50
# Esperado: lista com whisper-1
```

> **Por que não OpenAI para LLM?** A camada `LLMProvider` deixa plugável (`LLM_PROVIDER=openai`), mas Gemini Flash é ~10× mais barato para extração de macros. Whisper é exclusividade da OpenAI no MVP.

---

## 5. Sentry ⏱️ ~10 min

### 5.1 Conta e projetos

1. https://sentry.io → Sign up (GitHub login). Plano **Developer** (grátis, 5k events/mês).
2. Criar organização: `fitbrother`.
3. **Projects → Create project**:
   - Platform: **React Native** → nome `fitbrother-mobile` → criar.
   - Repetir: Platform **Node.js** → nome `fitbrother-server` → criar.

### 5.2 DSNs

Cada projeto tem um DSN em **Settings → Client Keys (DSN)**:

```bash
# .env.local
SENTRY_DSN_MOBILE=https://<key>@<org>.ingest.sentry.io/<id>
SENTRY_DSN_SERVER=https://<key>@<org>.ingest.sentry.io/<id>
```

### 5.3 Auth token (para uploads de source maps em CI — opcional no M0)

**Settings → Account → Auth Tokens** → Create → scopes `project:releases`, `project:write`. Guardar:

```bash
SENTRY_AUTH_TOKEN=<token>
SENTRY_ORG=fitbrother
```

> No M0 os DSNs podem ficar vazios — o SDK vira no-op. Configurar pra valer no M6.

---

## 6. Expo / EAS ⏱️ ~10 min

### 6.1 Conta Expo

1. https://expo.dev → Sign up.
2. Username vai aparecer no app store futuramente, escolher com cuidado. Sugestão: `fitbrother`.

### 6.2 EAS CLI

```bash
npm i -g eas-cli
eas login
```

Dentro de `apps/mobile/` no M0 (ainda não existe — fica como nota):

```bash
cd apps/mobile
eas init  # cria EAS project, gera EAS_PROJECT_ID em app.json
```

```bash
# .env.local
EAS_PROJECT_ID=<vai aparecer depois do eas init>
```

> EAS Build cobra após o plano grátis (30 builds/mês). Build local funciona pra dev: `npx expo run:ios` / `run:android`.

---

## 7. Cloudflare Tunnel (apenas dev, para webhook Meta) ⏱️ ~10 min

Necessário em M4 para expor o servidor Fastify local para a Meta. Alternativa: `ngrok` (URL muda; menos prático).

1. https://dash.cloudflare.com → Sign up.
2. Instalar `cloudflared`:
   ```bash
   # Ubuntu/Debian
   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```
3. Autenticar:
   ```bash
   cloudflared tunnel login
   ```
4. Criar tunnel (você decide o domínio — pode ser `fitbrother-dev.<seu-domínio>.com` se tiver um domínio no Cloudflare; senão, usar URL gratuita `*.trycloudflare.com`):
   ```bash
   # Sem domínio próprio (URL muda a cada run):
   cloudflared tunnel --url http://localhost:3000
   # Com domínio próprio (estável):
   cloudflared tunnel create fitbrother-dev
   cloudflared tunnel route dns fitbrother-dev webhook.<seu-domínio>.com
   cloudflared tunnel run fitbrother-dev
   ```

> No M4, essa URL pública vai virar a **Callback URL** no Meta Developer Console (WhatsApp → Configuration → Webhook).

---

## 8. (Opcional) Fly.io — host do server em staging/prod ⏱️ ~10 min

Pode adiar até o M4 quando precisar de URL estável para a Meta apontar. Anotando aqui pra não esquecer.

```bash
curl -L https://fly.io/install.sh | sh
fly auth signup
# Adicionar cartão. Free tier cobre 3 VMs pequenas.
```

`flyctl deploy` virá no M4 com `fly.toml` no `apps/server/`.

---

## Checklist final do `.env.local`

Quando todos os passos acima estiverem feitos, esse é o estado esperado:

```bash
# Supabase (dev)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# WhatsApp Cloud API
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=

# IA
GEMINI_API_KEY=
OPENAI_API_KEY=
LLM_PROVIDER=gemini
LLM_PROMPT_VERSION=v1

# Caps default
AI_CAP_TRANSCRIPTION_SECONDS=600
AI_CAP_LLM_TOKENS=50000
AI_CAP_COST_CENTS=200

# Sentry (pode ficar vazio no M0)
SENTRY_DSN_MOBILE=
SENTRY_DSN_SERVER=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=fitbrother

# Expo (preencher depois do `eas init`)
EAS_PROJECT_ID=

# Server
LOG_LEVEL=info
PORT=3000
```

**Validação rápida** (depois do M0 task de criar `.env.example`):

```bash
diff <(grep -oE '^[A-Z_]+' .env.local | sort -u) \
     <(grep -oE '^[A-Z_]+' .env.example | sort -u)
# Saída esperada: vazio (todas as keys do example estão no local)
```

---

## Ordem recomendada de execução

Para minimizar tempo morto:

| Passo | Quando | Por quê |
|---|---|---|
| Pre-flight | Hoje | Bloqueia tudo |
| **1. Meta** | Hoje, primeira coisa | Revisão demora |
| 2. Supabase | Hoje | Bloqueia migrations (M1) |
| 3. Gemini | Hoje | Bloqueia M2 |
| 4. OpenAI | Hoje | Bloqueia M2 |
| 5. Sentry | Hoje (DSN-only) | Não bloqueia, mas barato |
| 6. EAS | Pode esperar M0 task | Precisa do projeto Expo existir |
| 7. Cloudflared | Pode esperar M4 | Só usa no webhook |
| 8. Fly.io | Pode esperar M4 | Só usa no deploy staging |

---

## Quando travar

- **Meta pedindo Business Verification logo de cara:** ignore por agora — o test number não exige.
- **Gemini retornando 403:** chave provavelmente restrita por IP/HTTP referrer; tirar restrição de aplicação.
- **Supabase CLI "Cannot connect to Docker":** rodar `sudo systemctl start docker` (Linux) ou abrir Docker Desktop.
- **OpenAI billing exigindo verificação fiscal BR:** usar cartão internacional; se persistir, conta em USD via Wise/Nubank Global.
- **`whatsapp-cloud-api` retornando "Token has expired":** trocar pelo System User token (passo 1.4); o temporário do API Setup só dura 24h.

---

## Onde cada credencial vive (estrutura de arquivos)

O walkthrough acima coleta tudo num scratch enquanto você cria as contas. No repo, porém, as credenciais ficam **distribuídas por app** (nenhum `.env*` é commitado — só os `*.example`):

```
fitbrother/
├── .env                       ← Dev tooling (Trello MCP, Sentry CLI). Carregado por direnv (.envrc).
├── apps/server/.env           ← Server Fastify: Supabase, WhatsApp, IA, caps, Sentry DSN.
└── apps/mobile/.env.local      ← Mobile Expo: EXPO_PUBLIC_* (anon key, API base, Sentry DSN), EAS_PROJECT_ID.
```

| Arquivo | Carregado por | Contém |
|---|---|---|
| `/.env` | `direnv` (via `.envrc`) | `TRELLO_*`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` — só tooling, nenhum segredo de runtime da app. |
| `apps/server/.env` | Node `--env-file` + `envalid` (`src/lib/env.ts`) | `SUPABASE_*` (inclui `SERVICE_ROLE`), `WHATSAPP_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `LLM_*`, `AI_CAP_*`, `SENTRY_DSN`. |
| `apps/mobile/.env.local` | Expo CLI (bundling) | `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `EAS_PROJECT_ID`. |

> ⚠️ **Tudo com prefixo `EXPO_PUBLIC_*` é embarcado no bundle** — público por definição. Nunca coloque `SERVICE_ROLE` ou app secrets ali; a proteção do cliente é via RLS no banco.

**Novo dev:** clonar → `cp` cada `.env.example` para o arquivo real correspondente → preencher → `supabase start` → `npm run dev`.

## Segurança: regras de ouro

**✅ Faça:** commitar só os `*.example`; `.env*` no `.gitignore`; validar tudo com `envalid`; rotacionar chaves periodicamente; usar gerenciador de secrets (1Password/Bitwarden).

**❌ Não faça:** commitar credenciais reais; logar API keys (Sentry/pino nunca devem conter secrets); expor `SUPABASE_SERVICE_ROLE_KEY` ao cliente; copiar credenciais em scripts (sempre via env var).

**Chave expirou?** Gere uma nova no dashboard → atualize o `.env` correspondente → reinicie → delete a velha (evita reuso acidental).

---

*Última revisão: 2026-06-12. Atualize esta lista quando provisionar prod (M6) ou trocar provider. (Consolidado: o antigo `CREDENTIALS.md` foi mesclado aqui.)*
