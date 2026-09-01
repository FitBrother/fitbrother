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

import {
  activeTabWidth,
  AVATAR_SIZE,
  HomeHeader,
  tabBarHeight,
  tabOffset,
  TABS,
} from "./HomeHeader";

describe("abas da Home", () => {
  test("a aba social é rotulada 'Social'", () => {
    expect(TABS.find((t) => t.key === "feed")?.label).toBe("Social");
  });

  test("a ordem das abas é home → feed → analises", () => {
    expect(TABS.map((t) => t.key)).toEqual(["home", "feed", "analises"]);
  });
});

// A altura da aba é derivada do avatar para os três elementos da linha —
// ofensiva, abas e perfil — nunca saírem de sintonia.
describe("altura da barra de abas", () => {
  test("fecha na mesma altura do avatar e do pill", () => {
    expect(tabBarHeight()).toBe(AVATAR_SIZE);
  });
});

// Com o menu na mesma linha da ofensiva e do perfil não cabem três rótulos:
// num aparelho de 360px sobram ~200px para a barra, e "Análises" com ícone e
// rótulo pede mais que o terço disponível. Só a ativa mostra rótulo e fica com
// toda a sobra; as inativas são quadrados de 44 (o alvo de toque mínimo).
describe("larguras das abas", () => {
  const PADDING = 3;
  const INATIVA = AVATAR_SIZE - PADDING * 2;

  test("a ativa fica com o que sobra depois das inativas", () => {
    // 300 de barra - 6 de padding - 2 inativas de 44 = 206
    expect(activeTabWidth(300, 3, PADDING)).toBe(300 - 6 - INATIVA * 2);
  });

  test("a ativa é bem mais larga que uma inativa no aperto de 360px", () => {
    // Numa tela de 360: 328 de conteúdo - 62 do pill - 50 do avatar - 16 dos
    // gaps = 200 de barra.
    expect(activeTabWidth(200, 3, PADDING)).toBeGreaterThan(INATIVA);
  });

  test("não devolve valor negativo antes da medição do layout", () => {
    expect(activeTabWidth(0, 3, PADDING)).toBe(0);
    expect(activeTabWidth(50, 3, PADDING)).toBe(0);
  });

  test("o indicador na última aba não passa da borda da barra", () => {
    const barra = 300;
    const ultima = TABS.length - 1;
    expect(tabOffset(ultima, PADDING) + activeTabWidth(barra, TABS.length, PADDING)).toBe(
      barra - PADDING,
    );
  });

  test("o deslocamento é constante porque as abas anteriores são todas inativas", () => {
    expect(tabOffset(0, PADDING)).toBe(PADDING);
    expect(tabOffset(1, PADDING)).toBe(PADDING + INATIVA);
    expect(tabOffset(2, PADDING)).toBe(PADDING + INATIVA * 2);
  });
});

// Com as três abas na mesma linha da ofensiva e do perfil não há largura para
// três rótulos. O nome continua disponível para leitores de tela pelo
// accessibilityLabel do Pressable — o que some é só o texto visível.
describe("rótulo das abas", () => {
  test("apenas a aba ativa mostra o rótulo", () => {
    const { queryByText } = render(<HomeHeader activeTab="feed" onChangeTab={jest.fn()} />);

    expect(queryByText("Social")).not.toBeNull();
    expect(queryByText("Home")).toBeNull();
    expect(queryByText("Análises")).toBeNull();
  });

  test("o rótulo acompanha a troca de aba", () => {
    const { queryByText } = render(<HomeHeader activeTab="analises" onChangeTab={jest.fn()} />);

    expect(queryByText("Análises")).not.toBeNull();
    expect(queryByText("Social")).toBeNull();
  });

  test("as inativas continuam nomeadas para leitores de tela", () => {
    const { getByLabelText } = render(<HomeHeader activeTab="home" onChangeTab={jest.fn()} />);

    expect(getByLabelText("Social")).toBeTruthy();
    expect(getByLabelText("Análises")).toBeTruthy();
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
