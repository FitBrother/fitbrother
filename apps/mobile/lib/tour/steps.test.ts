import { describe, expect, test } from "@jest/globals";
import { TOUR_STEPS, visibleSteps } from "./steps";

describe("visibleSteps", () => {
  test("inclui os 10 passos quando há atalho pra oferecer", () => {
    expect(visibleSteps("installable-chrome")).toHaveLength(10);
    expect(visibleSteps("installable-ios")).toHaveLength(10);
    expect(visibleSteps("installable-mac-safari")).toHaveLength(10);
  });

  test("tira o passo do atalho quando não há nada pra instalar", () => {
    for (const status of ["native", "installed", "unsupported"] as const) {
      expect(visibleSteps(status).map((s) => s.id)).not.toContain("profile-shortcut-card");
      expect(visibleSteps(status)).toHaveLength(9);
    }
  });

  test("a ordem dos passos bate com a spec", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "home-tab",
      "social-tab",
      "analises-tab",
      "composer-plus",
      "streak",
      "history-day",
      "home-avatar",
      "profile-shortcut-card",
      "profile-goals",
      "goals-editor",
    ]);
  });

  test("tela e ação de cada passo", () => {
    expect(TOUR_STEPS.map((s) => [s.id, s.screen, s.action])).toEqual([
      ["home-tab", "home", "next"],
      ["social-tab", "home", "tap"],
      ["analises-tab", "home", "tap"],
      ["composer-plus", "home", "tap"],
      ["streak", "home", "tap"],
      ["history-day", "history", "next"],
      ["home-avatar", "home", "tap"],
      ["profile-shortcut-card", "profile", "next"],
      ["profile-goals", "profile", "tap"],
      ["goals-editor", "goals", "next"],
    ]);
  });
});
