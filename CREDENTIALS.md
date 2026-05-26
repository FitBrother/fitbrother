# Credenciais — Guia de organização

Este documento explica **onde cada credencial vive**, **como gerar**, e **regras de segurança**.

---

## Estrutura de arquivos

```
fitbrother/
├── .env                       ← Dev tooling (Trello, Sentry CLI)
├── .env.example               ← Template do .env
├── apps/
│   ├── mobile/
│   │   ├── .env.local         ← Mobile app (Supabase, Sentry, EAS)
│   │   └── .env.example       ← Template do mobile
│   └── server/
│       ├── .env               ← Server app (Supabase, WhatsApp, AI, Sentry)
│       └── .env.example       ← Template do servidor
```

**Nenhum arquivo `.env*` é commitado no Git.** Apenas `*.example` aparecem no repositório.

---

## Arquivo 1: `/.env` — Dev tooling

**O quê**: Credenciais de ferramentas de desenvolvimento local (não da aplicação).

**Como é carregado**: Automaticamente pelo `direnv` quando você entra no diretório (`dotenv` está em `/.envrc`).

### Variáveis

#### `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARD_ID`
- **Uso**: Claude Code MCP para gestão de tarefas
- **Como gerar**: https://trello.com/app-key
  1. Clique no botão "Generate Token"
  2. Copie API Key e Token
  3. Na URL do seu board Trello, o ID aparece: `trello.com/b/<BOARD_ID>/...`

#### `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`
- **Uso**: Upload de source maps durante EAS Build (integrado com `@sentry/react-native`)
- **Como gerar**: https://sentry.io/settings/account/api/auth-tokens/
  1. "Create New Token" com scope `project:read`, `org:read`
  2. `SENTRY_ORG` = seu slug da organização (ex: `fitbrother`)

---

## Arquivo 2: `apps/server/.env` — Server app

**O quê**: Todas as credenciais que o servidor Fastify precisa em tempo de execução.

**Como é carregado**: Node.js carrega via `--env-file=.env` (no `package.json`), depois sobrescrito por `dotenv` em `src/lib/env.ts`.

**Quando é validado**: `src/lib/env.ts` usa `envalid` para validar e coagir todos os tipos.

### Variáveis

#### `NODE_ENV`, `PORT`, `LOG_LEVEL`
- **Defaults**: `development`, `3000`, `info`
- **Não tem segredo** — apenas configuração runtime

#### `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Uso**: Conexão ao Supabase (banco de dados, auth, realtime)
- **Local**: `http://127.0.0.1:54321`, chaves locais de `supabase start`
- **Produção**: URL remota e chaves do projeto Supabase remoto
- **Gerar local**: `supabase start` cria um Docker stack com valores pré-gerados
- **Aviso**: `SUPABASE_SERVICE_ROLE_KEY` é sensível — nunca exponha ao cliente

#### `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_PHONE_NUMBER_ID`
- **Uso**: Webhook do WhatsApp Cloud API (Meta) + envio de mensagens
- **Como gerar**: https://www.facebook.com/business
  1. Business Manager → Apps → Seu app → WhatsApp
  2. Configuration → Webhook token (gere um)
  3. WhatsApp → Sender ID → Phone Number ID
  4. Settings → Access Tokens (gere um)
- **Aviso**: Nunca logue esses valores em logs; são sensíveis

#### `OPENAI_API_KEY`, `GEMINI_API_KEY`, `LLM_PROVIDER`, `LLM_PROMPT_VERSION`
- **Uso**: Transcriação (Whisper) e extração de macros (LLM)
- **Como gerar**:
  - OpenAI: https://platform.openai.com/account/api-keys
  - Gemini: https://aistudio.google.com/app/apikey
- **Selecionar**: `LLM_PROVIDER=gemini` ou `openai` determina qual é usado
- **Cache invalidation**: Bump `LLM_PROMPT_VERSION` para invalidar todos os extractions em cache

#### `AI_CAP_TRANSCRIPTION_SECONDS`, `AI_CAP_LLM_TOKENS`, `AI_CAP_COST_CENTS`
- **Uso**: Rate limit de IA por usuário por dia
  - Máx segundos de transcrição / dia
  - Máx tokens do LLM / dia
  - Máx custo em cents / dia
- **Padrão**: 600s, 50k tokens, $2 (200 cents)
- **Sem segredo** — apenas limites de negócio

#### `SENTRY_DSN`
- **Uso**: Error tracking no servidor
- **Como gerar**: Sentry Dashboard → Project Settings → Client Keys (DSN)
- **Formato**: `https://<public_key>@o<org_id>.ingest.us.sentry.io/<project_id>`

---

## Arquivo 3: `apps/mobile/.env.local` — Mobile app

**O quê**: Apenas credenciais que o cliente Expo precisa.

**Como é carregado**: Expo CLI carrega automaticamente em tempo de bundling.

**Importante**: Qualquer `EXPO_PUBLIC_*` é embarcado no bundle do app — nunca inclua credenciais sensíveis sem o prefixo `EXPO_PUBLIC_`.

### Variáveis

#### `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Uso**: Chave de cliente do Supabase (permissões via RLS)
- **Local**: Chave anon do Supabase local (`supabase start`)
- **Produção**: Chave anon do projeto remoto
- **Aviso**: É pública (no bundle); proteja via RLS no banco

#### `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`
- **Uso**: Overrides de host (opcional)
- **Padrão**: Auto-detectado de `Constants.expoConfig.hostUri` (IP LAN do Metro)
- **Quando usar**: Ngrok, staging remoto, outro PC na rede
- **Deixar comentado em `.env.local`** — auto-detection funciona em dev

#### `EXPO_PUBLIC_SENTRY_DSN`
- **Uso**: Error tracking no cliente mobile
- **Como gerar**: Sentry Dashboard → Project Settings → Client Keys (DSN) para React Native
- **Formato**: Mesmo que servidor

#### `EAS_PROJECT_ID`
- **Uso**: Identificar o projeto no EAS Build / EAS Update
- **Como gerar**: `eas init` ou https://expo.dev/projects
- **Quando precisa**: Ao fazer build para staging/prod ou usar EAS Update

---

## Fluxo: local → staging → produção

### Desenvolvimento local (`apps/server/.env` + `apps/mobile/.env.local`)
- Supabase local (`http://127.0.0.1:54321`)
- Chaves locais do Supabase
- WhatsApp test/dev sandbox
- OpenAI / Gemini dev keys (same keys as prod, but dev rates)
- Sentry DSN dev (optional; não obrigatório)

### Staging
- Supabase remoto (staging project)
- WhatsApp staging (sem acesso full, apenas números de teste)
- Chaves de IA iguais (padrão de staging é mesmo backend)
- Sentry DSN staging

### Produção
- Supabase remoto (production project)
- WhatsApp production (access token com permissões full)
- Chaves de IA (poderia ser outro provider/key se necessário)
- Sentry DSN production

**Como atualizar**: Diferentes `.env` files para cada amigo. Tipicamente, CI/CD injeta via secrets.

---

## Segurança: regras de ouro

### ✅ Faça
1. **Comitar `.example` files** — templates são públicos
2. **Ignorar `.env*` files** (`.gitignore` já faz isso)
3. **`.env` da raiz** — somente dev tooling, nenhuma credencial sensível
4. **Validação com `envalid`** — todas as vars são tipadas e têm defaults
5. **Soft-rotate chaves periodicamente** — gere novas, atualize `.env`, delete velhas
6. **Usar direnv** — `.envrc` carrega vars para o shell sem escrevê-las em scripts

### ❌ Não faça
1. **Comitar credenciais reais** — `.env.local`, `.env` com valores vão para `.gitignore`
2. **Logar credentials** — Sentry/logs nunca devem ter API keys
3. **Expor `SUPABASE_SERVICE_ROLE_KEY` ao cliente** — é um secret do servidor
4. **Reescrita manual de `.env` files** — use `.env.example` como template
5. **Copiar credenciais em scripts** — sempre via env vars

---

## Passos para novo desenvolvedor

1. Clonar repo
2. `cp .env.example .env` (só se precisar de dev tooling — Trello, Sentry)
3. `cp apps/server/.env.example apps/server/.env` → preencher com valores
4. `cp apps/mobile/.env.example apps/mobile/.env.local` → preencher com valores
5. `supabase start` (levanta o Docker stack local)
6. `npm run dev` (Expo + Fastify sobem)

---

## Troubleshooting

### "SUPABASE_URL is required"
- Verifique `apps/server/.env` — `SUPABASE_URL` está vazio?
- Se rodando servidor local: `SUPABASE_URL=http://127.0.0.1:54321`
- `supabase start` está rodando?

### "EXPO_PUBLIC_SUPABASE_ANON_KEY is required"
- Verifique `apps/mobile/.env.local`
- Metro bundler lê essa var em tempo de build; reinicie Expo

### "WHATSAPP webhook não recebe mensagens"
- `WHATSAPP_VERIFY_TOKEN` bate com o token no webhook setup (Meta)?
- `WHATSAPP_APP_SECRET` está correto?
- App está verificando HMAC?

### Chave expirou / deixou de funcionar
1. Gere uma nova no dashboard (OpenAI, Gemini, Meta, Sentry)
2. Atualize `.env` local
3. Reinicie o app
4. Delete a chave velha do dashboard (evita reuso acidental)

---

## Recursos

- [Supabase docs](https://supabase.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [Google Gemini API](https://ai.google.dev/)
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Sentry docs](https://docs.sentry.io)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [direnv](https://direnv.net/)
