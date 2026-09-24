import { describe, expect, test } from "@jest/globals";
import { TOUR_STEPS, tourLayout, visibleSteps } from "./steps";

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
      "profile-goals",
      "goals-editor",
      "profile-shortcut-card",
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
      ["profile-goals", "profile"],
      ["goals-editor", "goals"],
      ["profile-shortcut-card", "profile"],
    ]);
  });

  test("nenhum texto pede pra tocar no item (o avanço é pelo Próximo)", () => {
    for (const step of TOUR_STEPS) expect(step.copy).not.toMatch(/^Toque/);
  });
});

describe("layout desktop", () => {
  test("tourLayout corta em 1024", () => {
    expect(tourLayout(1023)).toBe("compact");
    expect(tourLayout(1024)).toBe("desktop");
  });

  test("no desktop, Social e Análises abrem Feed e Insights", () => {
    const steps = visibleSteps("installable-chrome", "desktop");
    expect(steps.map((s) => s.id)).toEqual(TOUR_STEPS.map((s) => s.id));
    expect(steps.find((s) => s.id === "social-tab")?.screen).toBe("feed");
    expect(steps.find((s) => s.id === "analises-tab")?.screen).toBe("insights");
  });

  test("no desktop, streak e avatar usam o texto da variante", () => {
    const steps = visibleSteps("installable-chrome", "desktop");
    expect(steps.find((s) => s.id === "streak")?.copy).toBe(
      "Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu.",
    );
    expect(steps.find((s) => s.id === "home-avatar")?.copy).toBe(
      "Aqui você abre seu perfil e suas configurações.",
    );
  });

  test("no compacto nada muda", () => {
    const steps = visibleSteps("installable-chrome", "compact");
    expect(steps.find((s) => s.id === "social-tab")?.screen).toBe("home");
  });
});

describe("passo do atalho", () => {
  test("é o último quando existe", () => {
    expect(visibleSteps("installable-chrome").at(-1)?.id).toBe("profile-shortcut-card");
    expect(visibleSteps("native").at(-1)?.id).toBe("goals-editor");
  });

  test("texto conforme o navegador", () => {
    const copy = (status: Parameters<typeof visibleSteps>[0]) =>
      visibleSteps(status).find((s) => s.id === "profile-shortcut-card")?.copy;
    expect(copy("installable-chrome")).toBe(
      "Instale o Fitbrother para abrir direto da sua tela, como um app.",
    );
    expect(copy("installable-mac-safari")).toBe(
      "Para instalar, clique em Compartilhar na barra de endereço e escolha “Adicionar ao Dock”.",
    );
    expect(copy("installable-ios")).toBe(
      "Para instalar, toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
    );
  });
});
