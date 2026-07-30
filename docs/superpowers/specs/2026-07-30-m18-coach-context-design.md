# M18 — Contexto para IA

Quinta e última fatia da Fase 4 (Motor de Metas & Onboarding Renovado).
Depende de M14–M17, todos concluídos e mergeados em `main`. Fonte:
`docs/PLAN.md` §Fase 4 (M18), `docs/superpowers/specs/2026-07-14-fase-4-onboarding-master-plan-design.md`
§9, e o spec original (`docs/superpowers/specs/2026-07-14-onboarding-spec-original.md`,
"FASE 5 — Contexto do feedback da IA").

## Decisões fechadas no brainstorm

- **Cache de extração:** `input_hash` passa a incluir um hash do
  `CoachContext` do usuário. Preserva o cache pro caso mais comum (o mesmo
  usuário repetindo a mesma refeição); deixa de compartilhar hits entre
  usuários diferentes com contextos diferentes — aceito, já que texto
  idêntico entre usuários distintos é raro na prática.
- **`training_days_per_week`:** ganha uma coluna nova em `anthropometrics`
  (nullable) e passa a ser enviado pelo onboarding — hoje fica só no estado
  local do M16, sem consumidor até aqui.
- **Escopo:** injeção de contexto cobre os 3 caminhos de extração que já
  geram `feedback` (texto, áudio — ambos via `extraction.ts` — e foto, via
  `photo-extraction.ts`), e os insights de período (`insights.ts`). Não
  cobre nenhum caminho novo de IA.

## 1. `buildCoachContext` (puro, `packages/shared`)

`packages/shared/src/coach/types.ts` + `build-coach-context.ts` (espelha a
estrutura de `packages/shared/src/targets/`).

```ts
export type CoachContext = {
  objetivo: Goal; // "lose" | "maintain" | "gain" | "recomp"
  metas?: { kcal: number; prot: number; carb: number; gord: number };
  restricoes: string[];
  odeia?: string;
  barreira_principal?: string;
  come_fora?: string;
  treino?: { dias_semana: number; forca: boolean };
  modo_suave: boolean;
  consumido_hoje?: { kcal: number; prot: number; carb: number; gord: number };
};

export type CoachContextInput = {
  goal: Goal;
  soft_mode: boolean;
  current_goals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  onboarding_context: Record<string, unknown>; // jsonb cru de profiles.onboarding_context
  training_days_per_week: number | null;
  strength_training: boolean | null;
  today_consumption: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
};

export function buildCoachContext(input: CoachContextInput): CoachContext;
export function coachContextToneInstruction(ctx: CoachContext): string;
```

Regras de `buildCoachContext`:

- `restricoes`: `onboarding_context.dietary_restrictions` (array), filtrando
  fora o literal `"Nenhuma"` (é uma opção de "nenhuma restrição" no
  `DietBlock` do M16, não uma restrição de verdade).
- `odeia`: `onboarding_context.disliked_foods` (string livre) — ausente se
  vazio.
- `barreira_principal`: primeiro item de `onboarding_context.main_barriers`
  (array, até 3 no `BarriersBlock` do M16) — ausente se array vazio.
- `come_fora`: `onboarding_context.eats_out_frequency` direto.
- `treino`: presente só se `training_days_per_week` OU `strength_training`
  não forem `null`; `dias_semana` default 0, `forca` default `false`
  quando só um dos dois estiver preenchido.
- `modo_suave = soft_mode`. Se `true`: `metas` e `consumido_hoje` **não são
  incluídos no objeto** (chave ausente, não `undefined` serializado —
  `JSON.stringify` de uma chave `undefined` já a omite em JS, então basta
  não atribuir a chave).
- Se `soft_mode = false` e `current_goals`/`today_consumption` existirem,
  populam `metas`/`consumido_hoje` normalmente.

`coachContextToneInstruction(ctx)` — tabela de barreira → instrução de tom,
copiada do spec original + a barreira nova do M16:

| `barreira_principal` (valor exato do `BarriersBlock`) | Instrução |
|---|---|
| `"Falta de tempo"` | sugestões executáveis em <10 min |
| `"Fins de semana"` | antecipar, dar folga planejada, não punir retroativamente |
| `"Ansiedade / comer emocional"` | nunca moralizar comida; sem "bom/ruim" |
| `"Desisto rápido"` | reforçar consistência acima de precisão |
| `"Não sei o que comer"` | sempre terminar com uma sugestão concreta |
| `"Comer fora com frequência"` | sugerir versões mais equilibradas de pratos comuns em restaurante/delivery, nunca como proibição de comer fora |
| ausente / não reconhecida | string vazia — sem instrução extra |

## 2. `loadCoachContext` (`apps/server/src/services/coach-context.ts`)

```ts
export async function loadCoachContext(
  client: SupabaseClient,
  userId: string,
): Promise<CoachContext>;
```

Queries (mesmo padrão de `apps/server/src/routes/me.ts`):

1. `profiles`: `goal`, `soft_mode`, `onboarding_context` — `.eq("user_id", userId).maybeSingle()`.
2. `anthropometrics`: `training_days_per_week`, `strength_training`, mais
   recente (`order by measured_at desc limit 1`).
3. `nutrition_goals`: vigente (`effective_to is null`).
4. Dia de hoje via RPC `fitbrother_today(userId)`, depois
   `daily_summaries` filtrado por `user_id` + `day` (não usa
   `vw_today_summary` — essa view depende de `auth.uid()` via
   `security_invoker`, e `insights.ts` chama isso com o client de
   `service_role`, sem sessão de usuário; filtrar direto por `user_id`
   funciona nos dois contextos).

Monta `CoachContextInput` a partir dessas 4 queries e chama
`buildCoachContext`. Falha de qualquer query não bloqueia o fluxo principal
(extração/insight) — se `loadCoachContext` lançar, o caller loga e segue
sem contexto (equivalente a `CoachContext` vazio: `objetivo` teria que ter
um valor, então o fallback nesse caso é pular a personalização inteira
naquela chamada, mantendo o comportamento anterior ao M18 — nunca quebrar
o registro de uma refeição por causa de personalização).

## 3. Migration: `training_days_per_week`

Nova migration (próximo número livre), nullable, mesmo padrão do M16:

```sql
ALTER TABLE public.anthropometrics
  ADD COLUMN training_days_per_week smallint;
```

`OnboardingPayloadSchema` (`packages/shared/src/schemas.ts`) ganha
`training_days_per_week: z.number().int().min(0).max(7).optional()`.
`complete_onboarding_impl` (nova migration `CREATE OR REPLACE`, v4) grava
esse campo no `INSERT` de `anthropometrics`, junto aos demais.

`apps/mobile`: `TrainingBlock.tsx` já grava `training_days_per_week` no
`onboardingStore` (M16) — só falta incluí-lo em `toPayload()` (hoje
propositalmente omitido, comentado como "não é lido lá"). Passa a ser
enviado.

## 4. Cache de extração — hash com contexto

`apps/server/src/services/extraction.ts`:

```ts
function hashInput(text: string, locale: string, contextHash: string): string {
  return createHash("sha256")
    .update(`${text}\x00${env.LLM_PROMPT_VERSION}\x00${locale}\x00${contextHash}`)
    .digest("hex");
}

function hashContext(ctx: CoachContext): string {
  return createHash("sha256").update(JSON.stringify(ctx)).digest("hex");
}
```

`extractMeal` passa a chamar `loadCoachContext(userClient, userId)`
internamente antes do lookup de cache (mesmo client/userId que já recebe),
computa `contextHash` via `hashContext`, usa no `hashInput`, e repassa
`CoachContext` pro provider. `hashContext` é exportado de `extraction.ts`;
`photo-extraction.ts` importa só essa função (seu hash é sobre bytes de
imagem, não texto — mantém sua própria construção de hash, só acrescenta
`hashContext(context)` como mais um componente hasheado, igual à mudança em
`extraction.ts`).

Nenhum bump de `LLM_PROMPT_VERSION` é necessário — a mudança na *forma* do
hash (novo componente `contextHash`) já torna toda entrada antiga
inatingível por requests novos, o mesmo efeito prático de um bump de
versão.

## 5. `LLMProvider` — assinatura ganha contexto

`packages/shared/src/llm/provider.ts`:

```ts
extractMeal(input: { text: string; locale: string; context: CoachContext }): Promise<...>;
generateInsight(input: { periodType: ...; locale: string; data: unknown; context: CoachContext }): Promise<...>;
```

`gemini.ts`:
- `SYSTEM_PROMPT` (extração) ganha uma frase final: *"Ajuste o tom do
  campo feedback ao contexto do usuário fornecido, sem nunca mencionar
  números que não estejam em 'metas'/'consumido_hoje' quando eles não
  vierem no contexto."*
- `extractFromGeminiContent`/`geminiProvider.extractMeal` passam a receber
  `context` e montam o conteúdo enviado como:
  `Contexto do usuário (JSON): ${JSON.stringify(context)}\n${toneInstruction}\n\nLocale: ${locale}\n\nRefeição: ${text}`
  (a instrução de tom vem de `coachContextToneInstruction(context)`).
- `extractMealImageWithGemini` ganha o mesmo tratamento (mesmo texto
  precede a imagem).
- `INSIGHT_SYSTEM_PROMPT` ganha a mesma frase final sobre ajustar tom ao
  contexto.
- `generateInsightWithGemini` inclui `Contexto do usuário (JSON): ${...}`
  no conteúdo enviado, junto ao payload agregado já existente.

## 6. Insights — carregar contexto por usuário

`apps/server/src/services/insights.ts`: dentro do loop de `targets`,
`loadCoachContext(supabaseService(), t.user_id)` (o client de service-role
já existe na função, `svc`) antes de chamar `getLlmProvider().generateInsight`.

`INSIGHT_PROMPT_VERSION` (`packages/shared/src/prompt-version.ts`) sobe de
`"v1"` para `"v2"` — é o mecanismo já existente pra forçar regeneração de
todo `ai_insights` quando o prompt muda, e o prompt está mudando
(contexto novo entra no conteúdo enviado ao Gemini).

## 7. Testes

- `packages/shared/src/coach/build-coach-context.test.ts` (Vitest, mesmo
  padrão de `targets/*.test.ts`): omissão de `metas`/`consumido_hoje` sob
  `soft_mode`; filtragem de `"Nenhuma"` em restrições; `barreira_principal`
  ausente quando `main_barriers` vazio; `treino` ausente quando os dois
  campos são `null`; as 6 entradas da tabela de tom + o caso "não
  reconhecida".
- `apps/server`: sem Vitest (decisão de longa data do projeto — só
  `packages/shared` tem). Verificação de `hashInput`/`hashContext`:
  smoke test manual (script Node standalone, não faz parte da suíte)
  confirmando que dois contextos diferentes pro mesmo texto produzem
  hashes diferentes.
- Migration `training_days_per_week`: `supabase db reset` + smoke test SQL
  em transação `ROLLBACK` confirmando persistência (mesmo padrão M15/M16).
- **Não verificável nesta fatia sem custo real de API:** se o Gemini de
  fato muda o tom perceptivelmente. Fora do escopo de CI; validação manual
  posterior com uma chamada real (comparar dois perfis sintéticos com
  barreiras diferentes, como o "feito quando" do master plan já previa).

## Feito quando

- `buildCoachContext` cobre os 7 casos de teste do item 7 (todos passando).
- `hashInput` comprovadamente produz hashes diferentes pra contextos
  diferentes com o mesmo texto.
- `supabase db reset` aplica a migration de `training_days_per_week` sem
  erro.
- Typecheck + lint do monorepo inteiro passam.
- `extractMeal`, `extractMealFromPhoto` e `generateInsightsForPeriod`
  chamam `loadCoachContext` e repassam `CoachContext` pro provider — sem
  chamada real de LLM na verificação automatizada.

## Fora de escopo

- Qualquer novo caminho de IA (ex.: chat) — M18 só estende os 2 que já
  existem (extração/feedback de refeição, insights de período).
- Validar qualidade/tom real do output do Gemini — depende de chamada real
  de API, não é parte da verificação desta fatia.
- Corrigir a inconsistência pré-existente entre
  `packages/shared/src/prompt-version.ts`'s `LLM_PROMPT_VERSION` (constante
  não usada, "v2") e `env.LLM_PROMPT_VERSION` (a que de fato é lida, default
  "v1") — achado durante a exploração, não introduzido aqui, não bloqueia
  este milestone.
