import { afterEach, describe, expect, test } from "@jest/globals";
import { trainingTypeUsesStrength, useOnboardingStore } from "./stores/onboardingStore";

describe("onboarding training type", () => {
  afterEach(() => {
    useOnboardingStore.getState().reset();
  });

  test("persists the exact training type in progress answers", () => {
    useOnboardingStore.getState().setField("training_type", "cardio");

    expect(useOnboardingStore.getState().toAnswers()).toMatchObject({
      training_type: "cardio",
    });
  });

  test("maps the four training types to the legacy strength flag", () => {
    expect(trainingTypeUsesStrength("none")).toBe(false);
    expect(trainingTypeUsesStrength("cardio")).toBe(false);
    expect(trainingTypeUsesStrength("strength")).toBe(true);
    expect(trainingTypeUsesStrength("mixed")).toBe(true);
  });

  test("hydrates the exact training type from saved progress", () => {
    useOnboardingStore.getState().hydrate({
      training_type: "mixed",
      strength_training: true,
    });

    expect(useOnboardingStore.getState().training_type).toBe("mixed");
  });

  test("falls back to strength for legacy progress with strength training", () => {
    useOnboardingStore.getState().hydrate({ strength_training: true });

    expect(useOnboardingStore.getState().training_type).toBe("strength");
  });

  test("falls back to none for legacy progress without strength training", () => {
    useOnboardingStore.getState().hydrate({ strength_training: false });

    expect(useOnboardingStore.getState().training_type).toBe("none");
  });
});
