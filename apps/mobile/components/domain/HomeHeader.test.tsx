import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

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

import { HomeHeader, TABS } from "./HomeHeader";

describe("abas da Home", () => {
  test("a aba social é rotulada 'Social'", () => {
    expect(TABS.find((t) => t.key === "feed")?.label).toBe("Social");
  });

  test("a ordem das abas é home → feed → analises", () => {
    expect(TABS.map((t) => t.key)).toEqual(["home", "feed", "analises"]);
  });
});

describe("pill de streak", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  test("navega para o histórico ao ser tocado", () => {
    const { getByLabelText } = render(<HomeHeader activeTab="home" onChangeTab={jest.fn()} />);

    fireEvent.press(getByLabelText("Ver histórico de ofensivas"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/history");
  });

  test("não é renderizado em soft mode", () => {
    const { queryByLabelText } = render(
      <HomeHeader softMode activeTab="home" onChangeTab={jest.fn()} />,
    );

    expect(queryByLabelText("Ver histórico de ofensivas")).toBeNull();
  });
});
