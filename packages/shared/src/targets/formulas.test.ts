import { describe, expect, it } from "vitest";
import {
  calculateBmr,
  calculateTdee,
  computeTargetWeightBounds,
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
    // 70kg a 1,90m com 12% de gordura: piso por massa magra = 61.6/0.92 =
    // 66.96; piso por IMC = 18.6*1.9² = 67.15. Vence o IMC — é o caso que
    // impede o slider de oferecer um alvo que o gate bloqueia depois.
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
