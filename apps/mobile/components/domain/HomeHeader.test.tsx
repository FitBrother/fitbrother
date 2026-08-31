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
const mockProfile: { full_name: string; soft_mode: boolean; avatar_url: string | null } = {
  full_name: "Ana Silva",
  soft_mode: false,
  avatar_url: null,
};
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => mockProfile,
}));
// useAvatarUrl assina o caminho via lib/storage → lib/supabase, a mesma cadeia
// que os outros mocks cortam. Mockar aqui também é o que permite exercitar os
// dois estados do botão de perfil sem rede.
jest.mock("@/lib/hooks/useAvatarUrl", () => ({
  useAvatarUrl: (path: string | null | undefined) => (path ? `https://signed.test/${path}` : null),
}));
jest.mock("@/lib/hooks/useAuthSession", () => ({
  useAuthSession: () => ({
    status: "signed_in",
    session: { user: { email: "ana@exemplo.com" } },
  }),
}));

import { AVATAR_SIZE, HomeHeader, tabBarHeight, tabSlotWidth, TABS } from "./HomeHeader";

describe("abas da Home", () => {
  test("a aba social é rotulada 'Social'", () => {
    expect(TABS.find((t) => t.key === "feed")?.label).toBe("Social");
  });

  test("a ordem das abas é home → feed → analises", () => {
    expect(TABS.map((t) => t.key)).toEqual(["home", "feed", "analises"]);
  });
});

// O destaque da aba ativa era uma classe condicional, que troca de uma vez.
// Com o conteúdo deslizando em 250ms, o salto da pílula ficava evidente —
// agora ela é um indicador posicionado, e a largura do slot é o que define
// para onde ele desliza.
// A barra fechava em 50 (aba de 44 + 3 de padding de cada lado) e ficava mais
// alta que o avatar e o pill de ofensivas, ambos de 44. A altura da aba passou
// a ser derivada do avatar para os três não saírem de sintonia.
describe("altura da barra de abas", () => {
  test("fecha na mesma altura do avatar e do pill", () => {
    expect(tabBarHeight()).toBe(AVATAR_SIZE);
  });
});

describe("tabSlotWidth", () => {
  const PADDING = 3;

  test("divide a largura útil entre as abas", () => {
    // 300 de barra - 6 de padding = 294 úteis / 3 abas = 98
    expect(tabSlotWidth(300, 3, PADDING)).toBeCloseTo(98);
  });

  test("desconta o padding das duas pontas", () => {
    expect(tabSlotWidth(106, 2, PADDING)).toBeCloseTo(50);
  });

  test("não devolve valor negativo antes da medição do layout", () => {
    expect(tabSlotWidth(0, 3, PADDING)).toBe(0);
    expect(tabSlotWidth(4, 3, PADDING)).toBe(0);
  });

  test("o deslocamento da última aba mantém o indicador dentro da barra", () => {
    const barra = 300;
    const slot = tabSlotWidth(barra, 3, PADDING);
    const deslocamentoFinal = slot * 2;
    expect(deslocamentoFinal + slot).toBeLessThanOrEqual(barra - PADDING * 2);
  });
});

// O botão de perfil renderizava só as iniciais — nunca teve <Image>. Trocar a
// foto no perfil não mudava nada na Home.
describe("botão de perfil", () => {
  test("mostra a foto quando o perfil tem avatar", () => {
    mockProfile.avatar_url = "user-1/avatar.jpg";

    const { queryByTestId } = render(<HomeHeader activeTab="home" onChangeTab={jest.fn()} />);

    expect(queryByTestId("avatar-image")).not.toBeNull();
    expect(queryByTestId("avatar-initials")).toBeNull();
  });

  test("cai nas iniciais quando não há avatar", () => {
    mockProfile.avatar_url = null;

    const { getByTestId, queryByTestId } = render(
      <HomeHeader activeTab="home" onChangeTab={jest.fn()} />,
    );

    expect(queryByTestId("avatar-image")).toBeNull();
    expect(getByTestId("avatar-initials")).toHaveTextContent("AS");
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
