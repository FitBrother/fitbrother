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

  test("all seven physical-data fields filled clears every gate", () => {
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

    expect(firstIncompleteGateIndex(state)).toBe(7);
  });
});
