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
    expect(gates.some((g) => g.severity === "BLOCK" && g.condition === "age_under_18")).toBe(true);
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
