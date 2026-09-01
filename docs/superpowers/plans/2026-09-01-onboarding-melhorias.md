# Melhorias no onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir avançar o onboarding com Enter, redesenhar o campo numérico dos sliders como stepper, e afrouxar os limites de peso-alvo e de ritmo mantendo as fórmulas existentes.

**Architecture:** Três frentes independentes. Em `packages/shared`, os limites de peso-alvo ficam mais folgados e ganha uma função nova `computeRateBounds` que deriva o teto de ritmo dos caps reais do backend (hoje o slider é fixo e o backend clampa em silêncio). Em `apps/mobile`, um hook chamado de dentro do `OnboardingChapterShell` cobre os 17 blocos com um único ponto de integração, e o `SliderInput` vira um stepper sem mudança de API.

**Tech Stack:** TypeScript · React Native / Expo Router · NativeWind v4 · vitest (`packages/shared`) · jest + `@testing-library/react-native` (`apps/mobile`)

## Global Constraints

Do `CLAUDE.md` — valem pra todo código novo neste plano:

- Nunca `font-medium`/`font-semibold`/`font-bold`. Use `font-sans`, `font-sans-medium`, `font-sans-semibold`, `font-sans-bold`, `font-sans-extrabold`.
- Todo valor numérico leva `style={{ fontVariant: ["tabular-nums"] }}`.
- Cores via token Tailwind, nunca hex inline em JSX. Exceção: importar de `lib/colors.ts` pra SVG/ícone.
- Hit target mínimo 44×44 pt em qualquer `Pressable`.
- `accessibilityLabel` obrigatório em botão só-ícone; `accessibilityRole` em interativos.
- Sem dark mode. Não usar `dark:`.
- Ícones só de `lucide-react-native`.
- Sem tags HTML. Use `View`, `Text`, `Pressable`.
- Migrations imutáveis — este plano não toca em `supabase/`.

Do ambiente de teste:

- `apps/mobile` roda `jest-expo` com `Platform.OS === "ios"` e **sem** `document` (`jest-environment-jsdom` não está instalado). Código que dependa de DOM precisa de um predicado puro testável separado do wrapper.
- `packages/shared` roda `vitest run`.
- Há `lint-staged` com `prettier --write` no commit — não brigar com formatação.

## Referência

Spec: `docs/superpowers/specs/2026-09-01-onboarding-melhorias-design.md`

## File Structure

**`packages/shared/src/targets/formulas.ts`** (modificar) — constantes de limite e as funções puras de limite. Recebe `MIN_HEALTHY_BODY_FAT_PCT` e `MAX_BMI_FOR_TARGET_WEIGHT` afrouxados, o piso de IMC em `computeTargetWeightBounds`, os caps `RATE_CAP_PCT`/`DEFICIT_CAP_PCT` vindos de `compute-targets.ts`, e a função nova `computeRateBounds`. É o arquivo de "quais são os limites".

**`packages/shared/src/targets/compute-targets.ts`** (modificar) — passa a importar os caps de `formulas.ts` em vez de declará-los. É o arquivo de "como os limites são aplicados".

**`apps/mobile/lib/onboarding/enterToContinue.ts`** (criar) — `shouldAdvanceOnEnter` (predicado puro) e `useEnterToContinue` (wrapper DOM). Separados porque o ambiente de teste não tem DOM.

**`apps/mobile/components/onboarding/OnboardingChapterShell.tsx`** (modificar) — chama o hook, ganha a prop `enterToContinue`.

**`apps/mobile/components/SliderInput.tsx`** (modificar) — stepper e alinhamento do teto na grade de passos.

**`apps/mobile/components/onboarding/blocks/GoalBlock.tsx`** (modificar) — consome `computeRateBounds`.

**`apps/mobile/components/onboarding/blocks/SignupBlock.tsx`** (modificar) — passa `enterToContinue={false}`.

---

### Task 1: Afrouxar os limites de peso-alvo

**Files:**
- Modify: `packages/shared/src/targets/formulas.ts:62-104`
- Test: `packages/shared/src/targets/formulas.test.ts:72-123`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `computeTargetWeightBounds` mantém a assinatura atual — `(input: { goal: "lose" | "gain"; weight_kg: number; height_cm: number; body_fat_pct: number; sex: Sex }) => { min: number; max: number }`.

Três mudanças no mesmo bloco de lógica: constantes mais folgadas, um piso novo de IMC, e arredondamento pra dentro do intervalo.

O piso de IMC existe porque hoje o mínimo termina em `Math.max(min, 1)` — literalmente 1kg. Um usuário magro consegue escolher um alvo que o gate `target_weight_underweight` bloqueia depois, no `RevealBlock`. Usa 18,6 e não 18,5 porque o gate compara com `bmiRounded1`, que arredonda pra uma casa: um alvo em IMC 18,54 arredondaria pra 18,5 e bloquearia.

- [ ] **Step 1: Atualizar os testes existentes de `computeTargetWeightBounds` pros valores novos**

Substituir o bloco `describe("computeTargetWeightBounds", ...)` inteiro em `packages/shared/src/targets/formulas.test.ts` por:

```ts
describe("computeTargetWeightBounds", () => {
  it("'perder gordura': teto é o peso atual, piso é a massa magra sobre o % saudável mínimo", () => {
    // massa magra = 90*(1-0.30) = 63; piso = 63/(1-0.08) = 68.478 -> 68.5
    const bounds = computeTargetWeightBounds({
      goal: "lose",
      weight_kg: 90,
      height_cm: 180,
      body_fat_pct: 30,
      sex: "male",
    });
    expect(bounds).toEqual({ min: 68.5, max: 90 });
  });

  it("'perder gordura': piso trava em peso-0.5 quando já abaixo do % saudável mínimo", () => {
    // 60kg a 9% ainda fica acima do piso de 8%, mas o piso por massa magra
    // (59.348) chega tão perto do peso atual que o guard de peso-0.5 é quem
    // decide — mantém min < max pro slider não inverter.
    const bounds = computeTargetWeightBounds({
      goal: "lose",
      weight_kg: 60,
      height_cm: 175,
      body_fat_pct: 9,
      sex: "male",
    });
    expect(bounds).toEqual({ min: 59.4, max: 60 });
  });

  it("'perder gordura': o piso de IMC 18,6 vence quando é mais alto que o piso por massa magra", () => {
    // 70kg a 1,80m com 12% de gordura: piso por massa magra = 61.6/0.92 =
    // 66.96; piso por IMC = 18.6*1.8² = 60.26. Vence a massa magra.
    // Já a 1,90m o piso por IMC sobe pra 67.15 e passa a vencer — é o caso
    // que impede o slider de oferecer um alvo que o gate bloqueia depois.
    const bounds = computeTargetWeightBounds({
      goal: "lose",
      weight_kg: 70,
      height_cm: 190,
      body_fat_pct: 12,
      sex: "male",
    });
    expect(bounds.min).toBeCloseTo(67.2, 1);
    expect(bounds.max).toBe(70);
  });

  it("'ganhar massa': piso é o peso atual, teto é o IMC 33 pra altura", () => {
    // 1,60m: teto = 33 * 1.6² = 84.48 -> arredonda pra dentro = 84.4
    const bounds = computeTargetWeightBounds({
      goal: "gain",
      weight_kg: 65,
      height_cm: 160,
      body_fat_pct: 25,
      sex: "female",
    });
    expect(bounds).toEqual({ min: 65, max: 84.4 });
  });

  it("'ganhar massa': teto trava em peso+0.5 quando já acima do IMC 33", () => {
    // 95kg a 1,70m: teto por IMC = 95.37, peso+0.5 = 95.5 — vence o maior
    // pra manter min < max.
    const bounds = computeTargetWeightBounds({
      goal: "gain",
      weight_kg: 95,
      height_cm: 170,
      body_fat_pct: 20,
      sex: "male",
    });
    expect(bounds).toEqual({ min: 95, max: 95.5 });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test --workspace @fitbrother/shared -- formulas`
Expected: FAIL. O primeiro caso deve reportar `{ min: 70, max: 90 }` recebido contra `{ min: 68.5, max: 90 }` esperado.

- [ ] **Step 3: Afrouxar as duas constantes**

Em `packages/shared/src/targets/formulas.ts`, substituir as declarações e os comentários acima delas por:

```ts
// % de gordura corporal mínimo saudável por sexo — piso do peso-alvo em
// "perder gordura". Abaixo do bucket mais magro das ilustrações de
// onboarding, deliberadamente: o corte das ilustrações é conservador demais
// pra servir de limite duro, e o gate de IMC <= 18,5 continua sendo a trava
// de segurança de verdade.
const MIN_HEALTHY_BODY_FAT_PCT: Record<Sex, number> = { male: 8, female: 14, other: 11 };
// Teto de IMC pro peso-alvo em "ganhar massa". Acima do corte de obesidade
// da OMS (30) porque o peso-alvo aqui é uma meta declarada, não um
// diagnóstico — 33 dá espaço pra builds atléticos sem virar terra de
// ninguém.
const MAX_BMI_FOR_TARGET_WEIGHT = 33;
// Piso de IMC pro peso-alvo em "perder gordura". 18,6 e não 18,5 porque o
// gate `target_weight_underweight` compara com `bmiRounded1`: um alvo em
// IMC 18,54 arredondaria pra 18,5 e bloquearia. Sem esse piso, o slider
// oferece valores que o próprio sistema recusa depois, no RevealBlock.
const MIN_BMI_FOR_TARGET_WEIGHT = 18.6;
```

- [ ] **Step 4: Reescrever `computeTargetWeightBounds` com o piso de IMC e arredondamento pra dentro**

Substituir o corpo da função (o `round1` local incluso) por:

```ts
export function computeTargetWeightBounds(input: {
  goal: "lose" | "gain";
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number;
  sex: Sex;
}): TargetWeightBounds {
  // Arredondamento pra DENTRO do intervalo: `Math.round` empurraria um
  // limite pra fora do valor real por até 0,05kg, que reaparece como um
  // clamp logo depois de o usuário arrastar até a ponta.
  const ceil1 = (n: number) => Math.ceil(n * 10) / 10;
  const floor1 = (n: number) => Math.floor(n * 10) / 10;
  const heightM = input.height_cm / 100;

  if (input.goal === "lose") {
    const leanMass_kg = input.weight_kg * (1 - input.body_fat_pct / 100);
    const minByLeanMass = leanMass_kg / (1 - MIN_HEALTHY_BODY_FAT_PCT[input.sex] / 100);
    const minByBmi = MIN_BMI_FOR_TARGET_WEIGHT * heightM * heightM;
    // O maior dos dois pisos manda. O `Math.min` com peso-0.5 depois é o
    // guard que mantém min < max pra quem já está no limite — esse usuário
    // é barrado pelo gate `current_bmi_underweight` de qualquer jeito.
    const floor = Math.max(minByLeanMass, minByBmi);
    const min = Math.min(floor, input.weight_kg - 0.5);
    return { min: ceil1(Math.max(min, 1)), max: floor1(input.weight_kg) };
  }

  const maxByBmi = MAX_BMI_FOR_TARGET_WEIGHT * heightM * heightM;
  const max = Math.max(maxByBmi, input.weight_kg + 0.5);
  return { min: ceil1(input.weight_kg), max: floor1(max) };
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test --workspace @fitbrother/shared -- formulas`
Expected: PASS, 5 casos em `computeTargetWeightBounds`.

- [ ] **Step 6: Rodar a suíte inteira de shared pra confirmar que nada mais quebrou**

Run: `npm test --workspace @fitbrother/shared`
Expected: PASS. `compute-targets.test.ts` e `gates.test.ts` não dependem dessas constantes.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/targets/formulas.ts packages/shared/src/targets/formulas.test.ts
git commit -m "feat(targets): afrouxa limites de peso-alvo e ancora o piso no IMC 18,6

%BF mínimo cai (H 10->8, M 17->14, O 13->11) e o teto de IMC sobe (30->33).

O piso de 'perder' passa a considerar também o IMC 18,6: antes ele terminava
em Math.max(min, 1), então um usuário magro conseguia escolher um alvo que o
gate target_weight_underweight bloqueava depois, no RevealBlock.

Os limites passam a arredondar pra dentro do intervalo — Math.round empurrava
o limite pra fora por até 0,05kg e o valor voltava clampado."
```

---

### Task 2: Mover os caps de ritmo e déficit pra `formulas.ts`

**Files:**
- Modify: `packages/shared/src/targets/formulas.ts`
- Modify: `packages/shared/src/targets/compute-targets.ts:16-18`

**Interfaces:**
- Consumes: Task 1 (mesmo arquivo `formulas.ts`, sem sobreposição de linhas).
- Produces: `RATE_CAP_PCT` e `DEFICIT_CAP_PCT` exportados de `formulas.ts`, ambos `Record<"lose" | "gain", number>`. Task 4 depende deles.

Refactor puro, sem mudança de comportamento. Os caps precisam ser importáveis por `computeRateBounds` (Task 4); mantê-los privados em `compute-targets.ts` faria o slider e o cálculo divergirem na primeira vez que alguém mexesse num só.

`RATE_DEFAULT_PCT` fica onde está — só `computeTargets` usa.

- [ ] **Step 1: Mover as duas constantes pra `formulas.ts`**

Em `packages/shared/src/targets/formulas.ts`, adicionar logo abaixo de `MIN_BMI_FOR_TARGET_WEIGHT`:

```ts
/** Teto de ritmo como % do peso corporal por semana, por direção. Exportado
 * porque o slider de ritmo do onboarding precisa do mesmo número que
 * `computeTargets` aplica — se divergirem, o slider promete o que o cálculo
 * não entrega. */
export const RATE_CAP_PCT: Record<"lose" | "gain", number> = { lose: 1.0, gain: 0.5 };
/** Teto de déficit/superávit como % do GET, por direção. Na prática é este
 * que trava, não o RATE_CAP_PCT — ver computeRateBounds. */
export const DEFICIT_CAP_PCT: Record<"lose" | "gain", number> = { lose: 25, gain: 15 };
```

- [ ] **Step 2: Importar em `compute-targets.ts` e remover as declarações locais**

Em `packages/shared/src/targets/compute-targets.ts`, remover as linhas 16 e 18 (`RATE_CAP_PCT` e `DEFICIT_CAP_PCT` locais, mantendo `RATE_DEFAULT_PCT` na 17), e adicionar os dois nomes ao import que já existe de `./formulas.js`:

```ts
import {
  calculateBmr,
  calculateTdee,
  deficitKcalPerDayToRateKgPerWeek,
  DEFICIT_CAP_PCT,
  fiberTargetG,
  percentOfWeightPerWeekToRateKgPerWeek,
  RATE_CAP_PCT,
  rateToDeficitKcalPerDay,
} from "./formulas.js";
```

- [ ] **Step 3: Rodar a suíte inteira e confirmar que passa sem edição de teste**

Run: `npm test --workspace @fitbrother/shared`
Expected: PASS, sem nenhuma mudança de teste. É o que prova que o refactor não mudou comportamento.

- [ ] **Step 4: Rodar o typecheck**

Run: `npm run typecheck --workspace @fitbrother/shared`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/targets/formulas.ts packages/shared/src/targets/compute-targets.ts
git commit -m "refactor(targets): move RATE_CAP_PCT e DEFICIT_CAP_PCT pra formulas.ts

Sem mudança de comportamento. O slider de ritmo do onboarding vai precisar
dos mesmos caps que computeTargets aplica — uma fonte só evita que os dois
divirjam."
```

---

### Task 3: Afrouxar os caps de ritmo e déficit

**Files:**
- Modify: `packages/shared/src/targets/formulas.ts`
- Test: `packages/shared/src/targets/compute-targets.test.ts:5-53,166-194`

**Interfaces:**
- Consumes: Task 2 (`RATE_CAP_PCT`, `DEFICIT_CAP_PCT` em `formulas.ts`).
- Produces: nenhuma assinatura nova. Task 4 lê os valores novos.

Subir o cap de déficit de 25% pra 30% do GET é o que efetivamente destrava a folga em "perder" — o cap de %/semana quase nunca é o que trava. Decisão de produto tomada com os pisos clínicos (TMB, piso absoluto de kcal, gates) intactos por baixo.

Isso muda o resultado de dois testes existentes de forma substantiva. Ler o Step 1 com atenção: o Caso 1 **deixa de ser** um caso de clamp, então ele é reescrito e um caso de clamp novo é adicionado no lugar pra não perder cobertura.

- [ ] **Step 1: Atualizar o Caso 1 de `compute-targets.test.ts`**

Com o cap em 30%, o déficit pedido de 0,5 kg/semana (26,84% do GET) deixa de ser clampado. Substituir o `describe("computeTargets — Caso 1 ...")` inteiro por dois blocos:

```ts
describe("computeTargets — Caso 1 (dentro dos caps, piso de gordura ativo)", () => {
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

  it("TMB ≈ 1490 e GET ≈ 2049", () => {
    expect(result.bmr_kcal).toBeCloseTo(1490.25, 2);
    expect(result.tdee_kcal).toBeCloseTo(2049.09, 2);
  });

  it("0,5 kg/semana = 26,8% do GET: dentro do cap de 30%, sem clamp nenhum", () => {
    expect(result.kcal).toBeCloseTo(1499.09, 2);
    expect(result.warnings.some((w) => w.code === "deficit_clamped")).toBe(false);
    expect(result.warnings.some((w) => w.code === "rate_clamped")).toBe(false);
  });

  it("proteína 2,2 g/kg de massa magra (78kg * 70% = 54,6kg) = 120,12 g", () => {
    expect(result.protein_g).toBeCloseTo(120.12, 2);
  });

  it("gordura: piso de 0,6g/kg vence o percentual", () => {
    expect(result.fat_g).toBeCloseTo(46.8, 2);
  });

  it("carboidrato ≈ 149,35 g", () => {
    expect(result.carbs_g).toBeCloseTo(149.35, 2);
  });

  it("fibra ≈ 20,99 g", () => {
    expect(result.fiber_g).toBeCloseTo(20.99, 2);
  });

  it("ritmo projetado = o pedido, já que nada foi clampado", () => {
    expect(result.projected_rate_kg_per_week).toBeCloseTo(0.5, 2);
  });

  it("não está bloqueado", () => {
    expect(result.blocked).toBe(false);
    expect(result.block_reason).toBeNull();
  });
});

describe("computeTargets — Caso 1b (déficit clampado no teto de 30%)", () => {
  // Mesma pessoa do Caso 1 pedindo 0,8 kg/semana: 42,9% do GET, acima do
  // teto de 30%. Fica abaixo do cap de ritmo (1,25% * 78 = 0,975), então
  // isola o clamp de déficit.
  const result = computeTargets({
    sex: "female",
    age_years: 32,
    weight_kg: 78,
    height_cm: 165,
    activity_level: "light",
    goal: "lose",
    rate_kg_per_week: 0.8,
    body_fat_pct: 30,
  });

  it("emite deficit_clamped e não rate_clamped", () => {
    expect(result.warnings.some((w) => w.code === "deficit_clamped")).toBe(true);
    expect(result.warnings.some((w) => w.code === "rate_clamped")).toBe(false);
  });

  it("o clamp de 30% derruba kcal abaixo da TMB, então a TMB vira o piso", () => {
    expect(result.kcal).toBeCloseTo(1490.25, 2);
    expect(result.warnings.some((w) => w.code === "below_bmr")).toBe(true);
  });
});
```

- [ ] **Step 2: Atualizar os dois testes de direção "ganho"**

No `describe("computeTargets — direção ganho", ...)`, substituir os dois `it` por:

```ts
  it("clampa ritmo de ganho acima do teto (0.75%/semana)", () => {
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "moderate",
      goal: "gain",
      rate_kg_per_week: 1.0, // acima do teto de 0.75% * 80kg = 0.6kg/semana
      body_fat_pct: 15,
    });
    expect(result.warnings.some((w) => w.code === "rate_clamped")).toBe(true);
  });

  it("clampa superávit acima de 20% do TDEE", () => {
    // 0.5 kg/semana = 550 kcal/dia = 25,4% do GET de 2166. Fica abaixo do
    // cap de ritmo (0.6), então isola o clamp de superávit.
    const result = computeTargets({
      sex: "male",
      age_years: 25,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "sedentary",
      goal: "gain",
      rate_kg_per_week: 0.5,
      body_fat_pct: 15,
    });
    expect(result.warnings.some((w) => w.code === "surplus_clamped")).toBe(true);
    expect(result.warnings.some((w) => w.code === "rate_clamped")).toBe(false);
  });
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm test --workspace @fitbrother/shared -- compute-targets`
Expected: FAIL. O Caso 1 deve reportar `kcal` 1536.82 recebido contra 1499.09 esperado, e `deficit_clamped` true contra false.

- [ ] **Step 4: Afrouxar as duas constantes**

Em `packages/shared/src/targets/formulas.ts`, trocar os valores (mantendo os comentários da Task 2):

```ts
export const RATE_CAP_PCT: Record<"lose" | "gain", number> = { lose: 1.25, gain: 0.75 };
export const DEFICIT_CAP_PCT: Record<"lose" | "gain", number> = { lose: 30, gain: 20 };
```

- [ ] **Step 5: Rodar a suíte inteira e confirmar que passa**

Run: `npm test --workspace @fitbrother/shared`
Expected: PASS. O teste `very_low_carb` continua verde — 200kg a 1,60m sedentário cai no piso da TMB nos dois cenários de cap.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/targets/formulas.ts packages/shared/src/targets/compute-targets.test.ts
git commit -m "feat(targets): afrouxa os caps de ritmo e de déficit

Ritmo 1,0->1,25%/sem (perder) e 0,5->0,75%/sem (ganhar). Déficit 25->30% do
GET e superávit 15->20%.

O cap de déficit é o que trava na prática em quase todo caso de 'perder' — o
cap de %/semana raramente chega a valer. Sem mexer nele, afrouxar o ritmo não
mudaria nada. TMB, piso absoluto de kcal e os gates de segurança continuam
intactos por baixo.

O Caso 1 do teste deixou de ser um caso de clamp; virou Caso 1 (sem clamp) +
Caso 1b (clamp de déficit isolado) pra não perder cobertura."
```

---

### Task 4: `computeRateBounds`

**Files:**
- Modify: `packages/shared/src/targets/formulas.ts`
- Test: `packages/shared/src/targets/formulas.test.ts`

**Interfaces:**
- Consumes: Task 2 (`RATE_CAP_PCT`, `DEFICIT_CAP_PCT`), Task 3 (valores afrouxados), e as funções já existentes `calculateBmr`, `calculateTdee`, `deficitKcalPerDayToRateKgPerWeek`, `percentOfWeightPerWeekToRateKgPerWeek`.
- Produces: `computeRateBounds(input: { goal: "lose" | "gain"; sex: Sex; age_years: number; weight_kg: number; height_cm: number; activity_level: ActivityLevel }) => { min: number; max: number }`. Task 7 (`GoalBlock`) consome. Exportado automaticamente pelo `export * from "./formulas.js"` que já existe em `targets/index.ts`.

O teste central é um invariante, não um valor fixo: pra uma grade de perfis, `computeTargets` chamado com `rate_kg_per_week = bounds.max` não pode emitir `rate_clamped` nem `deficit_clamped`. É isso que garante que o slider parou de prometer o que o backend não entrega.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao fim de `packages/shared/src/targets/formulas.test.ts`. Note o import novo de `computeTargets`, que vem de outro arquivo:

```ts
describe("computeRateBounds", () => {
  const PERFIS = [
    { goal: "lose", sex: "female", age_years: 30, weight_kg: 60, height_cm: 165, activity_level: "moderate" },
    { goal: "lose", sex: "male", age_years: 30, weight_kg: 80, height_cm: 180, activity_level: "moderate" },
    { goal: "lose", sex: "male", age_years: 40, weight_kg: 110, height_cm: 180, activity_level: "sedentary" },
    { goal: "lose", sex: "other", age_years: 55, weight_kg: 95, height_cm: 172, activity_level: "very_active" },
    { goal: "gain", sex: "male", age_years: 25, weight_kg: 70, height_cm: 178, activity_level: "active" },
    { goal: "gain", sex: "female", age_years: 22, weight_kg: 52, height_cm: 160, activity_level: "light" },
  ] as const;

  // O invariante que motiva a função existir: hoje o slider é fixo em
  // 0.1-1.0 kg/semana enquanto o cap real de déficit trava bem antes disso,
  // e o backend clampa em silêncio. O teto do slider tem que ser um valor
  // que passa pelo cálculo sem ser clampado.
  it.each(PERFIS)(
    "o teto passa por computeTargets sem clamp ($goal $weight_kg kg $activity_level)",
    (perfil) => {
      const bounds = computeRateBounds(perfil);
      const result = computeTargets({ ...perfil, body_fat_pct: 20, rate_kg_per_week: bounds.max });
      expect(result.warnings.map((w) => w.code)).not.toContain("rate_clamped");
      expect(result.warnings.map((w) => w.code)).not.toContain("deficit_clamped");
      expect(result.warnings.map((w) => w.code)).not.toContain("surplus_clamped");
    },
  );

  it.each(PERFIS)("o teto nunca fica abaixo do piso ($goal $weight_kg kg)", (perfil) => {
    const bounds = computeRateBounds(perfil);
    expect(bounds.min).toBe(0.1);
    expect(bounds.max).toBeGreaterThanOrEqual(bounds.min);
  });

  it("o teto é o cap de déficit, não o de percentual do peso, num caso típico de perda", () => {
    // 80kg 1,80m 30a moderado: cap por peso = 1,25% * 80 = 1,0 kg/semana,
    // cap por déficit = 30% de 2759 kcal = 0,75 kg/semana. Vence o menor.
    const bounds = computeRateBounds({
      goal: "lose",
      sex: "male",
      age_years: 30,
      weight_kg: 80,
      height_cm: 180,
      activity_level: "moderate",
    });
    expect(bounds.max).toBeCloseTo(0.75, 2);
  });

  it("garante o piso de 0,1 mesmo num perfil com GET muito baixo", () => {
    const bounds = computeRateBounds({
      goal: "lose",
      sex: "female",
      age_years: 80,
      weight_kg: 38,
      height_cm: 145,
      activity_level: "sedentary",
    });
    expect(bounds.max).toBeGreaterThanOrEqual(0.1);
  });
});
```

Atualizar o import no topo do arquivo pra incluir `computeRateBounds`, e adicionar um import novo abaixo dele:

```ts
import { computeTargets } from "./compute-targets.js";
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test --workspace @fitbrother/shared -- formulas`
Expected: FAIL com `computeRateBounds is not a function` (ou erro de import).

- [ ] **Step 3: Implementar `computeRateBounds`**

Adicionar ao fim de `packages/shared/src/targets/formulas.ts`:

```ts
export type RateBounds = { min: number; max: number };

/**
 * Limites do slider de ritmo no onboarding.
 *
 * `computeTargets` aplica dois tetos: um percentual do peso corporal
 * (`RATE_CAP_PCT`) e um percentual do GET (`DEFICIT_CAP_PCT`). Na prática é
 * o segundo que trava em quase todo caso de "perder" — o primeiro raramente
 * chega a valer. Um slider com faixa fixa deixa o usuário escolher acima do
 * efetivo e o cálculo clampa em silêncio, com um warning que a UI não
 * mostra. Aqui o teto é o menor dos dois, então o que o slider oferece é o
 * que o cálculo entrega.
 */
export function computeRateBounds(input: {
  goal: "lose" | "gain";
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
  activity_level: ActivityLevel;
}): RateBounds {
  const min = 0.1;
  const tdee = calculateTdee(calculateBmr(input), input.activity_level);
  const capByWeight = percentOfWeightPerWeekToRateKgPerWeek(
    RATE_CAP_PCT[input.goal],
    input.weight_kg,
  );
  const capByDeficit = deficitKcalPerDayToRateKgPerWeek(
    (DEFICIT_CAP_PCT[input.goal] / 100) * tdee,
  );
  // Arredonda pra baixo: pra cima devolveria um teto que o próprio
  // computeTargets clamparia de volta.
  const max = Math.floor(Math.min(capByWeight, capByDeficit) * 100) / 100;
  return { min, max: Math.max(min, max) };
}
```

Confirmar que `ActivityLevel` está no import de tipos no topo do arquivo — hoje ele importa `import type { ActivityLevel, Sex } from "./types.js";`, então já está.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test --workspace @fitbrother/shared -- formulas`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira e o typecheck**

Run: `npm test --workspace @fitbrother/shared && npm run typecheck --workspace @fitbrother/shared`
Expected: PASS, sem erros de tipo.

Atenção a import circular: `formulas.test.ts` agora importa `compute-targets.js`, que importa `formulas.js`. Isso é o teste importando os dois — não é ciclo entre os módulos de produção. `formulas.ts` **não** pode importar `compute-targets.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/targets/formulas.ts packages/shared/src/targets/formulas.test.ts
git commit -m "feat(targets): computeRateBounds derivado dos caps reais

O teto é o menor entre o cap de %/semana e o cap de déficit sobre o GET —
o mesmo par que computeTargets aplica.

O teste central é um invariante: pra uma grade de perfis, computeTargets
chamado com rate = bounds.max não emite rate_clamped nem deficit_clamped.
É o que garante que o slider parou de prometer o que o cálculo não entrega."
```

---

### Task 5: `useEnterToContinue`

**Files:**
- Create: `apps/mobile/lib/onboarding/enterToContinue.ts`
- Test: `apps/mobile/lib/onboarding/enterToContinue.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `shouldAdvanceOnEnter(event: EnterCandidate) => boolean` e `useEnterToContinue(options: { onNext?: () => void; disabled?: boolean; enabled?: boolean }) => void`. Task 6 (`OnboardingChapterShell`) consome o hook.

O ambiente de teste (`jest-expo`) roda com `Platform.OS === "ios"` e **sem** `document`. Por isso a decisão fica num predicado puro, testável sem DOM, e o hook é um wrapper fino guardado por `typeof document === "undefined"` — que é também a checagem honesta, já que o que o hook precisa é de DOM, não de uma plataforma específica.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/mobile/lib/onboarding/enterToContinue.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import { shouldAdvanceOnEnter } from "./enterToContinue";

/** Alvo que imita o `closest` do DOM: casa se o seletor pedido estiver na
 * lista que o teste declarou. */
function target(matches: string[] = []) {
  return {
    closest: (selector: string) =>
      matches.some((m) => selector.includes(m)) ? ({} as unknown) : null,
  };
}

describe("shouldAdvanceOnEnter", () => {
  test("avança no Enter puro sobre um alvo neutro", () => {
    expect(shouldAdvanceOnEnter({ key: "Enter", target: target() })).toBe(true);
  });

  test("ignora qualquer tecla que não seja Enter", () => {
    expect(shouldAdvanceOnEnter({ key: "a", target: target() })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: " ", target: target() })).toBe(false);
  });

  test.each(["shiftKey", "metaKey", "ctrlKey", "altKey"] as const)(
    "ignora Enter com %s",
    (modifier) => {
      expect(shouldAdvanceOnEnter({ key: "Enter", target: target(), [modifier]: true })).toBe(
        false,
      );
    },
  );

  // O Pressable do React Native Web vira <div role="button" tabindex="0"> e
  // já dispara onPress no Enter sozinho. Sem essa exclusão, Enter com foco
  // no "Voltar" voltaria E avançaria.
  test.each(['role="button"', 'role="link"', 'role="checkbox"', 'role="radio"', "button", "a"])(
    "ignora Enter quando o alvo está dentro de %s",
    (selector) => {
      expect(shouldAdvanceOnEnter({ key: "Enter", target: target([selector]) })).toBe(false);
    },
  );

  // O MealComposer usa TextInput multiline, que vira <textarea>. Enter ali
  // é quebra de linha.
  test("ignora Enter dentro de textarea", () => {
    expect(shouldAdvanceOnEnter({ key: "Enter", target: target(["textarea"]) })).toBe(false);
  });

  test("avança quando o alvo não sabe fazer closest", () => {
    expect(shouldAdvanceOnEnter({ key: "Enter", target: null })).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test --workspace @fitbrother/mobile -- enterToContinue`
Expected: FAIL — não consegue resolver `./enterToContinue`.

Pra rodar um teste isolado, também dá de `apps/mobile` com `npx jest lib/onboarding/enterToContinue.test.ts --runInBand`.

- [ ] **Step 3: Implementar o predicado e o hook**

Criar `apps/mobile/lib/onboarding/enterToContinue.ts`:

```ts
import { useEffect, useRef } from "react";

/** Elementos que já tratam Enter sozinhos. O Pressable do React Native Web
 * vira `<div role="button" tabindex="0">` e dispara onPress no Enter — sem
 * essa exclusão, Enter com foco no botão "Voltar" voltaria e avançaria na
 * mesma tecla. `textarea` é o TextInput multiline do MealComposer, onde
 * Enter é quebra de linha. */
const SELF_HANDLED_SELECTOR =
  '[role="button"], [role="link"], [role="checkbox"], [role="radio"], a, button, textarea';

export interface EnterCandidate {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target: unknown;
}

/** Decisão pura, separada do hook porque o ambiente de teste do app não tem
 * DOM (`jest-expo` sem jsdom). */
export function shouldAdvanceOnEnter(event: EnterCandidate): boolean {
  if (event.key !== "Enter") return false;
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;

  const target = event.target as { closest?: (selector: string) => unknown } | null;
  if (typeof target?.closest === "function" && target.closest(SELF_HANDLED_SELECTOR)) {
    return false;
  }
  return true;
}

/**
 * Enter avança a etapa do onboarding. Só faz efeito onde existe DOM — em
 * nativo o teclado físico não é o caminho principal e `document` não existe.
 */
export function useEnterToContinue({
  onNext,
  disabled,
  enabled = true,
}: {
  onNext?: () => void;
  disabled?: boolean;
  enabled?: boolean;
}): void {
  // Os valores entram por ref pra não re-registrar o listener a cada
  // digitação — o shell re-renderiza a cada tecla nos blocos com campo.
  const state = useRef({ onNext, disabled, enabled });
  state.current = { onNext, disabled, enabled };

  useEffect(() => {
    if (typeof document === "undefined") return;

    function handleKeyDown(event: KeyboardEvent) {
      const { onNext, disabled, enabled } = state.current;
      if (!enabled || !onNext) return;
      if (!shouldAdvanceOnEnter(event)) return;

      event.preventDefault();
      // O campo numérico do SliderInput faz o commit (parse + clamp) no
      // onBlur. Sem esse blur, digitar 185 e apertar Enter avançaria com o
      // valor antigo ainda no store.
      const active = document.activeElement as { blur?: () => void } | null;
      active?.blur?.();

      // Um frame pro React reconciliar o commit antes de reler `disabled` —
      // ler no mesmo tick pegaria o valor pré-blur.
      requestAnimationFrame(() => {
        const current = state.current;
        if (current.enabled && current.onNext && !current.disabled) current.onNext();
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run (de `apps/mobile`): `npx jest lib/onboarding/enterToContinue.test.ts --runInBand`
Expected: PASS, todos os casos.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/onboarding/enterToContinue.ts apps/mobile/lib/onboarding/enterToContinue.test.ts
git commit -m "feat(onboarding): hook de Enter para avançar

A decisão fica num predicado puro porque o ambiente de teste do app roda sem
DOM. O hook é o wrapper fino, guardado por typeof document.

Exclui os elementos que já tratam Enter sozinhos — Pressable do RN Web vira
role=button e dispararia onPress e o avanço na mesma tecla."
```

---

### Task 6: Ligar o Enter no shell

**Files:**
- Modify: `apps/mobile/components/onboarding/OnboardingChapterShell.tsx:18-47`
- Modify: `apps/mobile/components/onboarding/blocks/SignupBlock.tsx:184-191`

**Interfaces:**
- Consumes: Task 5 (`useEnterToContinue`).
- Produces: `OnboardingChapterShellProps` ganha `enterToContinue?: boolean` (default `true`).

Um ponto de integração cobre os 17 blocos porque o shell já é dono de `onNext` e `nextDisabled`.

- [ ] **Step 1: Adicionar a prop e chamar o hook**

Em `apps/mobile/components/onboarding/OnboardingChapterShell.tsx`, adicionar ao final da interface `OnboardingChapterShellProps`:

```ts
  /** false pros blocos que já tratam Enter melhor por conta própria — hoje
   * só o SignupBlock, que encadeia e-mail -> senha -> confirmar -> submit
   * com returnKeyType. */
  enterToContinue?: boolean;
```

Adicionar `enterToContinue = true,` à desestruturação dos props, junto com os outros defaults.

Adicionar o import:

```ts
import { useEnterToContinue } from "@/lib/onboarding/enterToContinue";
```

E chamar o hook logo depois de `const reducedMotion = useReducedMotion();`:

```ts
  useEnterToContinue({ onNext, disabled: nextDisabled, enabled: enterToContinue && showNav });
```

O `&& showNav` cobre `CalculatingBlock`, `RevealBlock` e `SubmittingBlock`, que passam `showNav={false}`: sem botão "Continuar" visível, Enter não deve avançar.

- [ ] **Step 2: Fazer o `SignupBlock` optar por fora**

Em `apps/mobile/components/onboarding/blocks/SignupBlock.tsx`, adicionar a prop no `OnboardingChapterShell`:

```tsx
    <OnboardingChapterShell
      chapter={chapter}
      title="Crie sua conta"
      subtitle="Pra salvar as metas que você acabou de ver e continuar de onde parou."
      onBack={onBack}
      onNext={handleSubmit}
      nextDisabled={!canSubmit}
      enterToContinue={false}
    >
```

Justificativa pro comentário do commit: o bloco já encadeia `returnKeyType="next"` no e-mail e na senha focando o próximo campo, e `returnKeyType="go"` no confirmar chamando `handleSubmit`. Um handler global de "Enter submete de qualquer campo" substituiria isso por um comportamento pior.

- [ ] **Step 3: Rodar typecheck e lint**

Run: `npm run typecheck --workspace @fitbrother/mobile`
Run (da raiz do repo): `npm run lint`
Expected: sem erros. O `lint` só existe na raiz — não há script `lint` no workspace mobile.

- [ ] **Step 4: Rodar a suíte de testes do app**

Run: `npm test --workspace @fitbrother/mobile`
Expected: PASS. Os testes de componente existentes não montam o shell, então nada deve mudar.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/onboarding/OnboardingChapterShell.tsx apps/mobile/components/onboarding/blocks/SignupBlock.tsx
git commit -m "feat(onboarding): Enter avança a etapa

O shell já é dono de onNext e nextDisabled, então um ponto cobre os 17
blocos. Blocos com showNav={false} ficam de fora automaticamente.

SignupBlock opta por fora: ele já encadeia e-mail -> senha -> confirmar ->
submit com returnKeyType, que é o comportamento certo pra um formulário de
três campos."
```

---

### Task 7: `SliderInput` como stepper

**Files:**
- Modify: `apps/mobile/components/SliderInput.tsx`
- Test: `apps/mobile/components/SliderInput.test.tsx` (criar)

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `SliderInputProps` inalterada — `{ label, value, min, max, step, unit?, markerValue?, onChange }`. Nenhum consumidor muda por causa desta tarefa.

O `TextInput` solto vira `−  [170 cm]  +` na mesma posição. O teto também passa a ser alinhado na grade de passos, senão os limites calculados da Task 4 (ex. `max = 0.75` com `min = 0.1` e `step = 0.05`) deixariam o slider parando antes do máximo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/mobile/components/SliderInput.test.tsx`:

```tsx
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { SliderInput } from "./SliderInput";

function setup(overrides: Partial<React.ComponentProps<typeof SliderInput>> = {}) {
  const onChange = jest.fn();
  const utils = render(
    <SliderInput
      label="Altura"
      value={170}
      min={120}
      max={220}
      step={1}
      unit="cm"
      onChange={onChange}
      {...overrides}
    />,
  );
  return { ...utils, onChange };
}

describe("SliderInput — stepper", () => {
  test("os botões têm rótulo acessível derivado do label", () => {
    const { getByLabelText } = setup();
    expect(getByLabelText("Diminuir altura")).toBeTruthy();
    expect(getByLabelText("Aumentar altura")).toBeTruthy();
  });

  test("+ avança um passo e − recua um passo", () => {
    const { getByLabelText, onChange } = setup();
    fireEvent.press(getByLabelText("Aumentar altura"));
    expect(onChange).toHaveBeenCalledWith(171);

    onChange.mockClear();
    fireEvent.press(getByLabelText("Diminuir altura"));
    expect(onChange).toHaveBeenCalledWith(169);
  });

  test("respeita o step fracionário sem sujeira de ponto flutuante", () => {
    const { getByLabelText, onChange } = setup({ value: 0.5, min: 0.1, max: 1, step: 0.05 });
    fireEvent.press(getByLabelText("Aumentar altura"));
    expect(onChange).toHaveBeenCalledWith(0.55);
  });

  test("− fica desabilitado no mínimo e não chama onChange", () => {
    const { getByLabelText, onChange } = setup({ value: 120 });
    const botao = getByLabelText("Diminuir altura");
    expect(botao.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(botao);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("+ fica desabilitado no máximo alcançável e não chama onChange", () => {
    const { getByLabelText, onChange } = setup({ value: 220 });
    const botao = getByLabelText("Aumentar altura");
    expect(botao.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(botao);
    expect(onChange).not.toHaveBeenCalled();
  });

  // Os limites calculados (computeRateBounds, computeTargetWeightBounds) não
  // caem na grade min + n*step. Sem alinhar, o usuário arrasta até o fim e
  // para antes do máximo.
  test("o + para no maior múltiplo de step que cabe no max", () => {
    const { getByLabelText, onChange } = setup({ value: 0.7, min: 0.1, max: 0.75, step: 0.05 });
    fireEvent.press(getByLabelText("Aumentar altura"));
    expect(onChange).toHaveBeenCalledWith(0.75);

    onChange.mockClear();
    const noTeto = setup({ value: 0.73, min: 0.1, max: 0.73, step: 0.05 });
    fireEvent.press(noTeto.getByLabelText("Aumentar altura"));
    expect(noTeto.onChange).not.toHaveBeenCalled();
  });

  test("o campo de texto continua commitando no blur, com clamp", () => {
    const { getByLabelText, onChange } = setup();
    const campo = getByLabelText("Altura — valor exato");
    fireEvent.changeText(campo, "999");
    fireEvent(campo, "blur");
    expect(onChange).toHaveBeenCalledWith(220);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run (de `apps/mobile`): `npx jest components/SliderInput.test.tsx --runInBand`
Expected: FAIL — `getByLabelText("Diminuir altura")` não encontra nada.

- [ ] **Step 3: Reescrever o `SliderInput`**

Substituir `apps/mobile/components/SliderInput.tsx` inteiro por:

```tsx
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
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

// Só dígitos, vírgula e ponto — barra letras/símbolos antes mesmo de entrar no campo.
function sanitizeNumericText(raw: string): string {
  return raw.replace(/[^0-9.,]/g, "");
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
  const [clampMessage, setClampMessage] = useState<string | null>(null);

  // O Slider snapa em min + n*step, e os limites calculados (peso-alvo,
  // ritmo) raramente caem nessa grade. Sem alinhar, o usuário arrasta até o
  // fim e para antes do máximo. O campo de texto continua aceitando o `max`
  // exato — quem quiser o valor de ponta digita.
  const gridMax = min + Math.floor((max - min) / step) * step;

  // Sincroniza o texto quando o valor muda por fora (slider, stepper, ou
  // outro campo reagindo) — mas não enquanto o usuário está digitando.
  useEffect(() => {
    if (!focused) setText(value.toFixed(decimals));
  }, [value, decimals, focused]);

  function handleChangeText(raw: string) {
    setClampMessage(null);
    setText(sanitizeNumericText(raw));
  }

  function commit(raw: string) {
    const parsed = Number(raw.replace(",", "."));
    const next = Number.isNaN(parsed) ? value : Math.min(max, Math.max(min, parsed));
    setClampMessage(
      !Number.isNaN(parsed) && parsed !== next
        ? next === min
          ? `Ajustado para o mínimo (${min}${unit ?? ""}).`
          : `Ajustado para o máximo (${max}${unit ?? ""}).`
        : null,
    );
    onChange(Number(next.toFixed(decimals)));
    setText(next.toFixed(decimals));
  }

  const canDecrement = value > min;
  const canIncrement = value < gridMax;

  function nudge(direction: 1 | -1) {
    const next = Math.min(gridMax, Math.max(min, value + direction * step));
    if (next === value) return;
    void Haptics.selectionAsync();
    setClampMessage(null);
    onChange(Number(next.toFixed(decimals)));
  }

  const markerPct =
    markerValue !== undefined ? ((markerValue - min) / (max - min)) * 100 : undefined;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-sans-medium text-neutral-700">{label}</Text>
        <View className="flex-row items-center">
          <Pressable
            onPress={canDecrement ? () => nudge(-1) : undefined}
            disabled={!canDecrement}
            accessibilityRole="button"
            accessibilityLabel={`Diminuir ${label.toLowerCase()}`}
            accessibilityState={{ disabled: !canDecrement }}
            className={`h-11 w-11 items-center justify-center rounded-l-full border border-neutral-200 bg-white active:bg-neutral-50 ${
              canDecrement ? "" : "opacity-40"
            }`}
          >
            <Minus size={16} color={colors.neutral[600]} />
          </Pressable>

          <View className="h-11 min-w-[88px] flex-row items-center justify-center border-y border-neutral-200 bg-white px-2">
            <TextInput
              value={text}
              onChangeText={handleChangeText}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                commit(text);
              }}
              onSubmitEditing={() => commit(text)}
              keyboardType="decimal-pad"
              className="text-center text-base font-sans-semibold text-neutral-800"
              style={{ fontVariant: ["tabular-nums"] }}
              accessibilityLabel={`${label} — valor exato`}
            />
            {unit && <Text className="ml-1 text-sm font-sans text-neutral-500">{unit}</Text>}
          </View>

          <Pressable
            onPress={canIncrement ? () => nudge(1) : undefined}
            disabled={!canIncrement}
            accessibilityRole="button"
            accessibilityLabel={`Aumentar ${label.toLowerCase()}`}
            accessibilityState={{ disabled: !canIncrement }}
            className={`h-11 w-11 items-center justify-center rounded-r-full border border-neutral-200 bg-white active:bg-neutral-50 ${
              canIncrement ? "" : "opacity-40"
            }`}
          >
            <Plus size={16} color={colors.neutral[600]} />
          </Pressable>
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
          maximumValue={gridMax}
          step={step}
          value={value}
          onValueChange={(v) => {
            setClampMessage(null);
            onChange(Number(v.toFixed(decimals)));
          }}
          minimumTrackTintColor={colors.primary[400]}
          maximumTrackTintColor={colors.neutral[200]}
          thumbTintColor={colors.primary[500]}
        />
      </View>
      {clampMessage && (
        <Text className="text-xs font-sans-medium text-warning-500">{clampMessage}</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run (de `apps/mobile`): `npx jest components/SliderInput.test.tsx --runInBand`
Expected: PASS.

Se o teste de `accessibilityState` falhar por a prop chegar como `undefined`, checar como o `@testing-library/react-native` expõe a árvore no projeto e ajustar a asserção pra `getByLabelText(...).props.accessibilityState?.disabled` — não mudar o componente pra acomodar o teste.

- [ ] **Step 5: Rodar a suíte inteira do app, typecheck e lint**

Run: `npm test --workspace @fitbrother/mobile && npm run typecheck --workspace @fitbrother/mobile`
Run (da raiz do repo): `npm run lint`
Expected: PASS, sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/SliderInput.tsx apps/mobile/components/SliderInput.test.tsx
git commit -m "feat(ui): SliderInput vira stepper

O campo numérico solto vira - [170 cm] + com botões de 44x44. O centro
continua editável — digitar um valor exato não se perde.

O teto também passa a ser alinhado na grade min + n*step: os limites
calculados de peso-alvo e ritmo não caem nessa grade, e sem alinhar o slider
para antes do máximo."
```

---

### Task 8: `GoalBlock` consumindo os limites novos

**Files:**
- Modify: `apps/mobile/components/onboarding/blocks/GoalBlock.tsx:1-11,36-72,129-148`

**Interfaces:**
- Consumes: Task 4 (`computeRateBounds`), Task 7 (`SliderInput` com stepper).
- Produces: nada consumido adiante.

O bloco já reúne `sex`, `height_cm`, `activity_level` e `body_fat_pct` pro cálculo da data projetada. Passa a chamar `computeRateBounds` com os mesmos dados.

Precisa de `birth_date` pra idade? Não — `computeRateBounds` recebe `age_years`, e o bloco já usa `age_years: 30` fixo no `computeTargets` local com o comentário de que idade não afeta ritmo nem data projetada. Usar a mesma constante mantém a coerência: idade entra na TMB, mas o efeito no teto de ritmo é de segunda ordem e o valor definitivo é recalculado no servidor.

- [ ] **Step 1: Adicionar o import**

Em `apps/mobile/components/onboarding/blocks/GoalBlock.tsx`, linha 1:

```ts
import { computeRateBounds, computeTargetWeightBounds, computeTargets } from "@fitbrother/shared";
```

- [ ] **Step 2: Calcular os limites de ritmo**

Substituir o bloco que hoje calcula `defaultRate` e `selectedRate` (linhas 68-72) por:

```ts
  // Idade fixa aqui pelo mesmo motivo do computeTargets abaixo: ela entra na
  // TMB, mas o efeito no teto de ritmo é de segunda ordem e o valor
  // definitivo é recalculado no servidor.
  const rateBounds =
    showRateInputs && sex && height_cm && activity_level
      ? computeRateBounds({
          goal,
          sex,
          age_years: 30,
          weight_kg: currentWeight,
          height_cm,
          activity_level,
        })
      : { min: 0.1, max: 1.0 };

  const defaultRate =
    goal === "lose" || goal === "gain"
      ? Math.round((DEFAULT_RATE_PCT[goal] / 100) * currentWeight * 10) / 10
      : 0.5;
  const selectedRate = Math.min(
    rateBounds.max,
    Math.max(rateBounds.min, rate_kg_per_week ?? defaultRate),
  );
```

O fallback `{ min: 0.1, max: 1.0 }` cobre o caminho em que o bloco renderiza antes do preenchimento completo (retomada de onboarding salvo) — mesmo comportamento de hoje, sem crash.

- [ ] **Step 3: Clampar o valor salvo quando os limites mudam**

Logo abaixo do `useEffect` que já existe pro `target_weight_kg` (linhas 62-66), adicionar o irmão pro ritmo:

```ts
  // Mesmo motivo do efeito acima: trocar de objetivo muda o teto de ritmo, e
  // um valor salvo fora da faixa nova seria submetido intacto se o usuário
  // não tocasse no slider.
  useEffect(() => {
    if (rate_kg_per_week === undefined) return;
    const clamped = Math.min(rateBounds.max, Math.max(rateBounds.min, rate_kg_per_week));
    if (clamped !== rate_kg_per_week) setField("rate_kg_per_week", clamped);
  }, [rate_kg_per_week, rateBounds.min, rateBounds.max, setField]);
```

- [ ] **Step 4: Ligar os limites no slider de ritmo**

Substituir o `SliderInput` de "Ritmo" (linhas 140-148) por:

```tsx
            <SliderInput
              label="Ritmo"
              min={rateBounds.min}
              max={rateBounds.max}
              step={0.05}
              value={selectedRate}
              unit="kg/semana"
              onChange={(v) => setField("rate_kg_per_week", v)}
            />
```

O `step` cai de 0.1 pra 0.05 porque a faixa nova (0,1 a ~0,52–0,75) daria poucas posições úteis com passo de 0,1. `decimalsFor(0.05)` já devolve 2 casas.

- [ ] **Step 5: Rodar typecheck, lint e a suíte do app**

Run: `npm run typecheck --workspace @fitbrother/mobile && npm test --workspace @fitbrother/mobile`
Run (da raiz do repo): `npm run lint`
Expected: PASS, sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/onboarding/blocks/GoalBlock.tsx
git commit -m "feat(onboarding): slider de ritmo passa a usar os limites reais

Antes era fixo em 0.1-1.0 kg/semana pra todo mundo, enquanto o cap de déficit
travava em torno de 0,47-0,63 na prática — o backend clampava em silêncio com
um warning que a UI não mostrava.

O passo cai pra 0,05 porque a faixa nova é mais curta, e um efeito novo
clampa o valor salvo quando trocar de objetivo muda o teto."
```

---

### Task 9: Verificação manual no navegador

**Files:** nenhum. É a checagem de que o conjunto funciona de verdade.

**Interfaces:**
- Consumes: todas as tarefas anteriores.
- Produces: nada.

Os testes cobrem as unidades. Nenhum deles exercita Enter num navegador real, e o `SliderInput` nunca foi renderizado dentro de um bloco de onboarding num teste.

- [ ] **Step 1: Subir o dev server web**

Usar a ferramenta de preview do harness (`preview_start`) com a configuração web de `.claude/launch.json`. Se não existir uma entrada web, criar uma que rode o comando de dev do Expo pra web e apontar pra porta certa. Nunca usar Bash pra rodar o servidor.

- [ ] **Step 2: Percorrer o onboarding só com o teclado**

Do bloco `name` até o `signup`, avançando com Enter em cada etapa. Confirmar em cada uma:
- Enter avança quando "Continuar" está habilitado.
- Enter não faz nada quando está desabilitado (ex. `name` com o campo vazio, `consent` sem os quatro checkboxes).
- Enter com foco no botão "Voltar" volta uma etapa e **não** pula duas.

- [ ] **Step 3: Confirmar o commit do valor digitado**

No bloco `height`, digitar `185` no campo do stepper e apertar Enter direto, sem clicar fora. Avançar até o `reveal` e confirmar que os cálculos usaram 185, não 170.

- [ ] **Step 4: Confirmar que o `SignupBlock` manteve o encadeamento**

No bloco `signup`, com o formulário completo, apertar Enter no campo de e-mail deve mover o foco pra senha — não submeter. Enter no campo de confirmar senha submete.

- [ ] **Step 5: Confirmar o stepper**

Em `height` e `weight`: os botões −/+ movem por um passo, ficam visivelmente apagados nos limites, e o slider abaixo acompanha. Tirar um print do bloco `height` pra registro.

- [ ] **Step 6: Confirmar que o ritmo parou de clampar**

No `goal` com "Perder gordura", arrastar o ritmo até o máximo. Avançar até o `reveal` e confirmar que não aparece nenhum aviso de clamp e que a data projetada bate com o ritmo escolhido. Repetir com "Ganhar massa".

- [ ] **Step 7: Ler o console e os logs do servidor**

Confirmar que não há erro nem warning novo (`read_console_messages`, `preview_logs`).

- [ ] **Step 8: Rodar a verificação final completa**

Run (da raiz do repo): `npm test && npm run typecheck && npm run lint`
Expected: tudo PASS. Os três scripts da raiz varrem todos os workspaces.

---

## Self-Review

**Cobertura do spec:**

| Requisito do spec | Task |
|---|---|
| Hook `useEnterToContinue`, web-only, blur + rAF | 5 |
| Exclusão de `role=button/link/checkbox/radio`, `a`, `button`, `textarea` | 5 |
| Prop `enterToContinue`, `SignupBlock` opta por fora | 6 |
| Blocos com `showNav={false}` sem Enter | 6 |
| Stepper 44×44, campo central editável, haptics, estado desabilitado | 7 |
| Alinhamento do teto na grade de passos (`gridMax`) | 7 |
| `step` do ritmo 0.1 → 0.05 | 8 |
| `MIN_HEALTHY_BODY_FAT_PCT` e `MAX_BMI_FOR_TARGET_WEIGHT` afrouxados | 1 |
| Piso de IMC 18,6 no peso-alvo | 1 |
| Arredondamento pra dentro | 1 |
| Caps movidos pra `formulas.ts` | 2 |
| `RATE_CAP_PCT` e `DEFICIT_CAP_PCT` afrouxados | 3 |
| `computeRateBounds` + invariante de não-clamp | 4 |
| `GoalBlock` consumindo, com clamp do valor salvo | 8 |
| `gates.ts` intocado | — (nenhuma task toca) |
| Verificação manual | 9 |

**Consistência de tipos:** `computeRateBounds` é definida na Task 4 e consumida na Task 8 com os mesmos seis campos. `shouldAdvanceOnEnter`/`useEnterToContinue` são definidos na Task 5 e o hook é consumido na Task 6 com as três opções declaradas. `RATE_CAP_PCT`/`DEFICIT_CAP_PCT` são exportados na Task 2, alterados na Task 3, lidos na Task 4.

**Riscos conhecidos:**

- A Task 3 muda o resultado de testes existentes de forma substantiva, não cosmética. Os valores esperados novos foram calculados e conferidos antes de escrever o plano, não estimados.
- A asserção de `accessibilityState` na Task 7 depende de como o `@testing-library/react-native` expõe props na versão do projeto. O Step 4 dá a saída caso falhe.
- `apps/mobile` não tem script `lint` próprio — o `lint` mora só na raiz e varre o repo inteiro (inclusive os checks de copy legal). Os passos que pedem lint dizem "da raiz do repo".
