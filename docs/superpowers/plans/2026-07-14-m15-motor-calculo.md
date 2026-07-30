# M15 — Motor de Cálculo + Gates de Segurança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a fórmula fixa de metas nutricionais (hoje 100% SQL, sem gates de segurança) por `computeTargets`/`evaluateSafetyGates` — TS puro, testado, com clamps de segurança e gates clínicos — e religar o onboarding pra usá-los antes de persistir.

**Architecture:** Módulo puro em `packages/shared/src/targets/` (sem I/O), consumido pelo backend Fastify (`apps/server/src/services/targets.ts`) que chama o módulo **antes** de invocar a RPC `complete_onboarding` — a RPC deixa de calcular, só persiste os valores prontos recebidos em `payload.targets`. O trigger SQL `calculate_bmr_tdee` (que hoje calcula BMR/TDEE em todo INSERT em `anthropometrics`) é removido — nenhum outro código insere nessa tabela hoje.

**Tech Stack:** TypeScript, Vitest (novo, só em `packages/shared`), Fastify, Supabase/Postgres (migrations SQL puras).

## Global Constraints

- Todas as fórmulas, clamps e limiares vêm de [`docs/superpowers/specs/2026-07-14-m15-motor-calculo-design.md`](../specs/2026-07-14-m15-motor-calculo-design.md) — não reinterpretar, os números já foram validados manualmente contra os 5 casos de teste obrigatórios do spec original.
- Nomenclatura `snake_case` nas chaves dos tipos (`bmr_kcal`, `tdee_source`...), não camelCase.
- `computeTargets` nunca lança exceção — sempre retorna um `Targets` válido.
- Arredondamento (`round2`, 2 casas decimais) só na montagem final do `Targets` — cálculos intermediários usam precisão total (ponto flutuante), nunca arredondam em cascata.
- Gate de IMC (`<=18.5`) compara o IMC **arredondado pra 1 casa decimal**, não o valor bruto (ver justificativa no spec, §3 — corrigido durante a escrita deste plano).
- ESLint roda com `--max-warnings 0` — sem `any`, sem `console.log`, sem vars não usadas.
- `OnboardingPayloadSchema`/rota não ganham campos novos nesta fatia (peso-alvo, ritmo, condições de saúde ficam opcionais só dentro do módulo TS, vindas de `undefined` até o M16).

---

### Task 1: Tipos do domínio (`types.ts`)

**Files:**
- Create: `packages/shared/src/targets/types.ts`

**Interfaces:**
- Produces: `Sex`, `ActivityLevel`, `Goal`, `TargetsInput`, `WarningCode`, `Warning`, `Targets`, `GateSeverity`, `GateResult` — usados por todas as tasks seguintes.

- [ ] **Step 1: Criar o arquivo de tipos**

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

export type GateResult = {
  condition: string;
  severity: GateSeverity;
  message: string;
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace packages/shared`
Expected: sem erros (arquivo só tem tipos, nada consome ainda).

- [ ] **Step 3: Lint**

Run: `npx eslint packages/shared/src/targets/types.ts --max-warnings 0`
Expected: sem erros nem warnings.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/targets/types.ts
git commit -m "feat(shared): tipos do motor de metas (M15)"
```

---

### Task 2: Vitest + `formulas.ts` (TMB, GET, conversões, fibra)

**Files:**
- Modify: `packages/shared/package.json` (adiciona `vitest` + script `test`)
- Modify: `package.json` (raiz — adiciona script `test`)
- Create: `packages/shared/src/targets/formulas.ts`
- Create: `packages/shared/src/targets/formulas.test.ts`

**Interfaces:**
- Consumes: `Sex`, `ActivityLevel` (Task 1).
- Produces: `calculateBmr(input): number`, `calculateTdee(bmr_kcal, activity_level): number`, `rateToDeficitKcalPerDay(rate_kg_per_week): number`, `deficitKcalPerDayToRateKgPerWeek(deficit_kcal_per_day): number`, `percentOfWeightPerWeekToRateKgPerWeek(pct, weight_kg): number`, `fiberTargetG(kcal): number`. Todas retornam precisão total (sem arredondar) — consumidas por `compute-targets.ts` (Task 4).

- [ ] **Step 1: Instalar o Vitest em `packages/shared`**

```bash
npm install --workspace packages/shared --save-dev vitest@^4.1.10
```

- [ ] **Step 2: Adicionar o script `test` em `packages/shared/package.json`**

Em `packages/shared/package.json`, dentro de `"scripts"`, adicione (mantendo `build`/`typecheck` como estão):

```json
"test": "vitest run",
```

- [ ] **Step 3: Adicionar o script `test` na raiz**

Em `package.json` (raiz), dentro de `"scripts"`, adicione uma linha nova (mesmo padrão do `"typecheck"` já existente):

```json
"test": "npm run test --workspaces --if-present",
```

- [ ] **Step 4: Escrever os testes de `formulas.ts` (devem falhar — o módulo ainda não existe)**

Crie `packages/shared/src/targets/formulas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  calculateBmr,
  calculateTdee,
  deficitKcalPerDayToRateKgPerWeek,
  fiberTargetG,
  percentOfWeightPerWeekToRateKgPerWeek,
  rateToDeficitKcalPerDay,
} from "./formulas.js";

describe("calculateBmr", () => {
  it("calcula TMB pra mulher (Mifflin-St Jeor)", () => {
    const bmr = calculateBmr({ sex: "female", age_years: 32, weight_kg: 78, height_cm: 165 });
    expect(bmr).toBeCloseTo(1490.25, 2);
  });

  it("calcula TMB pra homem", () => {
    const bmr = calculateBmr({ sex: "male", age_years: 25, weight_kg: 60, height_cm: 180 });
    expect(bmr).toBeCloseTo(1605, 2);
  });

  it("usa a constante neutra pra sexo 'other'", () => {
    const bmr = calculateBmr({ sex: "other", age_years: 30, weight_kg: 70, height_cm: 170 });
    // 10*70 + 6.25*170 - 5*30 + (-78) = 700 + 1062.5 - 150 - 78 = 1534.5
    expect(bmr).toBeCloseTo(1534.5, 2);
  });
});

describe("calculateTdee", () => {
  it.each([
    ["sedentary", 1.2],
    ["light", 1.375],
    ["moderate", 1.55],
    ["active", 1.725],
    ["very_active", 1.9],
  ] as const)("aplica o fator de atividade %s", (level, factor) => {
    expect(calculateTdee(1000, level)).toBeCloseTo(1000 * factor, 2);
  });
});

describe("conversão ritmo <-> déficit", () => {
  it("converte ritmo (kg/semana) em déficit diário (kcal)", () => {
    // 0.5 kg/semana * 7700 / 7 = 550
    expect(rateToDeficitKcalPerDay(0.5)).toBeCloseTo(550, 2);
  });

  it("é o inverso exato de deficitKcalPerDayToRateKgPerWeek", () => {
    const rate = 0.5;
    const kcal = rateToDeficitKcalPerDay(rate);
    expect(deficitKcalPerDayToRateKgPerWeek(kcal)).toBeCloseTo(rate, 6);
  });
});

describe("percentOfWeightPerWeekToRateKgPerWeek", () => {
  it("converte percentual do peso em kg/semana absoluto", () => {
    // 1% de 78kg = 0.78 kg/semana
    expect(percentOfWeightPerWeekToRateKgPerWeek(1.0, 78)).toBeCloseTo(0.78, 4);
  });
});

describe("fiberTargetG", () => {
  it("calcula 14g por 1000kcal", () => {
    expect(fiberTargetG(1536.8203125)).toBeCloseTo(21.5155, 3);
  });

  it("respeita o teto de 40g", () => {
    expect(fiberTargetG(4000)).toBe(40);
  });
});
```

- [ ] **Step 5: Rodar os testes e confirmar que falham (módulo não existe)**

Run: `npm run test --workspace packages/shared`
Expected: falha com erro de módulo não encontrado (`Cannot find module './formulas.js'` ou equivalente).

- [ ] **Step 6: Implementar `formulas.ts`**

Crie `packages/shared/src/targets/formulas.ts`:

```ts
import type { ActivityLevel, Sex } from "./types.js";

const SEX_BMR_CONSTANT: Record<Sex, number> = {
  male: 5,
  female: -161,
  other: -78,
};

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KCAL_PER_KG = 7700;
const DAYS_PER_WEEK = 7;

/** TMB (Mifflin-St Jeor). Sem arredondamento — precisão total pra composição posterior. */
export function calculateBmr(input: {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
}): number {
  return (
    10 * input.weight_kg +
    6.25 * input.height_cm -
    5 * input.age_years +
    SEX_BMR_CONSTANT[input.sex]
  );
}

/** GET = TMB x fator de atividade. */
export function calculateTdee(bmr_kcal: number, activity_level: ActivityLevel): number {
  return bmr_kcal * ACTIVITY_FACTOR[activity_level];
}

/** Ritmo absoluto (kg/semana) -> déficit/superávit diário (kcal/dia). */
export function rateToDeficitKcalPerDay(rate_kg_per_week: number): number {
  return (rate_kg_per_week * KCAL_PER_KG) / DAYS_PER_WEEK;
}

/** Inverso: déficit/superávit diário (kcal/dia) -> ritmo absoluto (kg/semana). */
export function deficitKcalPerDayToRateKgPerWeek(deficit_kcal_per_day: number): number {
  return (deficit_kcal_per_day * DAYS_PER_WEEK) / KCAL_PER_KG;
}

/** Percentual do peso corporal por semana (ex. tetos/defaults do spec) -> kg/semana absoluto. */
export function percentOfWeightPerWeekToRateKgPerWeek(pct: number, weight_kg: number): number {
  return (pct / 100) * weight_kg;
}

/** 14g de fibra por 1000kcal, teto de 40g. */
export function fiberTargetG(kcal: number): number {
  return Math.min(40, (14 * kcal) / 1000);
}
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `npm run test --workspace packages/shared`
Expected: todos os testes de `formulas.test.ts` passam.

- [ ] **Step 8: Lint**

Run: `npx eslint packages/shared/src/targets/formulas.ts packages/shared/src/targets/formulas.test.ts --max-warnings 0`
Expected: sem erros nem warnings.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/package.json package.json packages/shared/src/targets/formulas.ts packages/shared/src/targets/formulas.test.ts package-lock.json
git commit -m "test(shared): fórmulas do motor de metas (TMB/GET/ritmo/fibra) + Vitest (M15)"
```

---

### Task 3: `gates.ts` — `evaluateSafetyGates`

**Files:**
- Create: `packages/shared/src/targets/gates.ts`
- Create: `packages/shared/src/targets/gates.test.ts`

**Interfaces:**
- Consumes: `TargetsInput`, `GateResult`, `GateSeverity` (Task 1).
- Produces: `evaluateSafetyGates(input: TargetsInput): GateResult[]`. Consumida por `compute-targets.ts` (Task 4).

- [ ] **Step 1: Escrever os testes (devem falhar)**

Crie `packages/shared/src/targets/gates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateSafetyGates } from "./gates.js";
import type { TargetsInput } from "./types.js";

const BASE: TargetsInput = {
  sex: "female",
  age_years: 30,
  weight_kg: 65,
  height_cm: 165,
  activity_level: "moderate",
  goal: "lose",
};

describe("evaluateSafetyGates", () => {
  it("não dispara nenhum gate pra um perfil comum", () => {
    expect(evaluateSafetyGates(BASE)).toEqual([]);
  });

  it("BLOCK por idade < 18 quando o objetivo implica perda", () => {
    const gates = evaluateSafetyGates({ ...BASE, age_years: 16 });
    expect(gates.some((g) => g.severity === "BLOCK" && g.condition === "age_under_18")).toBe(
      true,
    );
  });

  it("não dispara idade<18 se o objetivo não implica perda", () => {
    const gates = evaluateSafetyGates({ ...BASE, age_years: 16, goal: "maintain" });
    expect(gates.some((g) => g.condition === "age_under_18")).toBe(false);
  });

  it("BLOCK + REFER por gravidez/amamentação", () => {
    const gates = evaluateSafetyGates({ ...BASE, is_pregnant_or_lactating: true });
    expect(gates.some((g) => g.severity === "BLOCK")).toBe(true);
    expect(gates.some((g) => g.severity === "REFER")).toBe(true);
  });

  it("BLOCK por IMC atual <= 18.5 (arredondado), objetivo perda — Caso 2 do spec", () => {
    // 60kg / 1.80m² = 18.5185 -> arredonda pra 18.5 -> dispara
    const gates = evaluateSafetyGates({
      ...BASE,
      sex: "male",
      age_years: 25,
      weight_kg: 60,
      height_cm: 180,
      goal: "lose",
    });
    expect(
      gates.some((g) => g.severity === "BLOCK" && g.condition === "current_bmi_underweight"),
    ).toBe(true);
  });

  it("BLOCK por peso-alvo implicar IMC <= 18.5 — Caso 3 do spec", () => {
    const gates = evaluateSafetyGates({ ...BASE, target_weight_kg: 49.13, height_cm: 170 });
    expect(
      gates.some((g) => g.severity === "BLOCK" && g.condition === "target_weight_underweight"),
    ).toBe(true);
  });

  it("não dispara gate de peso-alvo quando ausente", () => {
    const gates = evaluateSafetyGates(BASE);
    expect(gates.some((g) => g.condition === "target_weight_underweight")).toBe(false);
  });

  it("SOFT_MODE quando triagem de TCA é positiva", () => {
    const gates = evaluateSafetyGates({ ...BASE, tca_screening_positive: true });
    expect(gates.some((g) => g.severity === "SOFT_MODE")).toBe(true);
  });

  it("REFER por doença renal", () => {
    const gates = evaluateSafetyGates({ ...BASE, has_kidney_disease: true });
    expect(gates.some((g) => g.severity === "REFER" && g.condition === "kidney_disease")).toBe(
      true,
    );
  });

  it("REFER por diabetes tipo 1", () => {
    const gates = evaluateSafetyGates({ ...BASE, has_type1_diabetes: true });
    expect(gates.some((g) => g.severity === "REFER" && g.condition === "type1_diabetes")).toBe(
      true,
    );
  });

  it("WARN por uso de GLP-1", () => {
    const gates = evaluateSafetyGates({ ...BASE, uses_glp1: true });
    expect(gates.some((g) => g.severity === "WARN" && g.condition === "glp1_use")).toBe(true);
  });

  it("retorna múltiplos gates simultâneos", () => {
    const gates = evaluateSafetyGates({
      ...BASE,
      has_kidney_disease: true,
      uses_glp1: true,
    });
    expect(gates.length).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace packages/shared`
Expected: falha — `gates.ts` não existe.

- [ ] **Step 3: Implementar `gates.ts`**

Crie `packages/shared/src/targets/gates.ts`:

```ts
import type { GateResult, Goal, TargetsInput } from "./types.js";

const BMI_UNDERWEIGHT_THRESHOLD = 18.5;

/** IMC arredondado pra 1 casa decimal — evita falsos negativos por ponto flutuante
 * (ex. 60kg/1.80m² = 18.5185, que deve contar como "IMC 18.5"). */
function bmiRounded1(weight_kg: number, height_cm: number): number {
  const heightM = height_cm / 100;
  return Math.round((weight_kg / (heightM * heightM)) * 10) / 10;
}

function goalImpliesLoss(goal: Goal): boolean {
  return goal === "lose" || goal === "recomp";
}

export function evaluateSafetyGates(input: TargetsInput): GateResult[] {
  const gates: GateResult[] = [];

  if (input.age_years < 18 && goalImpliesLoss(input.goal)) {
    gates.push({
      condition: "age_under_18",
      severity: "BLOCK",
      message: "Menores de 18 anos não recebem déficit calórico.",
    });
  }

  if (input.is_pregnant_or_lactating === true) {
    gates.push({
      condition: "pregnant_or_lactating",
      severity: "BLOCK",
      message: "Gravidez/amamentação: sem déficit calórico.",
    });
    gates.push({
      condition: "pregnant_or_lactating",
      severity: "REFER",
      message: "Encaminhar a acompanhamento profissional (nutricionista/obstetra).",
    });
  }

  const currentBmi = bmiRounded1(input.weight_kg, input.height_cm);
  if (currentBmi <= BMI_UNDERWEIGHT_THRESHOLD && goalImpliesLoss(input.goal)) {
    gates.push({
      condition: "current_bmi_underweight",
      severity: "BLOCK",
      message: `IMC atual (${currentBmi}) já está em ou abaixo de 18,5 — sem déficit calórico.`,
    });
  }

  if (input.target_weight_kg !== undefined) {
    const targetBmi = bmiRounded1(input.target_weight_kg, input.height_cm);
    if (targetBmi <= BMI_UNDERWEIGHT_THRESHOLD) {
      gates.push({
        condition: "target_weight_underweight",
        severity: "BLOCK",
        message: `Peso-alvo implica IMC (${targetBmi}) em ou abaixo de 18,5.`,
      });
    }
  }

  if (input.tca_screening_positive === true) {
    gates.push({
      condition: "tca_screening_positive",
      severity: "SOFT_MODE",
      message: "Triagem de TCA positiva — modo suave ativado.",
    });
  }

  if (input.has_kidney_disease === true) {
    gates.push({
      condition: "kidney_disease",
      severity: "REFER",
      message: "Doença renal — proteína limitada a 0,8 g/kg; encaminhar a acompanhamento médico.",
    });
  }

  if (input.has_type1_diabetes === true) {
    gates.push({
      condition: "type1_diabetes",
      severity: "REFER",
      message: "Diabetes tipo 1 — sem ajuste terapêutico automático; encaminhar a acompanhamento médico.",
    });
  }

  if (input.uses_glp1 === true) {
    gates.push({
      condition: "glp1_use",
      severity: "WARN",
      message: "Uso de GLP-1 — proteína no topo da faixa, atenção a apetite reduzido.",
    });
  }

  return gates;
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npm run test --workspace packages/shared`
Expected: todos os testes de `gates.test.ts` passam.

- [ ] **Step 5: Lint**

Run: `npx eslint packages/shared/src/targets/gates.ts packages/shared/src/targets/gates.test.ts --max-warnings 0`
Expected: sem erros nem warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/targets/gates.ts packages/shared/src/targets/gates.test.ts
git commit -m "test(shared): gates de segurança clínica (M15)"
```

---

### Task 4: `compute-targets.ts` — `computeTargets` (orquestração + os 5 casos obrigatórios)

**Files:**
- Create: `packages/shared/src/targets/compute-targets.ts`
- Create: `packages/shared/src/targets/compute-targets.test.ts`

**Interfaces:**
- Consumes: tudo de `types.ts`, `formulas.ts`, `gates.ts` (Tasks 1–3).
- Produces: `computeTargets(input: TargetsInput): Targets`. Consumida por `apps/server/src/services/targets.ts` (Task 6).

- [ ] **Step 1: Escrever os testes — os 5 casos exatos do spec original + casos extras**

Crie `packages/shared/src/targets/compute-targets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeTargets } from "./compute-targets.js";
import type { TargetsInput } from "./types.js";

describe("computeTargets — Caso 1 (clamp de ritmo + piso de gordura interagindo)", () => {
  const input: TargetsInput = {
    sex: "female",
    age_years: 32,
    weight_kg: 78,
    height_cm: 165,
    activity_level: "light",
    goal: "lose",
    rate_kg_per_week: 0.5,
  };
  const result = computeTargets(input);

  it("TMB ≈ 1490 e GET ≈ 2049", () => {
    expect(result.bmr_kcal).toBeCloseTo(1490.25, 2);
    expect(result.tdee_kcal).toBeCloseTo(2049.09, 2);
  });

  it("déficit clampado em 25% -> kcal ≈ 1536.82", () => {
    expect(result.kcal).toBeCloseTo(1536.82, 2);
    expect(result.warnings.some((w) => w.code === "deficit_clamped")).toBe(true);
    expect(result.warnings.some((w) => w.code === "rate_clamped")).toBe(false);
  });

  it("proteína 1,8 g/kg = 140,4 g", () => {
    expect(result.protein_g).toBeCloseTo(140.4, 2);
  });

  it("gordura: piso de 0,6g/kg vence o percentual", () => {
    expect(result.fat_g).toBeCloseTo(46.8, 2);
  });

  it("carboidrato ≈ 138,51 g", () => {
    expect(result.carbs_g).toBeCloseTo(138.51, 2);
  });

  it("fibra ≈ 21,52 g", () => {
    expect(result.fiber_g).toBeCloseTo(21.52, 2);
  });

  it("ritmo projetado ≈ 0,47 kg/semana", () => {
    expect(result.projected_rate_kg_per_week).toBeCloseTo(0.47, 2);
  });

  it("não está bloqueado", () => {
    expect(result.blocked).toBe(false);
    expect(result.block_reason).toBeNull();
  });
});

describe("computeTargets — Caso 2 (BLOCK por IMC)", () => {
  it("homem com IMC 18,5 pedindo perda -> bloqueado, kcal de manutenção", () => {
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 60,
      height_cm: 180,
      activity_level: "sedentary",
      goal: "lose",
    });

    expect(result.blocked).toBe(true);
    expect(result.block_reason).not.toBeNull();
    expect(result.kcal).toBeCloseTo(result.tdee_kcal, 2);
  });
});

describe("computeTargets — Caso 3 (BLOCK por peso-alvo)", () => {
  it("peso-alvo implicando IMC 17 -> bloqueado, sugere mínimo de IMC 18,5", () => {
    const result = computeTargets({
      sex: "female",
      age_years: 28,
      weight_kg: 65,
      height_cm: 170,
      activity_level: "moderate",
      goal: "lose",
      target_weight_kg: 49.13,
    });

    expect(result.blocked).toBe(true);
    // 18.5 * 1.70² = 53.465 -> arredondado 53.47
    expect(result.block_reason).toContain("53.47");
  });
});

describe("computeTargets — Caso 4 (IMC > 30 usa peso-alvo pra proteína)", () => {
  const commonInput = {
    sex: "male",
    age_years: 40,
    weight_kg: 100,
    height_cm: 170,
    activity_level: "sedentary",
    goal: "lose",
    rate_kg_per_week: 0.5,
  } as const;

  it("com peso-alvo informado, proteína usa o peso-alvo, não o atual", () => {
    const result = computeTargets({ ...commonInput, target_weight_kg: 80 });
    expect(result.protein_g).toBeCloseTo(144, 1);
    expect(result.warnings.some((w) => w.code === "protein_on_current_weight_imc_over_30")).toBe(
      false,
    );
  });

  it("sem peso-alvo, cai no peso atual com warning explícito", () => {
    const result = computeTargets(commonInput);
    expect(result.protein_g).toBeCloseTo(180, 1);
    expect(result.warnings.some((w) => w.code === "protein_on_current_weight_imc_over_30")).toBe(
      true,
    );
  });
});

describe("computeTargets — Caso 5 (SOFT_MODE)", () => {
  it("triagem de TCA positiva não impede computeTargets de retornar kcal válido", () => {
    const result = computeTargets({
      sex: "female",
      age_years: 32,
      weight_kg: 78,
      height_cm: 165,
      activity_level: "light",
      goal: "lose",
      rate_kg_per_week: 0.5,
      tca_screening_positive: true,
    });

    // Esconder o número da UI é responsabilidade de quem consome (M16/M18) —
    // computeTargets sempre calcula, nunca retorna kcal nulo/undefined.
    expect(typeof result.kcal).toBe("number");
    expect(result.kcal).toBeGreaterThan(0);
  });
});

describe("computeTargets — direção ganho", () => {
  it("clampa ritmo de ganho acima do teto (0.5%/semana)", () => {
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "moderate",
      goal: "gain",
      rate_kg_per_week: 1.0, // acima do teto de 0.5% * 80kg = 0.4kg/semana
    });
    expect(result.warnings.some((w) => w.code === "rate_clamped")).toBe(true);
  });

  it("clampa superávit acima de 15% do TDEE", () => {
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "sedentary",
      goal: "gain",
      rate_kg_per_week: 0.3,
    });
    expect(result.warnings.some((w) => w.code === "surplus_clamped")).toBe(true);
  });
});

describe("computeTargets — recomp", () => {
  it("aplica déficit fixo de 5% do TDEE", () => {
    const result = computeTargets({
      sex: "female",
      age_years: 28,
      weight_kg: 60,
      height_cm: 165,
      activity_level: "moderate",
      goal: "recomp",
    });
    expect(result.kcal).toBeCloseTo(result.tdee_kcal * 0.95, 2);
  });
});

describe("computeTargets — carboidrato baixo", () => {
  it("emite very_low_carb quando carboidrato final < 50g", () => {
    const result = computeTargets({
      sex: "female",
      age_years: 45,
      weight_kg: 50,
      height_cm: 150,
      activity_level: "sedentary",
      goal: "lose",
      rate_kg_per_week: 0.5,
      strength_training: true,
    });
    expect(result.warnings.some((w) => w.code === "very_low_carb")).toBe(true);
    expect(result.warnings.some((w) => w.code === "low_carb")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test --workspace packages/shared`
Expected: falha — `compute-targets.ts` não existe.

- [ ] **Step 3: Implementar `compute-targets.ts`**

Crie `packages/shared/src/targets/compute-targets.ts`:

```ts
import {
  calculateBmr,
  calculateTdee,
  deficitKcalPerDayToRateKgPerWeek,
  fiberTargetG,
  percentOfWeightPerWeekToRateKgPerWeek,
  rateToDeficitKcalPerDay,
} from "./formulas.js";
import { evaluateSafetyGates } from "./gates.js";
import type { Goal, Sex, Targets, TargetsInput, Warning } from "./types.js";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function bmi(weight_kg: number, height_cm: number): number {
  const heightM = height_cm / 100;
  return weight_kg / (heightM * heightM);
}

const RATE_CAP_PCT: Record<"lose" | "gain", number> = { lose: 1.0, gain: 0.5 };
const RATE_DEFAULT_PCT: Record<"lose" | "gain", number> = { lose: 0.625, gain: 0.375 };
const DEFICIT_CAP_PCT: Record<"lose" | "gain", number> = { lose: 25, gain: 15 };
const HARD_FLOOR_KCAL: Record<Sex, number> = { female: 1200, male: 1500, other: 1350 };

export function computeTargets(input: TargetsInput): Targets {
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(bmr, input.activity_level);
  const gates = evaluateSafetyGates(input);
  const blockingGate = gates.find((g) => g.severity === "BLOCK");

  const warnings: Warning[] = [];
  let effectiveGoal: Goal;
  let kcal: number;

  if (blockingGate) {
    effectiveGoal = "maintain";
    kcal = tdee;
  } else {
    effectiveGoal = input.goal;
    if (effectiveGoal === "maintain") {
      kcal = tdee;
    } else if (effectiveGoal === "recomp") {
      kcal = tdee * 0.95;
    } else {
      const direction = effectiveGoal; // "lose" | "gain"
      const capPct = RATE_CAP_PCT[direction];
      const defaultPct = RATE_DEFAULT_PCT[direction];
      const requestedRate =
        input.rate_kg_per_week ??
        percentOfWeightPerWeekToRateKgPerWeek(defaultPct, input.weight_kg);
      const capRate = percentOfWeightPerWeekToRateKgPerWeek(capPct, input.weight_kg);

      let rate = requestedRate;
      if (rate > capRate) {
        rate = capRate;
        warnings.push({
          code: "rate_clamped",
          message: `Ritmo pedido excede o teto de ${capPct}% do peso/semana — clampado.`,
        });
      }

      let deltaKcal = rateToDeficitKcalPerDay(rate);
      const deltaPct = (deltaKcal / tdee) * 100;
      const deficitCapPct = DEFICIT_CAP_PCT[direction];
      if (deltaPct > deficitCapPct) {
        deltaKcal = (deficitCapPct / 100) * tdee;
        warnings.push({
          code: direction === "lose" ? "deficit_clamped" : "surplus_clamped",
          message: `${direction === "lose" ? "Déficit" : "Superávit"} resultante excede ${deficitCapPct}% do TDEE — clampado.`,
        });
      }

      kcal = direction === "lose" ? tdee - deltaKcal : tdee + deltaKcal;

      if (direction === "lose" && kcal < bmr) {
        kcal = bmr;
        warnings.push({
          code: "below_bmr",
          message: "Meta calórica abaixo da TMB — ajustada para a TMB.",
        });
      }

      const floor = HARD_FLOOR_KCAL[input.sex];
      if (direction === "lose" && kcal < floor) {
        kcal = floor;
        warnings.push({
          code: "hard_floor",
          message: `Meta calórica abaixo do piso absoluto (${floor} kcal) — ajustada.`,
        });
      }
    }
  }

  const currentBmi = bmi(input.weight_kg, input.height_cm);
  const useTargetWeightForProtein = currentBmi > 30 && input.target_weight_kg !== undefined;
  if (currentBmi > 30 && input.target_weight_kg === undefined) {
    warnings.push({
      code: "protein_on_current_weight_imc_over_30",
      message: "IMC acima de 30 sem peso-alvo informado — proteína calculada sobre o peso atual.",
    });
  }
  const weightForProtein = useTargetWeightForProtein
    ? (input.target_weight_kg as number)
    : input.weight_kg;

  const hasKidneyDisease = gates.some((g) => g.condition === "kidney_disease");
  let proteinPerKg: number;
  if (hasKidneyDisease) {
    proteinPerKg = 0.8;
  } else if (effectiveGoal === "lose" || effectiveGoal === "recomp") {
    proteinPerKg = input.strength_training === true ? 2.0 : 1.8;
  } else {
    proteinPerKg = 1.6;
  }
  const protein_g = weightForProtein * proteinPerKg;

  const fatFromPct = (kcal * 0.25) / 9;
  const fatFloor = 0.6 * input.weight_kg;
  const fat_g = Math.max(fatFromPct, fatFloor);

  let carbs_g = (kcal - 4 * protein_g - 9 * fat_g) / 4;
  if (carbs_g < 0) carbs_g = 0;
  if (carbs_g < 50) {
    warnings.push({ code: "very_low_carb", message: "Carboidrato abaixo de 50g/dia." });
  } else if (carbs_g < 100) {
    warnings.push({ code: "low_carb", message: "Carboidrato abaixo de 100g/dia." });
  }

  const fiber_g = fiberTargetG(kcal);

  const actualDeltaKcal = tdee - kcal;
  const projectedRate =
    effectiveGoal === "maintain"
      ? 0
      : deficitKcalPerDayToRateKgPerWeek(Math.abs(actualDeltaKcal)) *
        (actualDeltaKcal >= 0 ? 1 : -1);

  let blockReason: string | null = null;
  if (blockingGate) {
    if (blockingGate.condition === "target_weight_underweight" && input.target_weight_kg) {
      const minWeight = round2(18.5 * (input.height_cm / 100) ** 2);
      blockReason = `Peso-alvo implica um IMC abaixo do saudável (mínimo recomendado: ${minWeight} kg para sua altura). Sugerimos manutenção ou ganho de peso.`;
    } else {
      blockReason = `${blockingGate.message} Metas ajustadas para manutenção.`;
    }
  }

  return {
    kcal: round2(kcal),
    protein_g: round2(protein_g),
    carbs_g: round2(carbs_g),
    fat_g: round2(fat_g),
    fiber_g: round2(fiber_g),
    bmr_kcal: round2(bmr),
    tdee_kcal: round2(tdee),
    tdee_source: "declared",
    projected_rate_kg_per_week: round2(projectedRate),
    warnings,
    blocked: blockingGate !== undefined,
    block_reason: blockReason,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que todos os testes passam**

Run: `npm run test --workspace packages/shared`
Expected: todos os testes de `compute-targets.test.ts` (e os das tasks anteriores) passam.

- [ ] **Step 5: Lint**

Run: `npx eslint packages/shared/src/targets/compute-targets.ts packages/shared/src/targets/compute-targets.test.ts --max-warnings 0`
Expected: sem erros nem warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/targets/compute-targets.ts packages/shared/src/targets/compute-targets.test.ts
git commit -m "feat(shared): computeTargets — motor de metas completo (M15)"
```

---

### Task 5: Barrel + export no índice do pacote

**Files:**
- Create: `packages/shared/src/targets/index.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: tudo de Tasks 1–4.
- Produces: `@fitbrother/shared` passa a exportar `computeTargets`, `evaluateSafetyGates`, e todos os tipos de `targets/types.ts`. Consumido por `apps/server/src/services/targets.ts` (Task 6).

- [ ] **Step 1: Criar o barrel**

Crie `packages/shared/src/targets/index.ts`:

```ts
export * from "./types.js";
export * from "./formulas.js";
export * from "./gates.js";
export * from "./compute-targets.js";
```

- [ ] **Step 2: Exportar pelo índice do pacote**

Em `packages/shared/src/index.ts`, adicione a linha (mantendo as existentes):

```ts
export * from "./targets/index.js";
```

O arquivo completo deve ficar:

```ts
export * from "./schemas.js";
export * from "./prompt-version.js";
export * from "./copy/goals.js";
export * from "./targets/index.js";
export type { LLMProvider } from "./llm/provider.js";
```

- [ ] **Step 3: Typecheck + testes do pacote inteiro**

Run: `npm run typecheck --workspace packages/shared && npm run test --workspace packages/shared`
Expected: ambos passam.

- [ ] **Step 4: Lint**

Run: `npx eslint packages/shared/src/targets/index.ts packages/shared/src/index.ts --max-warnings 0`
Expected: sem erros nem warnings.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/targets/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): exporta o motor de metas pelo índice do pacote (M15)"
```

---

### Task 6: Migrations — remove trigger, adiciona colunas, reescreve a RPC

**Files:**
- Create: `supabase/migrations/0056_drop_bmr_tdee_trigger.sql`
- Create: `supabase/migrations/0057_nutrition_goals_targets_columns.sql`
- Create: `supabase/migrations/0058_anthropometrics_goal_inputs.sql`
- Create: `supabase/migrations/0059_profiles_soft_mode.sql`
- Create: `supabase/migrations/0060_complete_onboarding_v2.sql`

**Interfaces:**
- Produces: schema atualizado (`nutrition_goals.fiber_g/tdee_source/warnings/blocked`, `anthropometrics.target_weight_kg/rate_kg_per_week`, `profiles.soft_mode`) + RPC `complete_onboarding` que só persiste. Consumido pela Task 7 (rota).

- [ ] **Step 1: Migration — remove o trigger de BMR/TDEE**

Crie `supabase/migrations/0056_drop_bmr_tdee_trigger.sql`:

```sql
-- M15: motor de cálculo migra pra TS puro (packages/shared/src/targets). O
-- trigger anterior computava BMR/TDEE em SQL a cada INSERT em anthropometrics;
-- agora esses valores chegam prontos do backend, computados por computeTargets.
-- Único inserter de anthropometrics hoje é a RPC complete_onboarding
-- (auditado em docs/superpowers/specs/2026-07-14-m15-motor-calculo-design.md).
DROP TRIGGER IF EXISTS anthropometrics_calculate_bmr_tdee ON public.anthropometrics;
DROP FUNCTION IF EXISTS public.calculate_bmr_tdee();
```

- [ ] **Step 2: Migration — colunas novas em `nutrition_goals`**

Crie `supabase/migrations/0057_nutrition_goals_targets_columns.sql`:

```sql
ALTER TABLE public.nutrition_goals
  ADD COLUMN fiber_g numeric(7,2),
  ADD COLUMN tdee_source text NOT NULL DEFAULT 'declared',
  ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN blocked boolean NOT NULL DEFAULT false;
```

- [ ] **Step 3: Migration — colunas novas em `anthropometrics`**

Crie `supabase/migrations/0058_anthropometrics_goal_inputs.sql`:

```sql
-- Nullable: sem UI própria até o M16 (peso-alvo/ritmo).
ALTER TABLE public.anthropometrics
  ADD COLUMN target_weight_kg numeric(5,2),
  ADD COLUMN rate_kg_per_week numeric(4,3);
```

- [ ] **Step 4: Migration — flag `soft_mode` em `profiles`**

Crie `supabase/migrations/0059_profiles_soft_mode.sql`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN soft_mode boolean NOT NULL DEFAULT false;
```

- [ ] **Step 5: Migration — reescreve `complete_onboarding`**

Crie `supabase/migrations/0060_complete_onboarding_v2.sql`:

```sql
-- M15: complete_onboarding deixa de calcular BMR/TDEE/macros — recebe tudo
-- pronto em payload.targets (computado por computeTargets no backend) e só
-- persiste. Mesma assinatura, mesma atomicidade/RLS (SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.complete_onboarding(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  uid               uuid := auth.uid();
  v_birth_date      date  := (payload->>'birth_date')::date;
  v_sex             sex   := (payload->>'sex')::sex;
  v_activity_level  activity_level := (payload->>'activity_level')::activity_level;
  v_goal            goal  := (payload->>'goal')::goal;
  v_weight_kg       numeric := (payload->>'weight_kg')::numeric;
  v_height_cm       numeric := (payload->>'height_cm')::numeric;
  v_policy_version  text  := COALESCE(payload->'consents'->>'policy_version', 'v1.0');
  v_targets         jsonb := payload->'targets';
  v_anthro_id       uuid;
  v_goal_id         uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires authenticated user';
  END IF;

  IF v_targets IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires payload.targets (computed by computeTargets)';
  END IF;

  -- 1. profiles ------------------------------------------------------------
  INSERT INTO public.profiles (
    user_id, full_name, phone_e164, birth_date, sex,
    activity_level, goal, timezone, day_start_hour, locale,
    lgpd_consent_at
  )
  VALUES (
    uid,
    payload->>'full_name',
    NULLIF(payload->>'phone_e164', ''),
    v_birth_date,
    v_sex,
    v_activity_level,
    v_goal,
    payload->>'timezone',
    COALESCE((payload->>'day_start_hour')::smallint, 0),
    COALESCE(payload->>'locale', 'pt-BR'),
    now()
  );

  -- 2. anthropometrics (bmr/tdee chegam prontos de computeTargets;
  --    target_weight_kg/rate_kg_per_week vêm do payload — NULL até o M16) ---
  INSERT INTO public.anthropometrics (
    user_id, weight_kg, height_cm, bmr_kcal, tdee_kcal,
    target_weight_kg, rate_kg_per_week
  )
  VALUES (
    uid,
    v_weight_kg,
    v_height_cm,
    (v_targets->>'bmr_kcal')::numeric,
    (v_targets->>'tdee_kcal')::numeric,
    NULLIF(payload->>'target_weight_kg', '')::numeric,
    NULLIF(payload->>'rate_kg_per_week', '')::numeric
  )
  RETURNING id INTO v_anthro_id;

  -- 3. nutrition_goals (kcal/macros já computados) --------------------------
  INSERT INTO public.nutrition_goals (
    user_id, kcal, protein_g, carbs_g, fat_g, fiber_g,
    tdee_source, warnings, blocked
  )
  VALUES (
    uid,
    (v_targets->>'kcal')::numeric,
    (v_targets->>'protein_g')::numeric,
    (v_targets->>'carbs_g')::numeric,
    (v_targets->>'fat_g')::numeric,
    (v_targets->>'fiber_g')::numeric,
    COALESCE(v_targets->>'tdee_source', 'declared'),
    COALESCE(v_targets->'warnings', '[]'::jsonb),
    COALESCE((v_targets->>'blocked')::boolean, false)
  )
  RETURNING id INTO v_goal_id;

  -- 4. subscriptions (defaults: free / active) ------------------------------
  INSERT INTO public.subscriptions (user_id) VALUES (uid);

  -- 5. consent_log (terms / privacy / ai_processing) ------------------------
  INSERT INTO public.consent_log (user_id, scope, policy_version)
  VALUES
    (uid, 'terms',         v_policy_version),
    (uid, 'privacy',       v_policy_version),
    (uid, 'ai_processing', v_policy_version);

  RETURN jsonb_build_object(
    'user_id',           uid,
    'anthropometric_id', v_anthro_id,
    'nutrition_goal_id', v_goal_id,
    'tdee_kcal',         v_targets->>'tdee_kcal',
    'kcal',              v_targets->>'kcal',
    'protein_g',         v_targets->>'protein_g',
    'carbs_g',           v_targets->>'carbs_g',
    'fat_g',             v_targets->>'fat_g',
    'fiber_g',           v_targets->>'fiber_g',
    'warnings',          v_targets->'warnings',
    'blocked',           v_targets->>'blocked'
  );
END;
$$;
```

- [ ] **Step 6: Aplicar as migrations localmente**

```bash
npm run db:start
npm run db:reset
```

Expected: todas as migrations aplicam sem erro, inclusive as 5 novas (`0056`–`0060`), na sequência depois da `0055`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0056_drop_bmr_tdee_trigger.sql \
        supabase/migrations/0057_nutrition_goals_targets_columns.sql \
        supabase/migrations/0058_anthropometrics_goal_inputs.sql \
        supabase/migrations/0059_profiles_soft_mode.sql \
        supabase/migrations/0060_complete_onboarding_v2.sql
git commit -m "feat(db): remove trigger de BMR/TDEE, RPC de onboarding só persiste (M15)"
```

---

### Task 7: Orquestração no backend (`apps/server`)

**Files:**
- Create: `apps/server/src/services/targets.ts`
- Modify: `apps/server/src/routes/onboarding.ts`

**Interfaces:**
- Consumes: `computeTargets`, `evaluateSafetyGates`, `TargetsInput` de `@fitbrother/shared` (Task 5); `OnboardingPayload` (já existente).
- Produces: `buildTargetsInput(payload: OnboardingPayload): TargetsInput`, reexporta `computeTargets`/`evaluateSafetyGates`. A rota passa a enviar `payload.targets` pra RPC (Task 6).

- [ ] **Step 1: Criar `apps/server/src/services/targets.ts`**

```ts
import type { OnboardingPayload, TargetsInput } from "@fitbrother/shared";
import { computeTargets, evaluateSafetyGates } from "@fitbrother/shared";

export { computeTargets, evaluateSafetyGates };

/** Idade completa em anos, mesma semântica do EXTRACT(YEAR FROM age(...)) do Postgres. */
function ageYearsFromBirthDate(birth_date: string): number {
  const birth = new Date(birth_date);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Deriva o input do motor de cálculo a partir do payload de onboarding hoje —
 * campos ainda sem UI (peso-alvo, ritmo, condições de saúde) ficam undefined. */
export function buildTargetsInput(payload: OnboardingPayload): TargetsInput {
  return {
    sex: payload.sex,
    age_years: ageYearsFromBirthDate(payload.birth_date),
    weight_kg: payload.weight_kg,
    height_cm: payload.height_cm,
    activity_level: payload.activity_level,
    goal: payload.goal,
  };
}
```

- [ ] **Step 2: Modificar a rota `POST /onboarding/complete`**

Substitua o conteúdo de `apps/server/src/routes/onboarding.ts` por:

```ts
import { OnboardingPayloadSchema } from "@fitbrother/shared";
import type { FastifyInstance } from "fastify";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { buildTargetsInput, computeTargets } from "../services/targets.js";

export async function onboardingRoutes(app: FastifyInstance) {
  app.post("/onboarding/complete", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = OnboardingPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_payload",
        issues: parsed.error.issues,
      });
    }

    const targets = computeTargets(buildTargetsInput(parsed.data));

    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase.rpc("complete_onboarding", {
      payload: { ...parsed.data, targets },
    });

    if (error) {
      req.log.error({ err: error }, "onboarding_rpc_failed");
      return reply.code(error.code === "23505" ? 409 : 500).send({ error: error.message });
    }

    return reply.code(201).send(data);
  });
}
```

- [ ] **Step 3: Typecheck do server**

Run: `npm run typecheck --workspace apps/server`
Expected: sem erros.

- [ ] **Step 4: Lint**

Run: `npx eslint apps/server/src/services/targets.ts apps/server/src/routes/onboarding.ts --max-warnings 0`
Expected: sem erros nem warnings.

- [ ] **Step 5: Teste manual end-to-end (smoke)**

Com `npm run db:start` já rodando (Task 6), suba o server e chame a rota real:

```bash
npm run dev:server &
sleep 3
# Precisa de um JWT válido de um usuário de teste — se não tiver um à mão,
# confirme via log do server que a rota carrega sem erro de import/typecheck
# (curl sem token deve retornar 401, não 500):
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/onboarding/complete \
  -H "Content-Type: application/json" -d '{}'
kill %1
```

Expected: `401` (não autenticado) — confirma que a rota inicializa sem erro de import/runtime antes mesmo de chegar na lógica de cálculo. Teste completo com usuário real fica pra verificação manual em device/Postman (fora do escopo automatizável aqui, mesmo padrão de outros milestones do projeto).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/targets.ts apps/server/src/routes/onboarding.ts
git commit -m "feat(server): onboarding calcula metas via computeTargets antes de persistir (M15)"
```

---

### Task 8: Verificação final do monorepo + status no PLAN.md

**Files:**
- Modify: `docs/PLAN.md`

- [ ] **Step 1: Typecheck do monorepo inteiro**

Run: `npm run typecheck`
Expected: `mobile`/`server`/`shared` todos limpos.

- [ ] **Step 2: Lint do monorepo inteiro**

Run: `npm run lint`
Expected: ESLint + `test:legal-copy` + `lint:legal-copy` (M14) todos verdes.

- [ ] **Step 3: Testes do monorepo inteiro**

Run: `npm run test`
Expected: todos os testes de `packages/shared` passam (os 5 casos obrigatórios + `formulas`/`gates`/casos extra).

- [ ] **Step 4: `supabase db reset` limpo (confirma migrations 0000–0060)**

Run: `npm run db:reset`
Expected: todas as migrations aplicam sem erro.

- [ ] **Step 5: Atualizar `docs/PLAN.md` §M15 com o Status**

Adicione, logo após o parágrafo "**Feito quando:**" da seção `## M15 — Motor de cálculo + gates de segurança`:

```markdown
**Status M15 (Motor de cálculo + gates de segurança):** ✅ implementado em
2026-07-14. `packages/shared/src/targets/` (`types.ts`, `formulas.ts`,
`gates.ts`, `compute-targets.ts`) — TS puro, testado com Vitest (novo,
só nesse workspace). Os 5 casos exatos do spec original passam, mais
testes de cada gate/clamp isoladamente (`recomp`, sexo `other`, direção
ganho, `protein_on_current_weight_imc_over_30`, `very_low_carb`).
Durante a escrita do plano, corrigido um erro de limiar de IMC na spec
(comparação precisa ser contra o IMC arredondado pra 1 casa decimal,
não o valor bruto — `60kg/1.80m² = 18.5185` só bloqueia com esse ajuste).
Migrations `0056`–`0060`: remove o trigger `calculate_bmr_tdee` (único
inserter de `anthropometrics` era o onboarding — sem risco hoje),
adiciona colunas em `nutrition_goals`/`anthropometrics`/`profiles`,
reescreve `complete_onboarding` pra só persistir valores prontos.
Backend: `services/targets.ts` (`buildTargetsInput`) chamado pela rota
antes da RPC. Verificação: `npm run typecheck`, `npm run lint` e
`npm run test` passam no monorepo inteiro; `supabase db reset` aplica
0000–0060 sem erro. **Campos novos (peso-alvo, ritmo, condições de
saúde, triagem TCA) ficam só no módulo TS** — sem UI/rota ainda, entram
no M16. **M15 concluído.** Próximo: M16 (máquina de estados do
onboarding + paywall placeholder).
```

- [ ] **Step 6: Commit**

```bash
git add docs/PLAN.md
git commit -m "docs: marca M15 (motor de cálculo + gates) como concluído"
```
