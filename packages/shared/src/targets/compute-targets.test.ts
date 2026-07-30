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
    // precisão 1 (não 2): result.kcal é round2(tdee_bruto*0.95), enquanto
    // este cálculo usa round2(tdee_bruto)*0.95 — arredondamento em ordens
    // diferentes gera até ~0.01 de diferença, esperado e não é bug.
    expect(result.kcal).toBeCloseTo(result.tdee_kcal * 0.95, 1);
  });
});

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
