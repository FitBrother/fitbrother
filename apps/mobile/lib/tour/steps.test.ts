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

  test("tela de cada passo", () => {
    expect(TOUR_STEPS.map((s) => [s.id, s.screen])).toEqual([
      ["home-tab", "home"],
      ["social-tab", "home"],
      ["analises-tab", "home"],
      ["composer-plus", "home"],
      ["streak", "home"],
      ["history-day", "history"],
      ["home-avatar", "home"],
      ["profile-shortcut-card", "profile"],
      ["profile-goals", "profile"],
      ["goals-editor", "goals"],
    ]);
  });

  test("nenhum texto pede pra tocar no item (o avanço é pelo Próximo)", () => {
    for (const step of TOUR_STEPS) expect(step.copy).not.toMatch(/^Toque/);
  });
});
