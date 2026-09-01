import { describe, expect, it } from "vitest";
import { computeTargets } from "./compute-targets.js";
import type { TargetsInput } from "./types.js";

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
      body_fat_pct: 28,
    });

    expect(result.blocked).toBe(true);
    // 18.5 * 1.70² = 53.465 -> arredondado 53.47
    expect(result.block_reason).toContain("53.47");
  });
});

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

describe("computeTargets — direção ganho", () => {
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
});

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
