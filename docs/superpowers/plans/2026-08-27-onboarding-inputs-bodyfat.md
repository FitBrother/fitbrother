# Onboarding: sliders, % de gordura e proteína ajustável — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar `WheelPicker` por um `SliderInput` (slider + input numérico) em altura/peso/peso-alvo/ritmo; redesenhar `GoalBlock` sem "Recomposição" e sem scroll; adicionar uma pergunta obrigatória de % de gordura corporal com seleção ilustrada; trocar a fórmula de proteína pra massa magra; e permitir ajustar a proteína recomendada por slider na tela de revelação de metas.

**Architecture:** Um componente `SliderInput` novo e reutilizável substitui `WheelPicker` em 4 blocos do onboarding. Um novo bloco `BodyFatBlock` entra na Fase A (capítulo 1) e persiste `body_fat_pct`, usado por `computeTargets()` (`@fitbrother/shared`) pra calcular proteína sobre massa magra em vez de peso total — a mesma função roda no preview local (client) e no servidor (`/onboarding/complete`), então um `protein_g_override` opcional flui do slider da tela de revelação até o banco sem duplicar lógica. `recomp` sai do enum Postgres, do tipo `Goal` e do schema zod — o produto ainda não foi lançado, então não há linha de produção com esse valor.

**Tech Stack:** React Native, Expo, TypeScript, NativeWind v4, `@react-native-community/slider` (nova dependência), `react-native-svg` (já existente), Zustand, Zod, Fastify, Supabase/Postgres, Vitest (`packages/shared`), Jest (`apps/mobile`).

## Global Constraints

- Tipografia: `font-sans`/`font-sans-medium`/`font-sans-semibold`/`font-sans-bold` — nunca `font-medium`/`font-bold` puro.
- Números → `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores via token de `@/lib/colors` — nunca hex inline em JSX (exceção: props passadas a `react-native-svg`/Reanimated, que já importam de `lib/colors.ts`).
- Hit target 44×44pt em qualquer `Pressable` (`min-w-[44px] min-h-[44px]` ou `hitSlop`).
- `accessibilityLabel` obrigatório em controles icon-only; `accessibilityRole` em interativos.
- Sem `dark:` em código novo (sem dark mode no MVP).
- Ícones: `lucide-react-native` apenas.
- Sem `<div>`/`<h1>` — `View`/`Text`/`Pressable`.
- RLS já cobre `anthropometrics`/`profiles` (owner_all) — a migration nova não precisa de policy adicional.
- Migrations são imutáveis após merge — a migration desta feature é um arquivo novo, nunca edita as anteriores.

---

## Task 1: Dependência `@react-native-community/slider`

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Instalar via expo install**

Run: `cd apps/mobile && npx expo install @react-native-community/slider`

Isso resolve a versão compatível com o Expo SDK 54 automaticamente e adiciona a entrada em `package.json`.

- [ ] **Step 2: Verificar instalação**

Run: `grep "@react-native-community/slider" apps/mobile/package.json`
Expected: uma linha com o pacote e uma versão (ex. `"@react-native-community/slider": "4.x.x"`).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "chore(mobile): adiciona @react-native-community/slider"
```

---

## Task 2: `TargetsInput`/`Goal` — remove `recomp`, adiciona `body_fat_pct` e `protein_g_override`

**Files:**
- Modify: `packages/shared/src/targets/types.ts`

**Interfaces:**
- Produces: `Goal = "lose" | "maintain" | "gain"`; `TargetsInput.body_fat_pct: number` (obrigatório); `TargetsInput.protein_g_override?: number`.

- [ ] **Step 1: Editar o tipo**

Substituir:
```ts
export type Goal = "lose" | "maintain" | "gain" | "recomp";

export type TargetsInput = {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  // Opcionais — ausentes = gate correspondente não dispara.
  target_weight_kg?: number;
  rate_kg_per_week?: number;
  strength_training?: boolean;
  is_pregnant_or_lactating?: boolean;
  has_kidney_disease?: boolean;
  has_type1_diabetes?: boolean;
  uses_glp1?: boolean;
};
```

Por:
```ts
export type Goal = "lose" | "maintain" | "gain";

export type TargetsInput = {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
  goal: Goal;
  // % de gordura corporal (0-100) — usado pra calcular proteína sobre massa
  // magra em vez de peso total. Sempre coletado no onboarding (obrigatório).
  body_fat_pct: number;
  // Opcionais — ausentes = gate/ajuste correspondente não dispara.
  target_weight_kg?: number;
  rate_kg_per_week?: number;
  // Sobrescreve o protein_g calculado (clampado a 1.2-3.0 g/kg de massa
  // magra dentro de computeTargets) — ajuste manual na tela de revelação.
  protein_g_override?: number;
  strength_training?: boolean;
  is_pregnant_or_lactating?: boolean;
  has_kidney_disease?: boolean;
  has_type1_diabetes?: boolean;
  uses_glp1?: boolean;
};
```

- [ ] **Step 2: Remover o `WarningCode` morto**

Substituir:
```ts
export type WarningCode =
  | "rate_clamped"
  | "deficit_clamped"
  | "surplus_clamped"
  | "below_bmr"
  | "hard_floor"
  | "low_carb"
  | "very_low_carb"
  | "protein_on_current_weight_imc_over_30";
```

Por:
```ts
export type WarningCode =
  | "rate_clamped"
  | "deficit_clamped"
  | "surplus_clamped"
  | "below_bmr"
  | "hard_floor"
  | "low_carb"
  | "very_low_carb";
```

- [ ] **Step 3: Typecheck (vai falhar — esperado, outros arquivos ainda referenciam `recomp`)**

Run: `npm run typecheck --workspace packages/shared`
Expected: FAIL em `gates.ts` e `compute-targets.ts` (comparações com `"recomp"` num tipo que não tem mais esse literal). Confirma que os próximos tasks são necessários — não commitar ainda.

---

## Task 3: `gates.ts` — simplifica `goalImpliesLoss`

**Files:**
- Modify: `packages/shared/src/targets/gates.ts`

- [ ] **Step 1: Editar a função**

Substituir:
```ts
function goalImpliesLoss(goal: Goal): boolean {
  return goal === "lose" || goal === "recomp";
}
```

Por:
```ts
function goalImpliesLoss(goal: Goal): boolean {
  return goal === "lose";
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace packages/shared`
Expected: `gates.ts` limpo agora; ainda falha em `compute-targets.ts` (Task 4 resolve).

- [ ] **Step 3: Commit (junto com Task 2)**

```bash
git add packages/shared/src/targets/types.ts packages/shared/src/targets/gates.ts
git commit -m "feat(shared): remove goal recomp e adiciona body_fat_pct/protein_g_override ao TargetsInput"
```

---

## Task 4: `compute-targets.ts` — remove `recomp`, proteína sobre massa magra, override clampado

**Files:**
- Modify: `packages/shared/src/targets/compute-targets.ts`

**Interfaces:**
- Consumes: `TargetsInput.body_fat_pct: number`, `TargetsInput.protein_g_override?: number` (Task 2).
- Produces: `computeTargets()` mantém a mesma assinatura de retorno (`Targets`); `protein_g` agora reflete massa magra.

- [ ] **Step 1: Remover o branch de `recomp` no cálculo de kcal**

Substituir:
```ts
    effectiveGoal = input.goal;
    if (effectiveGoal === "maintain") {
      kcal = tdee;
    } else if (effectiveGoal === "recomp") {
      kcal = tdee * 0.95;
    } else {
      const direction = effectiveGoal; // "lose" | "gain"
```

Por:
```ts
    effectiveGoal = input.goal;
    if (effectiveGoal === "maintain") {
      kcal = tdee;
    } else {
      const direction = effectiveGoal; // "lose" | "gain"
```

- [ ] **Step 2: Trocar o cálculo de proteína pra massa magra**

Substituir:
```ts
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
```

Por:
```ts
  // Massa magra = peso total menos a fração de gordura — base mais precisa
  // pra proteína que peso total (dois corpos com o mesmo peso e composições
  // diferentes precisam de quantidades de proteína bem diferentes).
  const leanMass_kg = input.weight_kg * (1 - input.body_fat_pct / 100);

  const hasKidneyDisease = gates.some((g) => g.condition === "kidney_disease");
  let protein_g: number;
  if (hasKidneyDisease) {
    // Restrição clínica é dosada por peso corporal total, não massa magra.
    protein_g = input.weight_kg * 0.8;
  } else {
    const proteinPerKgLeanMass = effectiveGoal === "lose" ? 2.2 : 1.8;
    let raw = leanMass_kg * proteinPerKgLeanMass;
    if (input.protein_g_override !== undefined) {
      // Ajuste manual (slider na tela de revelação) — clampado a uma faixa seguinda.
      const minProtein = leanMass_kg * 1.2;
      const maxProtein = leanMass_kg * 3.0;
      raw = Math.min(maxProtein, Math.max(minProtein, input.protein_g_override));
    }
    protein_g = raw;
  }
```

- [ ] **Step 3: Remover a função `bmi()` — não é mais usada aqui**

Substituir:
```ts
function bmi(weight_kg: number, height_cm: number): number {
  const heightM = height_cm / 100;
  return weight_kg / (heightM * heightM);
}
```

Por: (remover o bloco inteiro — nenhuma outra função em `compute-targets.ts` chama `bmi()` depois da Step 2).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace packages/shared`
Expected: PASS, sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/targets/compute-targets.ts
git commit -m "feat(shared): proteina por massa magra, remove recomp e paliativo de IMC>30"
```

---

## Task 5: `compute-targets.test.ts` — atualiza fixtures e casos de proteína

**Files:**
- Modify: `packages/shared/src/targets/compute-targets.test.ts`

**Interfaces:**
- Consumes: `computeTargets()` (Task 4).

- [ ] **Step 1: Adicionar `body_fat_pct` ao Caso 1 e atualizar os valores de proteína/carboidrato**

Substituir:
```ts
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
```

Por:
```ts
describe("computeTargets — Caso 1 (clamp de ritmo + piso de gordura interagindo)", () => {
  const input: TargetsInput = {
    sex: "female",
    age_years: 32,
    weight_kg: 78,
    height_cm: 165,
    activity_level: "light",
    goal: "lose",
    rate_kg_per_week: 0.5,
    body_fat_pct: 30,
  };
  const result = computeTargets(input);
```

E, no mesmo describe, substituir:
```ts
  it("proteína 1,8 g/kg = 140,4 g", () => {
    expect(result.protein_g).toBeCloseTo(140.4, 2);
  });
```

Por:
```ts
  it("proteína 2,2 g/kg de massa magra (78kg * 70% = 54,6kg) = 120,12 g", () => {
    expect(result.protein_g).toBeCloseTo(120.12, 2);
  });
```

E substituir:
```ts
  it("carboidrato ≈ 138,51 g", () => {
    expect(result.carbs_g).toBeCloseTo(138.51, 2);
  });
```

Por:
```ts
  it("carboidrato ≈ 158,79 g", () => {
    expect(result.carbs_g).toBeCloseTo(158.79, 2);
  });
```

- [ ] **Step 2: Adicionar `body_fat_pct` aos Casos 2 e 3 (não afetam as asserções, só precisam compilar)**

Substituir:
```ts
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
```

Por:
```ts
describe("computeTargets — Caso 2 (BLOCK por IMC)", () => {
  it("homem com IMC 18,5 pedindo perda -> bloqueado, kcal de manutenção", () => {
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 60,
      height_cm: 180,
      activity_level: "sedentary",
      goal: "lose",
      body_fat_pct: 15,
    });
```

Substituir:
```ts
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
```

Por:
```ts
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
      body_fat_pct: 28,
    });
```

- [ ] **Step 3: Remover o Caso 4 (paliativo de IMC>30) e o describe de `recomp` inteiros**

Remover os dois blocos completos:
```ts
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
```

```ts
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
    // precisão 1 (não 2): result.kcal é round2(tdee_bruto*0.95), enquanto
    // este cálculo usa round2(tdee_bruto)*0.95 — arredondamento em ordens
    // diferentes gera até ~0.01 de diferença, esperado e não é bug.
    expect(result.kcal).toBeCloseTo(result.tdee_kcal * 0.95, 1);
  });
});
```

- [ ] **Step 4: Adicionar os novos describes de proteína por massa magra, no lugar dos dois removidos**

```ts
describe("computeTargets — proteína por massa magra", () => {
  it("lose: 2,2 g/kg de massa magra (100kg, 25% gordura -> 75kg magra)", () => {
    const result = computeTargets({
      sex: "male",
      age_years: 30,
      weight_kg: 100,
      height_cm: 178,
      activity_level: "moderate",
      goal: "lose",
      rate_kg_per_week: 0.5,
      body_fat_pct: 25,
    });
    expect(result.protein_g).toBeCloseTo(165, 2);
  });

  it("maintain: 1,8 g/kg de massa magra (65kg, 28% gordura -> 46,8kg magra)", () => {
    const result = computeTargets({
      sex: "female",
      age_years: 28,
      weight_kg: 65,
      height_cm: 165,
      activity_level: "moderate",
      goal: "maintain",
      body_fat_pct: 28,
    });
    expect(result.protein_g).toBeCloseTo(84.24, 2);
  });

  it("doença renal: 0,8 g/kg de peso total, ignora massa magra", () => {
    const result = computeTargets({
      sex: "male",
      age_years: 30,
      weight_kg: 100,
      height_cm: 178,
      activity_level: "moderate",
      goal: "lose",
      rate_kg_per_week: 0.5,
      body_fat_pct: 25,
      has_kidney_disease: true,
    });
    expect(result.protein_g).toBeCloseTo(80, 2);
  });
});

describe("computeTargets — protein_g_override", () => {
  const base: TargetsInput = {
    sex: "male",
    age_years: 30,
    weight_kg: 100,
    height_cm: 178,
    activity_level: "moderate",
    goal: "lose",
    rate_kg_per_week: 0.5,
    body_fat_pct: 25,
  };

  it("dentro da faixa (1,2-3,0 g/kg de 75kg de massa magra = 90-225g) usa o valor exato", () => {
    const result = computeTargets({ ...base, protein_g_override: 200 });
    expect(result.protein_g).toBeCloseTo(200, 2);
    expect(result.carbs_g).toBeCloseTo(268.68, 2);
  });

  it("acima do teto (225g) clampa pro máximo", () => {
    const result = computeTargets({ ...base, protein_g_override: 999 });
    expect(result.protein_g).toBeCloseTo(225, 2);
    expect(result.carbs_g).toBeCloseTo(243.68, 2);
  });

  it("abaixo do piso (90g) clampa pro mínimo", () => {
    const result = computeTargets({ ...base, protein_g_override: 1 });
    expect(result.protein_g).toBeCloseTo(90, 2);
    expect(result.carbs_g).toBeCloseTo(378.68, 2);
  });
});
```

- [ ] **Step 5: Adicionar `body_fat_pct` aos testes de "direção ganho" e "carboidrato baixo"**

Substituir (dois blocos dentro de `describe("computeTargets — direção ganho"...)`):
```ts
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "moderate",
      goal: "gain",
      rate_kg_per_week: 1.0, // acima do teto de 0.5% * 80kg = 0.4kg/semana
    });
```

Por:
```ts
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "moderate",
      goal: "gain",
      rate_kg_per_week: 1.0, // acima do teto de 0.5% * 80kg = 0.4kg/semana
      body_fat_pct: 15,
    });
```

Substituir:
```ts
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "sedentary",
      goal: "gain",
      rate_kg_per_week: 0.3,
    });
```

Por:
```ts
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "sedentary",
      goal: "gain",
      rate_kg_per_week: 0.3,
      body_fat_pct: 15,
    });
```

E no teste de carboidrato baixo, substituir:
```ts
describe("computeTargets — carboidrato baixo", () => {
  it("emite very_low_carb quando carboidrato final < 50g", () => {
    // Peso muito alto empurra proteína/gordura (proporcionais ao peso) pra
    // cima enquanto o clamp de déficit (25% do TDEE) segura o kcal — sobra
    // pouco pro carboidrato. Verificado: kcal=2755 (clamp below_bmr),
    // protein_g=400 (200kg*2.0 treino de força), fat_g=120 (piso 0.6g/kg),
    // carbs=(2755-1600-1080)/4=18.75g.
    const result = computeTargets({
      sex: "male",
      age_years: 50,
      weight_kg: 200,
      height_cm: 160,
      activity_level: "sedentary",
      goal: "lose",
      rate_kg_per_week: 2.0,
      strength_training: true,
    });
    expect(result.carbs_g).toBeLessThan(50);
    expect(result.warnings.some((w) => w.code === "very_low_carb")).toBe(true);
    expect(result.warnings.some((w) => w.code === "low_carb")).toBe(false);
  });
});
```

Por:
```ts
describe("computeTargets — carboidrato baixo", () => {
  it("emite very_low_carb quando carboidrato final < 50g", () => {
    // Peso muito alto e % de gordura baixo empurram a proteína (massa magra
    // * 2.2) pra cima enquanto o clamp de déficit (25% do TDEE) segura o
    // kcal — sobra pouco pro carboidrato. Verificado: kcal=2755 (clamp
    // below_bmr), massa magra=180kg (200kg*90%), protein_g=396 (180*2.2),
    // fat_g=120 (piso 0.6g/kg), carbs=(2755-1584-1080)/4=22.75g.
    const result = computeTargets({
      sex: "male",
      age_years: 50,
      weight_kg: 200,
      height_cm: 160,
      activity_level: "sedentary",
      goal: "lose",
      rate_kg_per_week: 2.0,
      body_fat_pct: 10,
    });
    expect(result.carbs_g).toBeLessThan(50);
    expect(result.warnings.some((w) => w.code === "very_low_carb")).toBe(true);
    expect(result.warnings.some((w) => w.code === "low_carb")).toBe(false);
  });
});
```

- [ ] **Step 6: Rodar a suíte**

Run: `npm run test --workspace packages/shared`
Expected: PASS em todos os testes de `compute-targets.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/targets/compute-targets.test.ts
git commit -m "test(shared): atualiza compute-targets pra proteina por massa magra"
```

---

## Task 6: `gates.test.ts` — adiciona `body_fat_pct` à fixture

**Files:**
- Modify: `packages/shared/src/targets/gates.test.ts`

- [ ] **Step 1: Editar a fixture `BASE`**

Substituir:
```ts
const BASE: TargetsInput = {
  sex: "female",
  age_years: 30,
  weight_kg: 65,
  height_cm: 165,
  activity_level: "moderate",
  goal: "lose",
};
```

Por:
```ts
const BASE: TargetsInput = {
  sex: "female",
  age_years: 30,
  weight_kg: 65,
  height_cm: 165,
  activity_level: "moderate",
  goal: "lose",
  body_fat_pct: 28,
};
```

- [ ] **Step 2: Rodar a suíte**

Run: `npm run test --workspace packages/shared`
Expected: PASS — `evaluateSafetyGates` não usa `body_fat_pct`, então as asserções não mudam.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/targets/gates.test.ts
git commit -m "test(shared): adiciona body_fat_pct à fixture de gates.test"
```

---

## Task 7: `schemas.ts` — `GoalSchema` sem `recomp`, `OnboardingPayloadSchema` com os novos campos

**Files:**
- Modify: `packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `OnboardingPayload.body_fat_pct: number` (obrigatório), `OnboardingPayload.protein_g_override?: number`.

- [ ] **Step 1: Editar `GoalSchema`**

Substituir:
```ts
export const GoalSchema = z.enum(["lose", "maintain", "gain", "recomp"]);
```

Por:
```ts
export const GoalSchema = z.enum(["lose", "maintain", "gain"]);
```

- [ ] **Step 2: Adicionar os novos campos ao `OnboardingPayloadSchema`**

Substituir:
```ts
  target_weight_kg: z.number().positive().max(500).optional(),
  rate_kg_per_week: z.number().positive().max(2).optional(),
  strength_training: z.boolean().optional(),
  training_days_per_week: z.number().int().min(0).max(7).optional(),
```

Por:
```ts
  target_weight_kg: z.number().positive().max(500).optional(),
  rate_kg_per_week: z.number().positive().max(2).optional(),
  body_fat_pct: z.number().min(3).max(60),
  protein_g_override: z.number().positive().optional(),
  strength_training: z.boolean().optional(),
  training_days_per_week: z.number().int().min(0).max(7).optional(),
```

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck --workspace packages/shared && npm run lint --workspace packages/shared`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat(shared): schema do onboarding ganha body_fat_pct e protein_g_override, remove recomp"
```

---

## Task 8: `apps/server` — `buildTargetsInput` passa os novos campos

**Files:**
- Modify: `apps/server/src/services/targets.ts`

- [ ] **Step 1: Editar `buildTargetsInput`**

Substituir:
```ts
export function buildTargetsInput(payload: OnboardingPayload): TargetsInput {
  return {
    sex: payload.sex,
    age_years: ageYearsFromBirthDate(payload.birth_date),
    weight_kg: payload.weight_kg,
    height_cm: payload.height_cm,
    activity_level: payload.activity_level,
    goal: payload.goal,
    target_weight_kg: payload.target_weight_kg,
    rate_kg_per_week: payload.rate_kg_per_week,
    strength_training: payload.strength_training,
    is_pregnant_or_lactating: payload.is_pregnant_or_lactating,
    has_kidney_disease: payload.has_kidney_disease,
    has_type1_diabetes: payload.has_type1_diabetes,
    uses_glp1: payload.uses_glp1,
  };
}
```

Por:
```ts
export function buildTargetsInput(payload: OnboardingPayload): TargetsInput {
  return {
    sex: payload.sex,
    age_years: ageYearsFromBirthDate(payload.birth_date),
    weight_kg: payload.weight_kg,
    height_cm: payload.height_cm,
    activity_level: payload.activity_level,
    goal: payload.goal,
    body_fat_pct: payload.body_fat_pct,
    target_weight_kg: payload.target_weight_kg,
    rate_kg_per_week: payload.rate_kg_per_week,
    protein_g_override: payload.protein_g_override,
    strength_training: payload.strength_training,
    is_pregnant_or_lactating: payload.is_pregnant_or_lactating,
    has_kidney_disease: payload.has_kidney_disease,
    has_type1_diabetes: payload.has_type1_diabetes,
    uses_glp1: payload.uses_glp1,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck --workspace apps/server`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/targets.ts
git commit -m "feat(server): buildTargetsInput passa body_fat_pct e protein_g_override"
```

---

## Task 9: Migration — `anthropometrics.body_fat_pct` e enum `goal` sem `recomp`

**Files:**
- Create: `supabase/migrations/0068_body_fat_pct_and_goal_enum.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- M19: % de gordura corporal na anamnese (proteína passa a ser calculada
-- sobre massa magra) e remoção de 'recomp' do objetivo — o produto ainda
-- não foi lançado, então não há linha de produção com esse valor.
-- Ver docs/superpowers/specs/2026-08-27-onboarding-inputs-bodyfat-design.md.

-- ── anthropometrics.body_fat_pct ──────────────────────────────────────────
ALTER TABLE public.anthropometrics
  ADD COLUMN body_fat_pct numeric(4,1)
    CHECK (body_fat_pct IS NULL OR (body_fat_pct > 0 AND body_fat_pct < 70));

-- ── goal: remove 'recomp' do enum ─────────────────────────────────────────
-- Único uso como tipo de coluna é profiles.goal; as demais referências a
-- `goal` nas migrations anteriores são declarações de variável local dentro
-- de funções PL/pgsql (não precisam de migração de dados).
CREATE TYPE goal_new AS ENUM ('lose', 'maintain', 'gain');
ALTER TABLE public.profiles ALTER COLUMN goal TYPE goal_new USING goal::text::goal_new;
DROP TYPE public.goal;
ALTER TYPE goal_new RENAME TO goal;

-- ── complete_onboarding_impl: grava body_fat_pct ──────────────────────────
-- kcal/protein_g/carbs_g/fat_g continuam vindo prontos de computeTargets
-- (TS) via payload.targets — só o INSERT em anthropometrics muda.
CREATE OR REPLACE FUNCTION public.complete_onboarding_impl(payload jsonb)
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
  v_phone_e164      text := NULLIF(payload->>'phone_e164', '');
  v_targets         jsonb := payload->'targets';
  v_soft_mode       boolean := COALESCE((payload->>'soft_mode')::boolean, false);
  v_anthro_id       uuid;
  v_goal_id         uuid;
  v_effective_from  date;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires authenticated user';
  END IF;

  IF v_targets IS NULL THEN
    RAISE EXCEPTION 'complete_onboarding requires payload.targets (computed by computeTargets)';
  END IF;

  -- 1. profiles ------------------------------------------------------------
  INSERT INTO public.profiles (
    user_id, full_name, username, avatar_url, birth_date, sex,
    activity_level, goal, timezone, day_start_hour, locale, lgpd_consent_at,
    onboarding_context, soft_mode
  )
  VALUES (
    uid,
    payload->>'full_name',
    NULLIF(payload->>'username', '')::citext,
    NULLIF(payload->>'avatar_url', ''),
    v_birth_date,
    v_sex,
    v_activity_level,
    v_goal,
    payload->>'timezone',
    COALESCE((payload->>'day_start_hour')::smallint, 0),
    COALESCE(payload->>'locale', 'pt-BR'),
    now(),
    COALESCE(payload->'onboarding_context', '{}'::jsonb),
    v_soft_mode
  );

  IF v_phone_e164 IS NOT NULL THEN
    INSERT INTO public.profiles_private (user_id, phone_e164)
    VALUES (uid, v_phone_e164);
  END IF;

  -- 2. anthropometrics (bmr/tdee chegam prontos de computeTargets;
  --    flags de saúde, peso-alvo/ritmo, % de gordura e frequência de treino
  --    vêm do payload — M15/M16/M18/M19) ------------------------------------
  INSERT INTO public.anthropometrics (
    user_id, weight_kg, height_cm, bmr_kcal, tdee_kcal,
    target_weight_kg, rate_kg_per_week, body_fat_pct,
    strength_training, is_pregnant_or_lactating, has_kidney_disease,
    has_type1_diabetes, uses_glp1, tca_screening_positive,
    training_days_per_week
  )
  VALUES (
    uid,
    v_weight_kg,
    v_height_cm,
    (v_targets->>'bmr_kcal')::numeric,
    (v_targets->>'tdee_kcal')::numeric,
    NULLIF(payload->>'target_weight_kg', '')::numeric,
    NULLIF(payload->>'rate_kg_per_week', '')::numeric,
    (payload->>'body_fat_pct')::numeric,
    (payload->>'strength_training')::boolean,
    (payload->>'is_pregnant_or_lactating')::boolean,
    (payload->>'has_kidney_disease')::boolean,
    (payload->>'has_type1_diabetes')::boolean,
    (payload->>'uses_glp1')::boolean,
    (payload->>'tca_screening_positive')::boolean,
    NULLIF(payload->>'training_days_per_week', '')::smallint
  )
  RETURNING id INTO v_anthro_id;

  -- 3. nutrition_goals (kcal/macros já computados; effective_from pelo dia
  --    nutricional do usuário, não CURRENT_DATE do servidor — 0024) --------
  v_effective_from := public.fitbrother_nutritional_day(uid, now());

  INSERT INTO public.nutrition_goals (
    user_id, effective_from, kcal, protein_g, carbs_g, fat_g, fiber_g,
    tdee_source, warnings, blocked
  )
  VALUES (
    uid,
    v_effective_from,
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

  -- 6. onboarding_progress não tem mais o que retomar: a conta existe -------
  DELETE FROM public.onboarding_progress WHERE user_id = uid;

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
    'blocked',           v_targets->>'blocked',
    'block_reason',      v_targets->>'block_reason',
    'soft_mode',         v_soft_mode
  );
END;
$$;
```

- [ ] **Step 2: Aplicar localmente**

Run: `supabase db reset`
Expected: aplica todas as migrations, incluindo a nova, sem erro.

- [ ] **Step 3: Regenerar tipos**

Run: `npm run db:types` (script raiz — grava em `packages/db-types/index.ts`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0068_body_fat_pct_and_goal_enum.sql packages/db-types/index.ts
git commit -m "feat(db): body_fat_pct em anthropometrics, remove recomp do enum goal"
```

---

## Task 10: `onboardingStore.ts` — novos campos

**Files:**
- Modify: `apps/mobile/lib/stores/onboardingStore.ts`

- [ ] **Step 1: Adicionar os campos ao tipo `OnboardingState` e ao `INITIAL`**

Substituir:
```ts
  target_weight_kg: number | undefined;
  rate_kg_per_week: number | undefined;
  training_type: TrainingType;
```

Por:
```ts
  target_weight_kg: number | undefined;
  rate_kg_per_week: number | undefined;
  body_fat_pct: number | undefined;
  protein_g_override: number | undefined;
  training_type: TrainingType;
```

Substituir:
```ts
  target_weight_kg: undefined,
  rate_kg_per_week: undefined,
  training_type: "none",
```

Por:
```ts
  target_weight_kg: undefined,
  rate_kg_per_week: undefined,
  body_fat_pct: undefined,
  protein_g_override: undefined,
  training_type: "none",
```

- [ ] **Step 2: Incluir em `toAnswers()`**

Substituir:
```ts
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      training_type: s.training_type,
```

Por:
```ts
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      body_fat_pct: s.body_fat_pct,
      protein_g_override: s.protein_g_override,
      training_type: s.training_type,
```

- [ ] **Step 3: Exigir `body_fat_pct` em `toPayload()` e incluir os dois campos no retorno**

Substituir:
```ts
    if (
      !full_name ||
      !birth_date_iso ||
      !s.sex ||
      s.weight_kg === undefined ||
      s.height_cm === undefined ||
      !s.activity_level ||
      !s.goal ||
      !s.consents.terms ||
      !s.consents.privacy ||
      !s.consents.ai_processing
    ) {
      return null;
    }
```

Por:
```ts
    if (
      !full_name ||
      !birth_date_iso ||
      !s.sex ||
      s.weight_kg === undefined ||
      s.height_cm === undefined ||
      s.body_fat_pct === undefined ||
      !s.activity_level ||
      !s.goal ||
      !s.consents.terms ||
      !s.consents.privacy ||
      !s.consents.ai_processing
    ) {
      return null;
    }
```

Substituir:
```ts
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      strength_training: s.strength_training,
```

Por:
```ts
      body_fat_pct: s.body_fat_pct,
      protein_g_override: s.protein_g_override,
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      strength_training: s.strength_training,
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck --workspace apps/mobile`
Expected: FAIL ainda (blocos que chamam `computeTargets` sem `body_fat_pct` — Tasks 17-19 resolvem). Confirma o encadeamento; não commitar até lá se preferir rodar tudo de uma vez, ou seguir e resolver nos próximos tasks.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/stores/onboardingStore.ts
git commit -m "feat(mobile): onboardingStore ganha body_fat_pct e protein_g_override"
```

---

## Task 11: `onboardingResultStore.ts` — guarda o `TargetsInput` usado

**Files:**
- Modify: `apps/mobile/lib/stores/onboardingResultStore.ts`

**Interfaces:**
- Produces: `useOnboardingResultStore().targetsInput: TargetsInput | null`; `setResult(result, targetsInput)`.

- [ ] **Step 1: Reescrever o store**

Substituir o arquivo inteiro:
```ts
import { create } from "zustand";

type OnboardingResult = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  blocked: boolean;
  block_reason: string | null;
  soft_mode: boolean;
} | null;

interface OnboardingResultState {
  result: OnboardingResult;
  setResult: (result: OnboardingResult) => void;
}

export const useOnboardingResultStore = create<OnboardingResultState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
```

Por:
```ts
import type { TargetsInput } from "@fitbrother/shared";
import { create } from "zustand";

type OnboardingResult = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  blocked: boolean;
  block_reason: string | null;
  soft_mode: boolean;
} | null;

interface OnboardingResultState {
  result: OnboardingResult;
  // Input usado pra gerar `result` — guardado pra RevealBlock poder
  // rechamar computeTargets() com protein_g_override sem reconstruir tudo.
  targetsInput: TargetsInput | null;
  setResult: (result: OnboardingResult, targetsInput: TargetsInput) => void;
}

export const useOnboardingResultStore = create<OnboardingResultState>((set) => ({
  result: null,
  targetsInput: null,
  setResult: (result, targetsInput) => set({ result, targetsInput }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/stores/onboardingResultStore.ts
git commit -m "feat(mobile): onboardingResultStore guarda o targetsInput usado no preview"
```

---

## Task 12: `SliderInput` — componente novo

**Files:**
- Create: `apps/mobile/components/SliderInput.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface SliderInputProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    markerValue?: number;
    onChange: (value: number) => void;
  }
  export function SliderInput(props: SliderInputProps): JSX.Element;
  ```

- [ ] **Step 1: Criar o componente**

```tsx
import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { colors } from "@/lib/colors";

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  // Posição opcional de um traço fino na track — usado pra marcar o valor
  // recomendado (ex. proteína calculada) enquanto o usuário ajusta.
  markerValue?: number;
  onChange: (value: number) => void;
}

function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  return Math.min(2, String(step).split(".")[1]?.length ?? 0);
}

export function SliderInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  markerValue,
  onChange,
}: SliderInputProps) {
  const decimals = decimalsFor(step);
  const [text, setText] = useState(value.toFixed(decimals));
  const [focused, setFocused] = useState(false);

  // Sincroniza o texto quando o valor muda por fora (slider, ou outro
  // campo reagindo) — mas não enquanto o usuário está digitando.
  useEffect(() => {
    if (!focused) setText(value.toFixed(decimals));
  }, [value, decimals, focused]);

  function commit(raw: string) {
    const parsed = Number(raw.replace(",", "."));
    const next = Number.isNaN(parsed) ? value : Math.min(max, Math.max(min, parsed));
    onChange(Number(next.toFixed(decimals)));
    setText(next.toFixed(decimals));
  }

  const markerPct =
    markerValue !== undefined ? ((markerValue - min) / (max - min)) * 100 : undefined;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-sans-medium text-neutral-700">{label}</Text>
        <View className="flex-row items-center gap-1">
          <TextInput
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit(text);
            }}
            onSubmitEditing={() => commit(text)}
            keyboardType="decimal-pad"
            className="min-w-[44px] py-1 text-right text-sm font-sans-semibold text-neutral-800"
            style={{ fontVariant: ["tabular-nums"] }}
            accessibilityLabel={`${label} — valor exato`}
          />
          {unit && <Text className="text-sm font-sans text-neutral-500">{unit}</Text>}
        </View>
      </View>
      <View className="justify-center">
        {markerPct !== undefined && (
          <View
            pointerEvents="none"
            className="absolute top-[13px] h-3.5 w-[2px] bg-neutral-400"
            style={{ left: `${markerPct}%` }}
          />
        )}
        <Slider
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={(v) => onChange(Number(v.toFixed(decimals)))}
          minimumTrackTintColor={colors.primary[400]}
          maximumTrackTintColor={colors.neutral[200]}
          thumbTintColor={colors.primary[500]}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep SliderInput; npx eslint apps/mobile/components/SliderInput.tsx`
Expected: sem erros relacionados a `SliderInput.tsx` (o typecheck completo do workspace só fecha depois das Tasks 13-19, que consomem os campos novos).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/SliderInput.tsx
git commit -m "feat(mobile): componente SliderInput (slider + input numerico sincronizados)"
```

---

## Task 13: `HeightBlock`/`WeightBlock` — trocam `WheelPicker` por `SliderInput`

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/HeightBlock.tsx`
- Modify: `apps/mobile/components/onboarding/blocks/WeightBlock.tsx`

**Interfaces:**
- Consumes: `SliderInput` (Task 12).

- [ ] **Step 1: `HeightBlock.tsx`**

Substituir:
```tsx
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { WheelPicker } from "@/components/WheelPicker";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";
```

Por:
```tsx
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { SliderInput } from "@/components/SliderInput";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";
```

Substituir:
```tsx
      <View className="flex-1 items-center justify-center">
        <WheelPicker
          min={120}
          max={220}
          step={1}
          value={selectedHeight}
          unit="cm"
          onChange={(v) => setField("height_cm", v)}
        />
      </View>
```

Por:
```tsx
      <View className="flex-1 justify-center">
        <SliderInput
          label="Altura"
          min={120}
          max={220}
          step={1}
          value={selectedHeight}
          unit="cm"
          onChange={(v) => setField("height_cm", v)}
        />
      </View>
```

- [ ] **Step 2: `WeightBlock.tsx`**

Substituir:
```tsx
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { WheelPicker } from "@/components/WheelPicker";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";
```

Por:
```tsx
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { SliderInput } from "@/components/SliderInput";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";
```

Substituir:
```tsx
      <View className="flex-1 items-center justify-center">
        <WheelPicker
          min={30}
          max={200}
          step={0.5}
          value={selectedWeight}
          unit="kg"
          onChange={(v) => setField("weight_kg", v)}
        />
      </View>
```

Por:
```tsx
      <View className="flex-1 justify-center">
        <SliderInput
          label="Peso"
          min={30}
          max={200}
          step={0.5}
          value={selectedWeight}
          unit="kg"
          onChange={(v) => setField("weight_kg", v)}
        />
      </View>
```

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck --workspace apps/mobile && npx eslint apps/mobile/components/onboarding/blocks/HeightBlock.tsx apps/mobile/components/onboarding/blocks/WeightBlock.tsx`
Expected: PASS (nenhum arquivo mais referencia `WheelPicker` fora de `settings.tsx`/`TimePicker.tsx`/`GoalBlock.tsx` — este último ainda será migrado no Task 16).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/HeightBlock.tsx apps/mobile/components/onboarding/blocks/WeightBlock.tsx
git commit -m "feat(mobile): HeightBlock e WeightBlock usam SliderInput"
```

---

## Task 14: `BodyFatSilhouette` — ilustração paramétrica

**Files:**
- Create: `apps/mobile/components/onboarding/BodyFatSilhouette.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface BodyFatSilhouetteProps {
    sex: "male" | "female" | "other";
    bucket: 1 | 2 | 3 | 4 | 5;
    selected?: boolean;
    size?: number;
  }
  export function BodyFatSilhouette(props: BodyFatSilhouetteProps): JSX.Element;
  ```

- [ ] **Step 1: Criar o componente**

```tsx
import { Circle, Path, Svg } from "react-native-svg";
import { colors } from "@/lib/colors";

interface BodyFatSilhouetteProps {
  sex: "male" | "female" | "other";
  bucket: 1 | 2 | 3 | 4 | 5;
  selected?: boolean;
  size?: number;
}

// Largura do tronco/cintura cresce por faixa — mesma silhueta base,
// interpolada entre um contorno mais estreito (faixa 1) e mais largo
// (faixa 5). Não é anatomia realista: é um indicador visual relativo
// entre as 5 opções, não uma medida exata.
const WAIST_WIDTH_BY_BUCKET: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 18,
  2: 22,
  3: 27,
  4: 33,
  5: 40,
};

export function BodyFatSilhouette({
  sex,
  bucket,
  selected = false,
  size = 56,
}: BodyFatSilhouetteProps) {
  const waist = WAIST_WIDTH_BY_BUCKET[bucket];
  const shoulderWidth = sex === "female" ? 30 : 36;
  const hipWidth = sex === "female" ? waist + 4 : waist;
  const fill = selected ? colors.primary[400] : colors.neutral[300];

  const cx = 50;
  const headR = 10;
  const headCy = 16;
  const shoulderY = 30;
  const waistY = 60;
  const hipY = 80;

  const bodyPath = [
    `M ${cx - shoulderWidth / 2} ${shoulderY}`,
    `L ${cx + shoulderWidth / 2} ${shoulderY}`,
    `L ${cx + waist / 2} ${waistY}`,
    `L ${cx + hipWidth / 2} ${hipY}`,
    `L ${cx - hipWidth / 2} ${hipY}`,
    `L ${cx - waist / 2} ${waistY}`,
    "Z",
  ].join(" ");

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={cx} cy={headCy} r={headR} fill={fill} />
      <Path d={bodyPath} fill={fill} />
    </Svg>
  );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep BodyFatSilhouette; npx eslint apps/mobile/components/onboarding/BodyFatSilhouette.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/BodyFatSilhouette.tsx
git commit -m "feat(mobile): BodyFatSilhouette — ilustracao parametrica por faixa"
```

---

## Task 15: `BodyFatBlock` — novo bloco

**Files:**
- Create: `apps/mobile/components/onboarding/blocks/BodyFatBlock.tsx`

**Interfaces:**
- Consumes: `BodyFatSilhouette` (Task 14), `useOnboardingStore.body_fat_pct`/`setField` (Task 10).
- Produces: `export function BodyFatBlock(props: OnboardingBlockProps): JSX.Element`.

- [ ] **Step 1: Criar o componente**

```tsx
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { BodyFatSilhouette } from "@/components/onboarding/BodyFatSilhouette";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

type Bucket = 1 | 2 | 3 | 4 | 5;
type BodyFatSex = "male" | "female" | "other";

// % representativo de cada faixa, por sexo — usado tanto pra exibir quanto
// pra gravar em body_fat_pct quando o usuário toca num card ilustrado.
const BUCKETS_BY_SEX: Record<BodyFatSex, Record<Bucket, number>> = {
  male: { 1: 10, 2: 14, 3: 20, 4: 26, 5: 33 },
  female: { 1: 17, 2: 22, 3: 28, 4: 34, 5: 40 },
  other: { 1: 13, 2: 18, 3: 24, 4: 30, 5: 36 },
};

const BUCKETS: Bucket[] = [1, 2, 3, 4, 5];

function nearestBucket(pct: number, sex: BodyFatSex): Bucket {
  const table = BUCKETS_BY_SEX[sex];
  let closest: Bucket = 1;
  let closestDist = Infinity;
  for (const bucket of BUCKETS) {
    const dist = Math.abs(table[bucket] - pct);
    if (dist < closestDist) {
      closestDist = dist;
      closest = bucket;
    }
  }
  return closest;
}

export function BodyFatBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const sex = (useOnboardingStore((s) => s.sex) ?? "other") as BodyFatSex;
  const body_fat_pct = useOnboardingStore((s) => s.body_fat_pct);
  const setField = useOnboardingStore((s) => s.setField);
  const [exactMode, setExactMode] = useState(false);
  const [exactText, setExactText] = useState(
    body_fat_pct !== undefined ? String(body_fat_pct) : "",
  );

  const table = BUCKETS_BY_SEX[sex];
  const selectedBucket = body_fat_pct !== undefined ? nearestBucket(body_fat_pct, sex) : undefined;

  function selectBucket(bucket: Bucket) {
    void Haptics.selectionAsync();
    setExactMode(false);
    setField("body_fat_pct", table[bucket]);
    setExactText(String(table[bucket]));
  }

  function commitExact(raw: string) {
    const parsed = Number(raw.replace(",", "."));
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(60, Math.max(3, parsed));
    setField("body_fat_pct", clamped);
    setExactText(String(clamped));
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual seu % de gordura corporal?"
      subtitle="Ajuda a calcular sua proteína com mais precisão. Escolha a ilustração mais parecida."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={body_fat_pct === undefined}
    >
      <View className="gap-6">
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-center gap-3">
          {BUCKETS.map((bucket) => (
            <Pressable
              key={bucket}
              onPress={() => selectBucket(bucket)}
              accessibilityRole="radio"
              accessibilityLabel={`Aproximadamente ${table[bucket]}% de gordura corporal`}
              accessibilityState={{ selected: selectedBucket === bucket && !exactMode }}
              className={`min-h-[44px] min-w-[44px] items-center rounded-xl border p-2 ${
                selectedBucket === bucket && !exactMode
                  ? "border-[1.5px] border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <BodyFatSilhouette sex={sex} bucket={bucket} selected={selectedBucket === bucket} />
              <Text
                className="mt-1 text-xs font-sans text-neutral-500"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                ~{table[bucket]}%
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setExactMode((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            exactMode ? "Usar as ilustrações" : "Prefiro digitar o número exato"
          }
        >
          <Text className="text-center text-sm font-sans-medium text-primary-500">
            {exactMode ? "Usar as ilustrações" : "Prefiro digitar o número exato"}
          </Text>
        </Pressable>

        {exactMode && (
          <View className="flex-row items-center justify-center gap-2">
            <TextInput
              value={exactText}
              onChangeText={setExactText}
              onBlur={() => commitExact(exactText)}
              onSubmitEditing={() => commitExact(exactText)}
              keyboardType="decimal-pad"
              className="w-20 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-base font-sans-semibold text-neutral-800"
              style={{ fontVariant: ["tabular-nums"] }}
              accessibilityLabel="% de gordura corporal exato"
            />
            <Text className="text-base font-sans text-neutral-600">%</Text>
          </View>
        )}
      </View>
    </OnboardingChapterShell>
  );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep BodyFatBlock; npx eslint apps/mobile/components/onboarding/blocks/BodyFatBlock.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/BodyFatBlock.tsx
git commit -m "feat(mobile): BodyFatBlock — selecao ilustrada + numero exato de % de gordura"
```

---

## Task 16: `blocks.ts` — insere `body_fat` no array

**Files:**
- Modify: `apps/mobile/lib/onboarding/blocks.ts`

**Interfaces:**
- Consumes: `BodyFatBlock` (Task 15).
- Produces: `DATA_BLOCK_COUNT = 13`.

- [ ] **Step 1: Editar imports e array**

Substituir:
```ts
import { ActivityBlock } from "@/components/onboarding/blocks/ActivityBlock";
import { BasicsBlock } from "@/components/onboarding/blocks/BasicsBlock";
```

Por:
```ts
import { ActivityBlock } from "@/components/onboarding/blocks/ActivityBlock";
import { BasicsBlock } from "@/components/onboarding/blocks/BasicsBlock";
import { BodyFatBlock } from "@/components/onboarding/blocks/BodyFatBlock";
```

Substituir:
```ts
export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  // Fase A — anamnese, sessão anônima, painel de capítulos visível
  { id: "name", Component: NameBlock, chapter: 1 },
  { id: "basics", Component: BasicsBlock, chapter: 1 },
  { id: "height", Component: HeightBlock, chapter: 1 },
  { id: "weight", Component: WeightBlock, chapter: 1 },
  { id: "activity", Component: ActivityBlock, chapter: 1 },
  { id: "goal", Component: GoalBlock, chapter: 2 },
```

Por:
```ts
export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  // Fase A — anamnese, sessão anônima, painel de capítulos visível
  { id: "name", Component: NameBlock, chapter: 1 },
  { id: "basics", Component: BasicsBlock, chapter: 1 },
  { id: "height", Component: HeightBlock, chapter: 1 },
  { id: "weight", Component: WeightBlock, chapter: 1 },
  { id: "body_fat", Component: BodyFatBlock, chapter: 1 },
  { id: "activity", Component: ActivityBlock, chapter: 1 },
  { id: "goal", Component: GoalBlock, chapter: 2 },
```

- [ ] **Step 2: Atualizar `DATA_BLOCK_COUNT` e o comentário**

Substituir:
```ts
// Índice de "submitting" no array acima (12) — é também a contagem de blocos
// "name".."consent" (0-11) que ainda autosalvam progresso ao avançar. O
// próprio "submitting" fica de fora: quando ele avança com sucesso, a conta
// já foi criada e complete_onboarding_impl já apagou a linha de
// onboarding_progress — salvar de novo aqui recriaria uma linha órfã que
// nunca mais seria lida (mesma armadilha que o M16 já evitava excluindo
// "calculating" do antigo DATA_BLOCK_COUNT).
export const DATA_BLOCK_COUNT = 12;
```

Por:
```ts
// Índice de "submitting" no array acima (13, depois de "body_fat" entrar
// entre "weight" e "activity") — é também a contagem de blocos
// "name".."consent" (0-12) que ainda autosalvam progresso ao avançar. O
// próprio "submitting" fica de fora: quando ele avança com sucesso, a conta
// já foi criada e complete_onboarding_impl já apagou a linha de
// onboarding_progress — salvar de novo aqui recriaria uma linha órfã que
// nunca mais seria lida (mesma armadilha que o M16 já evitava excluindo
// "calculating" do antigo DATA_BLOCK_COUNT).
export const DATA_BLOCK_COUNT = 13;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep -E "blocks.ts|BodyFatBlock"`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/onboarding/blocks.ts
git commit -m "feat(mobile): insere body_fat no array de onboarding, DATA_BLOCK_COUNT=13"
```

---

## Task 17: `GoalBlock` — sem `recomp`, copy sem %, `SliderInput`, sem scroll

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/GoalBlock.tsx`

**Interfaces:**
- Consumes: `SliderInput` (Task 12), `useOnboardingStore.body_fat_pct` (Task 10), `TargetsInput.body_fat_pct` (Task 2).

- [ ] **Step 1: Reescrever o arquivo inteiro**

```tsx
import { computeTargets } from "@fitbrother/shared";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { SliderInput } from "@/components/SliderInput";
import { projectGoalDate } from "@/lib/onboarding/projectGoalDate";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const OPTIONS = [
  { value: "lose", title: "Perder gordura", desc: "Você define o ritmo abaixo." },
  { value: "maintain", title: "Manter peso", desc: "Calorias = TDEE." },
  { value: "gain", title: "Ganhar massa", desc: "Você define o ritmo abaixo." },
] as const;

const DEFAULT_RATE_PCT: Record<"lose" | "gain", number> = { lose: 0.625, gain: 0.375 };

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function GoalBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const goal = useOnboardingStore((s) => s.goal);
  const weight_kg = useOnboardingStore((s) => s.weight_kg);
  const height_cm = useOnboardingStore((s) => s.height_cm);
  const sex = useOnboardingStore((s) => s.sex);
  const activity_level = useOnboardingStore((s) => s.activity_level);
  const body_fat_pct = useOnboardingStore((s) => s.body_fat_pct);
  const target_weight_kg = useOnboardingStore((s) => s.target_weight_kg);
  const rate_kg_per_week = useOnboardingStore((s) => s.rate_kg_per_week);
  const setField = useOnboardingStore((s) => s.setField);

  const showRateInputs = goal === "lose" || goal === "gain";
  const currentWeight = weight_kg ?? 70;
  const defaultTarget =
    goal === "lose" ? Math.max(30, currentWeight - 5) : Math.min(250, currentWeight + 5);
  const selectedTarget = target_weight_kg ?? defaultTarget;
  const defaultRate =
    goal === "lose" || goal === "gain"
      ? Math.round((DEFAULT_RATE_PCT[goal] / 100) * currentWeight * 10) / 10
      : 0.5;
  const selectedRate = rate_kg_per_week ?? Math.max(0.1, defaultRate);

  let projectedDateLabel: string | null = null;
  if (showRateInputs && sex && height_cm && activity_level && body_fat_pct !== undefined) {
    const targets = computeTargets({
      sex,
      age_years: 30, // só pro preview local — idade real não afeta ritmo/data projetada
      weight_kg: currentWeight,
      height_cm,
      activity_level,
      goal,
      body_fat_pct,
      target_weight_kg: selectedTarget,
      rate_kg_per_week: selectedRate,
    });
    const date = projectGoalDate(
      currentWeight,
      selectedTarget,
      targets.projected_rate_kg_per_week,
      new Date(),
    );
    projectedDateLabel = date ? fmtDate(date) : null;
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual seu objetivo?"
      subtitle="Define as metas iniciais de calorias e macros."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!goal}
      scrollable={false}
    >
      <View className="gap-5">
        <View accessibilityRole="radiogroup" className="gap-2">
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                void Haptics.selectionAsync();
                setField("goal", opt.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: goal === opt.value }}
              className={`min-h-[44px] rounded-xl border p-3 ${
                goal === opt.value
                  ? "border-[1.5px] border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <Text className="text-base font-sans-semibold text-neutral-800">{opt.title}</Text>
              <Text className="text-sm font-sans text-neutral-600">{opt.desc}</Text>
            </Pressable>
          ))}
        </View>

        {showRateInputs && (
          <View className="gap-3">
            <SliderInput
              label="Peso-alvo"
              min={30}
              max={250}
              step={0.5}
              value={selectedTarget}
              unit="kg"
              onChange={(v) => setField("target_weight_kg", v)}
            />
            <SliderInput
              label="Ritmo"
              min={0.1}
              max={1.0}
              step={0.1}
              value={selectedRate}
              unit="kg/semana"
              onChange={(v) => setField("rate_kg_per_week", v)}
            />
            {projectedDateLabel && (
              <Text
                className="text-center text-sm font-sans text-neutral-600"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                Nesse ritmo, você chega no peso-alvo em torno de {projectedDateLabel}.
              </Text>
            )}
          </View>
        )}
      </View>
    </OnboardingChapterShell>
  );
}
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep GoalBlock; npx eslint apps/mobile/components/onboarding/blocks/GoalBlock.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/GoalBlock.tsx
git commit -m "feat(mobile): GoalBlock sem recomposicao, SliderInput, sem scroll"
```

---

## Task 18: `CalculatingBlock` — passa `body_fat_pct`, guarda `targetsInput`

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx`

**Interfaces:**
- Consumes: `useOnboardingResultStore.setResult(result, targetsInput)` (Task 11).

- [ ] **Step 1: Editar o guard e a construção do input**

Substituir:
```tsx
    const s = useOnboardingStore.getState();
    // birth_date fica em DD/MM/AAAA no store (formato de digitação do
    // BasicsBlock) — precisa converter pra ISO antes de calcular idade,
    // mesma conversão que toPayload() já faz na submissão real.
    const birthDateIso = s.birth_date ? brDateToIso(s.birth_date) : null;
    if (
      !s.sex ||
      !birthDateIso ||
      s.weight_kg === undefined ||
      s.height_cm === undefined ||
      !s.activity_level ||
      !s.goal
    ) {
      // Faltou algo obrigatório de um bloco anterior — não deveria acontecer
      // (todos são required antes do goal), mas evita crash silencioso.
      onNext();
      return;
    }

    const targetsInput = {
      sex: s.sex,
      age_years: ageYearsFromBirthDate(birthDateIso),
      weight_kg: s.weight_kg,
      height_cm: s.height_cm,
      activity_level: s.activity_level,
      goal: s.goal,
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      is_pregnant_or_lactating: s.is_pregnant_or_lactating,
      has_kidney_disease: s.has_kidney_disease,
      has_type1_diabetes: s.has_type1_diabetes,
      uses_glp1: s.uses_glp1,
    };

    const targets = computeTargets(targetsInput);
    const gates = evaluateSafetyGates(targetsInput);
    const soft_mode = gates.some((g) => g.severity === "SOFT_MODE");

    setResult({
      kcal: targets.kcal,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      blocked: targets.blocked,
      block_reason: targets.block_reason,
      soft_mode,
    });
```

Por:
```tsx
    const s = useOnboardingStore.getState();
    // birth_date fica em DD/MM/AAAA no store (formato de digitação do
    // BasicsBlock) — precisa converter pra ISO antes de calcular idade,
    // mesma conversão que toPayload() já faz na submissão real.
    const birthDateIso = s.birth_date ? brDateToIso(s.birth_date) : null;
    if (
      !s.sex ||
      !birthDateIso ||
      s.weight_kg === undefined ||
      s.height_cm === undefined ||
      s.body_fat_pct === undefined ||
      !s.activity_level ||
      !s.goal
    ) {
      // Faltou algo obrigatório de um bloco anterior — não deveria acontecer
      // (todos são required antes do goal), mas evita crash silencioso.
      onNext();
      return;
    }

    const targetsInput = {
      sex: s.sex,
      age_years: ageYearsFromBirthDate(birthDateIso),
      weight_kg: s.weight_kg,
      height_cm: s.height_cm,
      activity_level: s.activity_level,
      goal: s.goal,
      body_fat_pct: s.body_fat_pct,
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      is_pregnant_or_lactating: s.is_pregnant_or_lactating,
      has_kidney_disease: s.has_kidney_disease,
      has_type1_diabetes: s.has_type1_diabetes,
      uses_glp1: s.uses_glp1,
    };

    const targets = computeTargets(targetsInput);
    const gates = evaluateSafetyGates(targetsInput);
    const soft_mode = gates.some((g) => g.severity === "SOFT_MODE");

    setResult(
      {
        kcal: targets.kcal,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        blocked: targets.blocked,
        block_reason: targets.block_reason,
        soft_mode,
      },
      targetsInput,
    );
```

- [ ] **Step 2: Typecheck e lint**

Run: `npx tsc --noEmit -p apps/mobile 2>&1 | grep CalculatingBlock; npx eslint apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/CalculatingBlock.tsx
git commit -m "feat(mobile): CalculatingBlock passa body_fat_pct e guarda targetsInput"
```

---

## Task 19: `RevealBlock` — proteína ajustável por slider

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/RevealBlock.tsx`

**Interfaces:**
- Consumes: `useOnboardingResultStore.targetsInput` (Task 11), `SliderInput` (Task 12), `useOnboardingStore.setField("protein_g_override", ...)` (Task 10), `computeTargets` (Task 4).

- [ ] **Step 1: Reescrever o arquivo inteiro**

```tsx
import { computeTargets } from "@fitbrother/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { SliderInput } from "@/components/SliderInput";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function RevealBlock({ onNext, chapter }: OnboardingBlockProps) {
  const result = useOnboardingResultStore((s) => s.result);
  const targetsInput = useOnboardingResultStore((s) => s.targetsInput);
  const setField = useOnboardingStore((s) => s.setField);
  const [proteinOverride, setProteinOverride] = useState<number | undefined>(undefined);

  const live = useMemo(() => {
    if (!targetsInput || !result) return null;
    if (proteinOverride === undefined) return result;
    const recomputed = computeTargets({ ...targetsInput, protein_g_override: proteinOverride });
    return {
      ...result,
      kcal: recomputed.kcal,
      protein_g: recomputed.protein_g,
      carbs_g: recomputed.carbs_g,
      fat_g: recomputed.fat_g,
    };
  }, [targetsInput, result, proteinOverride]);

  if (!result || !targetsInput || !live) {
    router.replace("/(auth)/welcome" as never);
    return null;
  }

  if (live.blocked) {
    return (
      <OnboardingChapterShell chapter={chapter} title="Ajustamos suas metas" showNav={false}>
        <View className="flex-1 justify-between gap-8">
          <Text className="text-center text-base font-sans text-neutral-600">
            {live.block_reason}
          </Text>
          <View className="gap-4">
            <GoalsDisclaimer />
            <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
          </View>
        </View>
      </OnboardingChapterShell>
    );
  }

  // Doença renal dosa proteína por peso total (restrição clínica) — o
  // slider não se aplica, computeTargets ignora protein_g_override nesse caso.
  const proteinAdjustable = targetsInput.has_kidney_disease !== true;
  const leanMass_kg = targetsInput.weight_kg * (1 - targetsInput.body_fat_pct / 100);
  const proteinMin = Math.round(leanMass_kg * 1.2);
  const proteinMax = Math.round(leanMass_kg * 3.0);

  return (
    <OnboardingChapterShell chapter={chapter} title="Suas metas estão prontas" showNav={false}>
      <View className="flex-1 justify-between gap-6">
        <View className="items-center gap-6">
          <Text
            className="text-5xl font-display-bold text-primary-500"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {fmtInt(live.kcal)} kcal
          </Text>
          <View className="flex-row gap-6">
            {!proteinAdjustable && (
              <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
                {fmtInt(live.protein_g)}g proteína
              </Text>
            )}
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(live.carbs_g)}g carbo
            </Text>
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(live.fat_g)}g gordura
            </Text>
          </View>
        </View>

        {proteinAdjustable && (
          <SliderInput
            label="Proteína"
            value={proteinOverride ?? result.protein_g}
            min={proteinMin}
            max={proteinMax}
            step={1}
            unit="g"
            markerValue={result.protein_g}
            onChange={(v) => {
              setProteinOverride(v);
              setField("protein_g_override", v === result.protein_g ? undefined : v);
            }}
          />
        )}

        <View className="gap-4">
          <GoalsDisclaimer />
          <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
```

- [ ] **Step 2: Typecheck e lint (workspace inteiro — fecha a cadeia dos Tasks 2-19)**

Run: `npm run typecheck --workspace apps/mobile && npm run lint --workspace apps/mobile`
Expected: PASS, zero erros.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/RevealBlock.tsx
git commit -m "feat(mobile): RevealBlock ganha slider de proteina ajustavel com marcador"
```

---

## Task 20: Verificação final

**Files:** nenhum (só validação).

- [ ] **Step 1: Typecheck e lint em todos os workspaces**

Run: `npm run typecheck --workspaces --if-present && npm run lint --workspaces --if-present`
Expected: PASS.

- [ ] **Step 2: Testes automatizados**

Run: `npm run test --workspace packages/shared && npm run test --workspace apps/mobile`
Expected: PASS em ambas as suítes.

- [ ] **Step 3: Verificação manual em browser (Expo web)**

Com os servidores de dev rodando (Supabase local + `apps/mobile` web), percorrer o fluxo completo de onboarding numa conta nova:
1. `/(auth)/welcome` → "Começar" → capítulo 1: nome, básicos, **altura via slider+input**, **peso via slider+input**, **% de gordura (ilustração e número exato)**, atividade.
2. Capítulo 2: objetivo — confirmar que só existem 3 opções (sem "Recomposição"), que "Perder gordura"/"Ganhar massa" não mostram mais percentual fixo, que peso-alvo/ritmo usam slider+input, e que a tela **não rola** em viewport padrão.
3. Capítulo 3: calculando → revelação — mexer no **slider de proteína**, confirmar que kcal fica fixo e carbo/gordura recalculam ao vivo, e que existe uma marcação visual no ponto recomendado.
4. Criar conta (signup/identity/consent) → confirmar no Network que `POST /onboarding/complete` retorna 201 com o `protein_g` ajustado (se o slider foi mexido) refletido na resposta.
5. Permissions/paywall/first_meal sem regressão.

Reportar qualquer bug encontrado e corrigir antes de finalizar.

- [ ] **Step 4: Finalizar**

Seguir superpowers:finishing-a-development-branch (verificar testes, ambiente, perguntar sobre push).
