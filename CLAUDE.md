# CLAUDE.md — Fitbrother

App de nutrição com IA. Usuário registra refeições em **linguagem natural** (texto ou áudio, no app ou via WhatsApp); IA transcreve, extrai macros e sincroniza tudo em tempo real. Gamificação estilo Duolingo (streaks, amigos, ranking).

---

## Antes de codar, leia

- **`FEATURES.md`** — produto, schema do banco, fluxos, regras de negócio. Fonte de verdade do backend.
- **`DESIGN_SYSTEM.md`** — tokens visuais, componentes base e do domínio nutricional. Fonte de verdade da UI.
- **`tailwind.config.ts`** — implementação dos tokens de cor/tipo/espaço. Tem que bater com o DESIGN_SYSTEM.

Se este `CLAUDE.md` conflitar com um dos dois acima, **o doc específico vence** — abrir PR para alinhar.

---

## Stack

React Native · Expo · TypeScript · NativeWind v4 · Tailwind v3 · Supabase (Postgres + Auth + Realtime + Storage) · Node.js + Fastify · OpenAI Whisper · Gemini 1.5 Flash *ou* GPT-4o mini · WhatsApp Cloud API · Expo Push · Sentry.

---

## Regras de ouro — UI / React Native

1. **Tipografia: nunca `font-medium`/`font-semibold`/`font-bold`.** Em RN, esses utilitários só trocam `fontWeight` e não carregam a Plus Jakarta Sans no peso certo. Sempre use a família:
   - `font-sans` (400) · `font-sans-medium` (500) · `font-sans-semibold` (600) · `font-sans-bold` (700) · `font-sans-extrabold` (800).
2. **Números → `tabular-nums`.** Todo valor numérico (kcal, gramas, streak, contagem) leva `style={{ fontVariant: ["tabular-nums"] }}`.
3. **Cores via token, nunca hex inline em JSX.** Exceção: SVG/Skia/Reanimated importando de `lib/colors.ts`.
4. **Hit target 44×44 pt** em qualquer Pressable. Use `min-w-[44px] min-h-[44px]` ou `hitSlop`.
5. **`accessibilityLabel` obrigatório** em icon-only buttons; `accessibilityRole` em interativos.
6. **Sombras:** iOS via `style` + Android via `elevation`. Sempre via `Platform.select` (ver `components/Card.tsx`).
7. **Sem dark mode no MVP.** Não use `dark:` em código novo.
8. **Ícones:** `lucide-react-native` apenas. Não usar `@expo/vector-icons` em código novo.
9. **Sem tags HTML** (`<div>`, `<h1>`). Use `View`, `Text`, `Pressable`.

---

## Regras de ouro — Backend / dados

1. **RLS sempre.** Toda tabela com `user_id` recebe a policy padrão `auth.uid() = user_id` (USING + WITH CHECK). Exceções estão documentadas em `FEATURES.md` §3.5.
2. **Webhooks idempotentes.** Inserir em `wa_messages` com `provider_message_id UNIQUE` **antes** de qualquer side-effect. Conflito → 200 OK e encerra.
3. **Cache de IA antes da chamada.** Whisper → lookup em `transcriptions(audio_hash)`. LLM → lookup em `ai_extractions(input_hash + prompt_version)`. Bumpar `LLM_PROMPT_VERSION` invalida o cache.
4. **Cap de IA por usuário/dia.** Checar `ai_usage` antes de chamar Whisper/LLM. Excedido → `AI_QUOTA_EXCEEDED` → cliente cai em entrada manual.
5. **Nunca template pago automaticamente.** WhatsApp outbound só sai se `profiles.wa_window_expires_at > now()`. Fora da janela, cai em push.
6. **Push sempre, WA aditivo.** Notificações sempre tentam push; WA é enviado em paralelo apenas se a janela estiver aberta.
7. **`meals.total_*` é trigger-based, não generated.** Postgres não permite GENERATED referenciar outra tabela.
8. **Boundary do dia nutricional:** `((consumed_at AT TIME ZONE p.timezone) - (p.day_start_hour || ' hours')::interval)::date`. **Não** usar `current_date` ou `now()::date` para agregação por dia.
9. **`goal_hit` é regra fixa (v1):** `kcal BETWEEN goal_kcal*0.9 AND goal_kcal*1.1 AND protein_g >= goal_protein_g*0.85`.
10. **Histórico append-only** em `anthropometrics` e `nutrition_goals`. Nunca UPDATE — sempre INSERT nova versão.
11. **Soft delete** em `meals`/`meal_items` (`deleted_at`). Filtros padrão devem excluir deletados.
12. **`auth.users` é fonte de identidade.** Toda tabela aplicacional FK para `auth.users.id`, não inventar tabela paralela de usuários.
13. **Tipos canônicos:** `uuid` (PK), `timestamptz` (datas), `numeric(8,2)` (macros), enums Postgres para status.

---

## Pipeline de registro via WhatsApp (resumo)

Ordem **obrigatória** (detalhes em `FEATURES.md` §6):

1. Valida assinatura HMAC do webhook.
2. INSERT idempotente em `wa_messages`.
3. Match `profiles.phone_e164` + checa `ai_usage`.
4. Transcrição (com cache).
5. Extração LLM (com cache).
6. Fuzzy match com `foods` (sobrescreve macros se `verified=true`).
7. Persistência transacional `meals` + `meal_items` + `ai_usage`.
8. Realtime entrega update ao app.
9. Resposta ao usuário via WA; `processed_at = now()`.
10. Async: achievements + notificações.

Falha após passo 5? `processed_at` fica NULL e retry job processa de novo — os caches em 4 e 5 evitam pagar IA duas vezes.

---

## Convenções

### Estrutura de pastas (alvo)
```
app/                  # Expo Router screens
components/           # Componentes base (Button, Input, Card, ...)
components/domain/    # Componentes do domínio nutricional (ProgressRing, MealCard, ...)
lib/                  # Utils, clients, colors, motion
lib/supabase.ts       # Client + types
lib/colors.ts         # Mirror JS dos tokens Tailwind (para SVG/Reanimated)
lib/motion.ts         # Constantes de duration/easing
server/               # Backend Fastify (monorepo) — ou repo separado
supabase/migrations/  # SQL versionado
```

### Imports
- Alias `@/` aponta para a raiz do projeto Expo.
- Tipos do Supabase gerados via `supabase gen types typescript --local > lib/database.types.ts`.

### Naming
- Tabelas: `snake_case`, plural (`meals`, `nutrition_goals`).
- Enums Postgres: `snake_case` (`activity_level`, `meal_type`).
- Componentes RN: `PascalCase` (`MealCard.tsx`).
- Hooks: `useCamelCase` (`useDailySummary`).
- Server routes: kebab em path (`/webhooks/whatsapp`).

### Git
- Não commitar `.env*`. `.env.example` fica versionado.
- Migrations imutáveis após merge: nova mudança = nova migration.

---

## Comandos do projeto

> Placeholder — preencher quando `package.json` e `supabase/` existirem.

```bash
# Mobile
npm run dev               # expo start
npm run ios | android
npm run typecheck
npm run lint

# Backend
npm run dev:server        # fastify watch
npm run build:server

# Supabase
supabase start            # banco local
supabase migration new <slug>
supabase db reset         # aplica migrations no local
supabase gen types typescript --local > lib/database.types.ts
```

---

## O que **não** fazer sem perguntar

- Mudar schema em produção sem migration revisada.
- Habilitar envio de template pago do WhatsApp.
- Desativar RLS em qualquer tabela.
- Adicionar dependência pesada (animação, navegação, estado) sem alinhar — preferimos as escolhas já fixadas (`reanimated`, `expo-router`, contexto/Zustand minimal).
- Subir `service_role` key para o cliente.
- Excluir dados de usuário sem passar pelo fluxo de §7.4 (LGPD).

---

*Mantenha este arquivo curto. Detalhes ficam em `FEATURES.md` e `DESIGN_SYSTEM.md`.*
