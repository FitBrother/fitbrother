import { describe, expect, test } from "@jest/globals";
import { firstIncompleteGateIndex } from "./gate";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

describe("firstIncompleteGateIndex", () => {
  test("a blank store gates right at the first block", () => {
    expect(firstIncompleteGateIndex(useOnboardingStore.getState())).toBe(0);
  });

  test("stops at the first block whose data is still missing", () => {
    const state = {
      ...useOnboardingStore.getState(),
      full_name: "Juan",
      sex: "male" as const,
      birth_date: "01/01/1990",
      height_cm: 180,
      // weight_kg still undefined
    };

    expect(firstIncompleteGateIndex(state)).toBe(3); // weight
  });

  test("basics needs both sex and birth_date, not just one", () => {
    const onlySex = { ...useOnboardingStore.getState(), full_name: "Juan", sex: "male" as const };
    expect(firstIncompleteGateIndex(onlySex)).toBe(1); // basics

    const onlyBirthDate = {
      ...useOnboardingStore.getState(),
      full_name: "Juan",
      birth_date: "01/01/1990",
    };
    expect(firstIncompleteGateIndex(onlyBirthDate)).toBe(1); // basics
  });

  test("all seven physical-data fields filled clears every gate, for any block ahead", () => {
    const state = {
      ...useOnboardingStore.getState(),
      full_name: "Juan",
      sex: "male" as const,
      birth_date: "01/01/1990",
      height_cm: 180,
      weight_kg: 80,
      body_fat_pct: 18,
      activity_level: "moderate" as const,
      goal: "lose" as const,
    };

    const gate = firstIncompleteGateIndex(state);
    // Regressão real: um valor fixo (ex. 7, o tamanho da lista de checks)
    // só libera até esse índice — o bloco seguinte (calculating, índice 8)
    // caía como bloqueado de novo, e [block].tsx redirecionava pro health
    // pra sempre. Precisa ser Infinity pra "index <= gate" valer pra
    // qualquer bloco depois do último com pré-requisito próprio.
    expect(gate).toBe(Number.POSITIVE_INFINITY);
    expect(8 <= gate).toBe(true); // calculating
    expect(16 <= gate).toBe(true); // first_meal, o último bloco da lista
  });
});
