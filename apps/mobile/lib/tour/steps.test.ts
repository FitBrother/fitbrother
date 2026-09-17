import { describe, expect, test } from "@jest/globals";
import { TOUR_STEPS, visibleSteps } from "./steps";

describe("visibleSteps", () => {
  test("inclui os 5 passos quando há atalho pra oferecer", () => {
    expect(visibleSteps("installable-chrome")).toHaveLength(5);
    expect(visibleSteps("installable-ios")).toHaveLength(5);
    expect(visibleSteps("installable-mac-safari")).toHaveLength(5);
  });

  test("tira o passo do atalho quando não há nada pra instalar", () => {
    expect(visibleSteps("native").map((s) => s.id)).not.toContain("profile-shortcut-card");
    expect(visibleSteps("installed").map((s) => s.id)).not.toContain("profile-shortcut-card");
    expect(visibleSteps("unsupported").map((s) => s.id)).not.toContain("profile-shortcut-card");
    expect(visibleSteps("native")).toHaveLength(4);
  });

  test("a ordem dos passos bate com a sequência aprovada na spec", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "home-tab",
      "social-tab",
      "analises-tab",
      "profile-avatar",
      "profile-shortcut-card",
    ]);
  });

  test("os passos das abas ficam na tela home e os dois últimos na profile", () => {
    expect(TOUR_STEPS.filter((s) => s.screen === "home").map((s) => s.id)).toEqual([
      "home-tab",
      "social-tab",
      "analises-tab",
    ]);
    expect(TOUR_STEPS.filter((s) => s.screen === "profile").map((s) => s.id)).toEqual([
      "profile-avatar",
      "profile-shortcut-card",
    ]);
  });
});
