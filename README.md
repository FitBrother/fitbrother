# Fitbrother

App de nutrição com IA. Você fala ou escreve o que comeu — no app ou no WhatsApp — e a IA transcreve, identifica os alimentos, calcula macros e sincroniza tudo em tempo real. Gamificação estilo Duolingo (streaks, amigos, ranking).

**Diferenciais:** input multi-modal (texto + áudio), sincronização real-time entre canais, leaderboard de amigos.

---

## Stack

React Native · Expo Router · TypeScript · NativeWind v4 · Supabase (Postgres + Auth + Realtime + Storage) · Node.js + Fastify · OpenAI Whisper · Gemini 1.5 Flash · WhatsApp Cloud API · Expo Push · Sentry.

---

## Quick start

```bash
# 1. Clonar e instalar
git clone https://github.com/FitBrother/fitbrother.git
cd fitbrother
npm install

# 2. Configurar contas externas (Supabase, Gemini, OpenAI, Meta, etc.)
# Walkthrough completo: SETUP_ACCOUNTS.md
cp .env.example .env.local
# ...preencher .env.local conforme SETUP_ACCOUNTS.md

# 3. Subir banco local
npm run db:start            # Docker precisa estar rodando

# 4. Em dois terminais separados:
npm run dev:server          # Fastify em :3000
npm run dev:mobile          # Expo Metro + dev menu
```

Pré-requisitos: Node ≥ 20, Docker (para o Postgres local da Supabase), Expo Go ou dev build. A Supabase CLI vem como `devDependency` do monorepo — `npm install` já a instala.

---

## Estrutura do monorepo

```
fitbrother/
├── apps/
│   ├── mobile/        # Expo Router app (React Native)
│   └── server/        # Fastify backend (webhooks, workers)
├── packages/
│   ├── shared/        # zod schemas, LLMProvider, prompt-version
│   └── db-types/      # tipos TypeScript gerados do Postgres
├── supabase/
│   ├── migrations/    # SQL versionado
│   └── seed/          # foods (TACO), achievements
└── docs/              # plano de desenvolvimento M0–M6
```

---

## Documentação

Antes de codar:

- **[CLAUDE.md](./CLAUDE.md)** — regras de ouro de UI e backend; o resumo executável para qualquer contribuição.
- **[FEATURES.md](./FEATURES.md)** — produto, schema do banco, fluxos críticos, pipeline WhatsApp. Fonte de verdade do backend.
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — tokens visuais, componentes base, componentes do domínio nutricional. Fonte de verdade da UI.
- **[SETUP_ACCOUNTS.md](./SETUP_ACCOUNTS.md)** — walkthrough acionável para criar Supabase, Gemini, OpenAI, Meta WhatsApp, Sentry, Expo/EAS.
- **[docs/PLAN.md](./docs/PLAN.md)** — roadmap M0→M6 com critérios de "feito" por milestone.

---

## Status

| Milestone | Escopo | Estado |
|---|---|---|
| M0 | Monorepo, Expo bootstrap, Fastify, Supabase scaffold, CI | ✓ completo |
| M1 | Auth + onboarding 8-step + `profiles`/`anthropometrics`/`nutrition_goals` | em planejamento |
| M2 | Catálogo `foods` (TACO), registro de refeições via IA no app | — |
| M3 | Dashboard realtime, edição, histórico | — |
| M4 | WhatsApp Cloud API end-to-end + verificação de telefone | — |
| M5 | Gamificação: streaks, conquistas, amigos, ranking semanal | — |
| M6 | LGPD (export/delete), observabilidade, builds de produção | — |

---

## Scripts úteis

```bash
npm run dev:mobile          # Expo Metro
npm run dev:server          # Fastify watch
npm run db:start            # supabase start (Postgres local)
npm run db:reset            # aplica migrations no banco local
npm run db:types            # gera packages/db-types/index.ts
npm run typecheck           # tsc --noEmit em todos workspaces
npm run lint                # eslint
npm run format              # prettier
```

---

## Licença

Privado — todos os direitos reservados.
