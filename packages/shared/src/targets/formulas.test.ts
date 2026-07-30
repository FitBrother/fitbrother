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
