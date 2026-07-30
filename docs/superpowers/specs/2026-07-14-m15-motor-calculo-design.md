# M15 — Motor de Cálculo + Gates de Segurança (design)

**Data:** 2026-07-14
**Fase:** 4 (Motor de Metas & Onboarding Renovado). Segunda de cinco: M14 ✅ → **M15** → M16 → M17 → M18.
**Roadmap canônico:** [`docs/PLAN.md`](../../PLAN.md) §Fase 4. Decisões transversais: [`2026-07-14-fase-4-onboarding-master-plan-design.md`](2026-07-14-fase-4-onboarding-master-plan-design.md). Spec original (fonte das fórmulas): [`2026-07-14-onboarding-spec-original.md`](2026-07-14-onboarding-spec-original.md) Fase 2.
**Status:** aprovado para implementação.

---

## 1. Objetivo

Substituir a fórmula fixa de metas nutricionais (hoje 100% SQL, sem gates de segurança) por um motor determinístico em TypeScript puro — `computeTargets` + `evaluateSafetyGates` — que:

1. Calcula TMB/GET/macros com clamps de segurança (déficit/superávit máximo, piso calórico, piso de gordura).
2. Aplica gates de segurança clínica (idade, gravidez, IMC, condições de saúde, triagem de TCA) **antes** de qualquer cálculo de déficit.
3. É testável isoladamente (Vitest, novo neste milestone) com os 5 casos exatos do spec original.

## 2. Escopo (decisões fechadas no brainstorm)

| Tema | Decisão |
|------|---------|
| Dono do TMB/GET | **TS assume tudo** — `computeTargets` calcula TMB/GET internamente (fiel ao spec original, cujos casos de teste verificam TMB/GET como parte da saída). |
| Trigger SQL `calculate_bmr_tdee` | **Removido** nesta fatia (migration). Único código que insere em `anthropometrics` hoje é o onboarding — confirmado por auditoria (`apps/server/src/routes/me.ts` e `account.ts` só leem/exportam, nunca inserem). Sem risco de regressão hoje; qualquer fluxo futuro de "atualizar peso" (M10+) terá que chamar o módulo TS, não inserir direto. |
| Peso-alvo/ritmo/condições de saúde/triagem TCA | **Só no módulo TS nesta fatia.** Entram como campos opcionais em `TargetsInput`, sem gate disparando quando ausentes. `OnboardingPayloadSchema`/rota/RPC **não mudam** — continuam recebendo só os campos que já existem hoje. M16 estende o contrato quando as telas novas existirem. |
| Orquestração backend | **RPC `complete_onboarding` fica, mas emagrece.** A rota Fastify chama `evaluateSafetyGates` → `computeTargets` (TS, antes de qualquer INSERT) e passa os valores já prontos como parâmetros da RPC, que só persiste. Mantém atomicidade de transação única e RLS via `auth.uid()` — sem introduzir gerenciamento de transação raw no Node (essa mudança maior fica de fora, ver §8). |
| Test runner | **Vitest**, devDependency só de `packages/shared` (não na raiz) — é onde o código testado mora. Raiz ganha `"test": "npm run test --workspaces --if-present"`, mesmo padrão do `"typecheck"` já existente. `node:test` do M14 continua onde está (scripts/), não migra. |
| Nomenclatura dos tipos | `snake_case` nas chaves (`bmr_kcal`, `tdee_source`, `block_reason`...), não o camelCase do spec original — consistente com o resto do projeto (`OnboardingPayloadSchema`, colunas do banco). |

## 3. Decisões de interpretação explícitas

O spec original deixa alguns números como faixa ("1,6–2,2 g/kg", "Recomendado no default: 0,5–0,75%") ou omite casos (objetivo `recomp`, sexo `other`, direção "ganho" de alguns clamps). Uma função determinística precisa de um ponto exato — as escolhas abaixo são explícitas e revisáveis, não acidentes de implementação:

- **Proteína:** 1,8 g/kg em déficit sem `strength_training` (bate com o Caso 1 do spec: 78kg × 1,8 = 140g); 2,0 g/kg em déficit **com** `strength_training=true` (ponto baixo da faixa 2,0–2,2, não testado pelos 5 casos); 1,6 g/kg em manutenção/ganho (herda o valor já usado hoje na fórmula SQL, faixa "1,6–1,8 caso contrário").
- **Ritmo default (quando `rate_kg_per_week` ausente):** 0,625%/semana pra `lose` (ponto médio de "0,5–0,75%"); 0,375%/semana pra `gain` (ponto médio de "0,25–0,5%"). Só é exercitado quando não há input de ritmo — hoje é o caso comum, já que a UI atual não pergunta isso (chega no M16).
- **`recomp`:** não coberto pelo spec original (só fala em perda/ganho/manutenção). Mantém o comportamento já existente no projeto (déficit fixo de 5%, sem depender de `rate_kg_per_week`; proteína tratada como "déficit" — 1,8 ou 2,0 g/kg conforme `strength_training`).
- **Clamps na direção "ganho":** o spec só define teto de ritmo (1,0%/semana) e de déficit (25%) pro lado de perda. Pro lado de ganho, uso os próprios limites da faixa como teto: ritmo > 0,5%/semana → clamp com warning `rate_clamped`; superávit > 15% → clamp com warning novo `surplus_clamped` (extensão simétrica, não estava na lista original de warnings).
- **Sexo `other` no piso calórico:** o spec só define piso 1200 kcal (F) / 1500 kcal (M). Uso 1350 kcal (ponto médio), mesma convenção já usada pra constante de TMB de `other` (`-78`, médio entre `+5` e `-161`).
- **IMC no limiar de 18,5 (gates BLOCK):** o Caso 2 do spec ("Homem, 25 anos, 180cm, 60kg — IMC 18,5 → blocked") calcula, com os números exatos dados, IMC ≈ 18,52 — ligeiramente **acima** de 18,5. Pra esse caso bloquear como o spec pede, o gate usa `<= 18.5` (inclusive), não `< 18.5` como a prosa sugere. Documentando aqui porque prosa e caso de teste divergem; o caso de teste é a fonte mais concreta.
- **Proteína com IMC > 30 sem `target_weight_kg`:** o spec manda usar peso-alvo em vez do atual, mas isso só existe a partir do M16. Quando ausente, calcula sobre o peso atual mesmo e adiciona `warning: protein_on_current_weight_imc_over_30` — degrada de forma honesta em vez de fingir que seguiu a regra.
- **SOFT_MODE e `computeTargets`:** "nenhuma kcal em nenhum retorno" (Caso 5) é responsabilidade de UI (M16) e do `buildCoachContext` (M18), não do motor de cálculo — `computeTargets` sempre retorna um `kcal` numérico válido (precisa dele internamente, ex. futura comparação com `goal_hit`), mesmo quando `SOFT_MODE` está ativo. O M15 garante que `evaluateSafetyGates` sinaliza `SOFT_MODE` corretamente; esconder o número da UI é tarefa de quem consome (fora do escopo do M15).

## 4. Arquitetura

### 4.1 Módulo `packages/shared/src/targets/`

```
targets/
├── types.ts             # TargetsInput, Targets, GateResult, Warning, enums
├── formulas.ts           # TMB, GET, conversão ritmo↔déficit, piso de fibra
├── gates.ts               # evaluateSafetyGates
├── compute-targets.ts     # computeTargets (orquestra formulas + gates + clamps + macros)
├── index.ts                # reexporta tudo
├── formulas.test.ts
├── gates.test.ts
└── compute-targets.test.ts
```

`packages/shared/src/index.ts` ganha `export * from "./targets/index.js";`.

### 4.2 Tipos (`types.ts`)

```ts
export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain" | "recomp";

export type TargetsInput = {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  // Opcionais — sem UI própria até o M16. Ausentes = gate correspondente não dispara.
  target_weight_kg?: number;
  rate_kg_per_week?: number;
  strength_training?: boolean;
  is_pregnant_or_lactating?: boolean;
  has_kidney_disease?: boolean;
  has_type1_diabetes?: boolean;
  uses_glp1?: boolean;
  tca_screening_positive?: boolean;
};

export type WarningCode =
  | "rate_clamped"
  | "deficit_clamped"
  | "surplus_clamped"
  | "below_bmr"
  | "hard_floor"
  | "low_carb"
  | "very_low_carb"
  | "protein_on_current_weight_imc_over_30";

export type Warning = { code: WarningCode; message: string };

export type Targets = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  bmr_kcal: number;
  tdee_kcal: number;
  tdee_source: "declared";
  projected_rate_kg_per_week: number;
  warnings: Warning[];
  blocked: boolean;
  block_reason: string | null;
};

export type GateSeverity = "BLOCK" | "SOFT_MODE" | "REFER" | "WARN";
export type GateResult = { condition: string; severity: GateSeverity; message: string };
```

### 4.3 `formulas.ts`

- `calculateBmr({ sex, age_years, weight_kg, height_cm }): number` — Mifflin-St Jeor; constante por sexo `male:+5, female:-161, other:-78`.
- `calculateTdee(bmr_kcal, activity_level): number` — × fator (`sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9`).
- `rateToDeficitKcalPerDay(rate_kg_per_week, weight_kg): number` — `rate_kg_per_week * weight_kg * 7700 / 7` (a base é % do peso × 7700 kcal/kg — ver §4.4 pra como `rate_kg_per_week` vs. `rate_pct_per_week` se relacionam).
- `deficitKcalPerDayToRateKgPerWeek(deficit_kcal_per_day, weight_kg): number` — inverso, usado pra `projected_rate_kg_per_week` (sempre recalculado a partir do kcal **final**, depois de clamps — não do ritmo pedido originalmente; ver Caso 1: ritmo pedido 0,5kg/sem, projetado final ≈0,47kg/sem porque o déficit foi clampado).
- `fiberTargetG(kcal): number` — `min(40, 14 * kcal / 1000)`.

### 4.4 `gates.ts` — `evaluateSafetyGates(input: TargetsInput): GateResult[]`

| condição | severidade | verificação |
|---|---|---|
| `age_years < 18` e `goal` implica perda | BLOCK | perda = `goal === 'lose'` ou (`goal === 'recomp'`, que também é déficit) |
| `is_pregnant_or_lactating === true` | BLOCK (déficit) + REFER | |
| IMC atual `<= 18.5` e `goal` implica perda | BLOCK | IMC = `weight_kg / (height_cm/100)²` |
| `target_weight_kg` presente e implica IMC `<= 18.5` | BLOCK | |
| `tca_screening_positive === true` | SOFT_MODE | |
| `has_kidney_disease === true` | REFER (cap proteína 0,8 g/kg) | |
| `has_type1_diabetes === true` | REFER | |
| `uses_glp1 === true` | WARN | |

Retorna todos os gates que disparam (não só o primeiro) — `computeTargets` decide como reagir a cada severidade.

### 4.5 `compute-targets.ts` — `computeTargets(input: TargetsInput): Targets`

1. `bmr = calculateBmr(input)`; `tdee = calculateTdee(bmr, input.activity_level)`.
2. `gates = evaluateSafetyGates(input)`.
3. Se algum gate `BLOCK` disparar para o objetivo pedido: recalcula usando `goal: 'maintain'` internamente (kcal = TDEE), seta `blocked: true` e `block_reason` com o motivo + sugestão (ex.: peso mínimo saudável quando o gate é por peso-alvo).
4. Caso contrário, calcula kcal por objetivo:
   - `maintain`: `kcal = tdee`.
   - `recomp`: `kcal = tdee * 0.95` (déficit fixo 5%).
   - `lose`/`gain`: usa `rate_kg_per_week` (input ou default — ver §3) → `rateToDeficitKcalPerDay` → aplica os 4 clamps em ordem (rate → déficit/superávit% → below_bmr → piso absoluto), cada um push-ando um `Warning` quando dispara.
5. Proteína: `weight_for_protein = (bmi > 30 && target_weight_kg) ? target_weight_kg : weight_kg`; se `bmi > 30 && !target_weight_kg`, adiciona warning `protein_on_current_weight_imc_over_30`. `protein_per_kg` conforme §3. `has_kidney_disease` sobrescreve pra `0.8` (cap do REFER).
6. Gordura: `max(kcal*0.25/9, 0.6 * weight_kg)`; se o piso venceu, sem warning dedicado (o spec não pede um — só "piso vence").
7. Carboidrato: `(kcal - 4*protein_g - 9*fat_g) / 4`, clamp em 0; `< 100` → warning `low_carb`; `< 50` → warning `very_low_carb` (substitui `low_carb`, não emite os dois).
8. Fibra: `fiberTargetG(kcal)`.
9. `projected_rate_kg_per_week`: recalculado do kcal **final** (pós-clamp) via `deficitKcalPerDayToRateKgPerWeek`; `0` se `maintain`.
10. Arredonda todos os valores numéricos pra 2 casas decimais (mesma precisão de `nutrition_goals`/`anthropometrics` no banco, `numeric(7,2)`).

## 5. Orquestração backend

### 5.1 Migrations (a partir de `0056`)

- `0056_drop_bmr_tdee_trigger.sql` — `DROP TRIGGER anthropometrics_calculate_bmr_tdee ON anthropometrics; DROP FUNCTION calculate_bmr_tdee();`. `bmr_kcal`/`tdee_kcal` continuam colunas normais, só passam a ser preenchidas pelo INSERT explícito (vindo do TS) em vez de trigger.
- `0057_nutrition_goals_targets_columns.sql` — `ALTER TABLE nutrition_goals ADD COLUMN fiber_g numeric(7,2), ADD COLUMN tdee_source text NOT NULL DEFAULT 'declared', ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN blocked boolean NOT NULL DEFAULT false;`.
- `0058_anthropometrics_goal_inputs.sql` — `ALTER TABLE anthropometrics ADD COLUMN target_weight_kg numeric(5,2), ADD COLUMN rate_kg_per_week numeric(4,3);` (nullable — sem UI ainda).
- `0059_profiles_soft_mode.sql` — `ALTER TABLE profiles ADD COLUMN soft_mode boolean NOT NULL DEFAULT false;`.
- `0060_complete_onboarding_v2.sql` — reescreve `complete_onboarding(payload jsonb)`: remove o cálculo de `v_kcal_factor`/`v_protein_per_kg`/etc. (o bloco inteiro descrito no comentário do `0008`); passa a ler `payload->'targets'` (objeto já computado: `bmr_kcal, tdee_kcal, tdee_source, kcal, protein_g, carbs_g, fat_g, fiber_g, warnings, blocked, block_reason`) e usar esses valores diretamente nos `INSERT`s de `anthropometrics` e `nutrition_goals`. Mantém a mesma assinatura (`payload jsonb`), só muda o conteúdo esperado — sem quebrar a RLS/SECURITY INVOKER existente.

### 5.2 Backend (`apps/server`)

- Novo `apps/server/src/services/targets.ts`: `buildTargetsInput(payload: OnboardingPayload): TargetsInput` (deriva `age_years` de `birth_date` via `Date`, mapeia os campos existentes; campos novos ficam `undefined` — não vêm do payload atual) + reexporta `computeTargets`/`evaluateSafetyGates` de `@fitbrother/shared`.
- `apps/server/src/routes/onboarding.ts`: depois do `safeParse`, chama `buildTargetsInput` → `computeTargets` → injeta o resultado em `payload.targets` antes de `supabase.rpc("complete_onboarding", { payload: { ...parsed.data, targets } })`.

## 6. Fluxo de dados

```
POST /onboarding/complete
  │ 1. valida OnboardingPayloadSchema (zod) — inalterado
  │ 2. buildTargetsInput(payload) → TargetsInput (age_years derivado de birth_date)
  │ 3. computeTargets(input) → Targets  [TS puro — packages/shared]
  │      └─ evaluateSafetyGates(input) → GateResult[] (consultado internamente)
  │ 4. supabase.rpc("complete_onboarding", { payload: { ...payload, targets } })
  │      └─ SQL só persiste: profiles / anthropometrics (com bmr/tdee/target_weight/rate
  │         vindos prontos) / nutrition_goals (com kcal/macros/warnings/blocked prontos) /
  │         subscriptions / consent_log — mesma transação atômica de sempre
  ▼
201 com o mesmo formato de resposta de hoje (tdee_kcal, kcal, protein_g, carbs_g, fat_g)
+ novos campos (fiber_g, warnings, blocked, block_reason)
```

## 7. Tratamento de erros

- `computeTargets` nunca lança — sempre retorna um `Targets` válido (mesmo bloqueado, com kcal de manutenção). Não há caminho de erro novo na rota por causa do motor de cálculo.
- RPC continua podendo falhar por conflito de `nutrition_goals_active_per_user`/etc. — tratamento de erro da rota (`error.code === "23505" → 409`) não muda.
- Migration `0056` (drop trigger) é irreversível de forma simples via `db reset` normal — não há dado de produção hoje (confirmado na Fase 4), então sem plano de rollback de dados, só o `db reset` padrão do projeto.

## 8. Fora de escopo (M15) / follow-ups

- `OnboardingPayloadSchema`/rota não ganham os campos novos (peso-alvo, ritmo, condições de saúde, triagem TCA) — entra no M16 junto com as telas.
- `SOFT_MODE` não é refletido em nenhuma tela ainda (M16) nem no prompt de IA (M18) — só a flag `profiles.soft_mode` e o gate existem, prontos pra serem ligados.
- Mover a transação inteira do onboarding pra fora da RPC (Abordagem B do brainstorm) — descartado por ora, sem necessidade imediata.
- Fluxo de "atualizar peso" fora do onboarding (recalcular `anthropometrics`/`nutrition_goals` a partir de um novo peso) não existe ainda — quando existir, precisa chamar `computeTargets` também (o trigger que fazia isso "de graça" foi removido).

## 9. Testes

Vitest, `packages/shared/package.json` ganha `"test": "vitest run"` (dev). Cobertura obrigatória:

- **Os 5 casos exatos do spec original** (§Testes obrigatórios em [`2026-07-14-onboarding-spec-original.md`](2026-07-14-onboarding-spec-original.md)), validados numericamente nesta spec em §3 (Caso 1 com precisão de casas decimais).
- `formulas.test.ts`: TMB pros 3 sexos, GET pros 5 níveis de atividade, conversão ritmo↔déficit e sua inversa (round-trip), fibra (incluindo o teto de 40g).
- `gates.test.ts`: cada condição da tabela §4.4 isoladamente (dispara e não-dispara), múltiplos gates simultâneos.
- `compute-targets.test.ts`: os 5 casos + cada clamp isolado (inclusive direção "ganho": `rate_clamped`/`surplus_clamped`) + `recomp` + sexo `other` + `low_carb`/`very_low_carb` + `protein_on_current_weight_imc_over_30`.

## 10. "Feito quando"

Os 5 casos de teste do spec original passam; `complete_onboarding` não calcula mais macro/BMR/TDEE em SQL, só persiste; um perfil com gate `BLOCK` recebe `Targets` de manutenção (não de déficit) com `blocked: true`; `npm run typecheck` e `npm run lint` (com `npm run test --workspace packages/shared` incluído na verificação) passam no monorepo inteiro.

Próximo: **M16 — Máquina de estados do onboarding + paywall placeholder**, spec própria a partir de [`2026-07-14-fase-4-onboarding-master-plan-design.md`](2026-07-14-fase-4-onboarding-master-plan-design.md) §7.
