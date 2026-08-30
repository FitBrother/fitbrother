import { describe, expect, jest, test } from "@jest/globals";

// HomeHeader importa useAuthSession/useStreak, que arrastam lib/supabase.ts —
// e esse módulo lê window.location no load, indisponível no ambiente de teste.
// Mockar os hooks corta a cadeia e mantém o teste focado no componente.
jest.mock("@/lib/hooks/useStreak", () => ({
  useStreak: () => ({ data: { streak: { current_streak: 5 }, atRisk: false } }),
}));
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => ({ full_name: "Ana Silva", soft_mode: false }),
}));
jest.mock("@/lib/hooks/useAuthSession", () => ({
  useAuthSession: () => ({
    status: "signed_in",
    session: { user: { email: "ana@exemplo.com" } },
  }),
}));

import { TABS } from "./HomeHeader";

describe("abas da Home", () => {
  test("a aba social é rotulada 'Social'", () => {
    expect(TABS.find((t) => t.key === "feed")?.label).toBe("Social");
  });

  test("a ordem das abas é home → feed → analises", () => {
    expect(TABS.map((t) => t.key)).toEqual(["home", "feed", "analises"]);
  });
});
