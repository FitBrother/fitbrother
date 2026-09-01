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

// A largura da janela decide entre `compact` e `wide`. Fixar aqui em vez de
// herdar o default do ambiente de teste: sem isso, os testes de rótulo passam
// por acidente (o default é menor que o breakpoint) e quebrariam em silêncio
// se o preset do jest mudasse de tamanho.
let mockLarguraJanela = 375;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockLarguraJanela, height: 812, scale: 2, fontScale: 1 }),
}));

import {
  activeTabWidth,
  AVATAR_SIZE,
  evenTabWidth,
  HomeHeader,
  tabBarHeight,
  tabLayoutFor,
  tabOffset,
  TABS,
  WIDE_TABS_MIN_WIDTH,
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

// No tablet sobra largura para os três rótulos, então as abas passam a ter o
// mesmo tamanho — não faz sentido a ativa roubar espaço quando todas se nomeiam.
describe("layout largo das abas", () => {
  const PADDING = 3;

  test("o modo vira `wide` a partir do breakpoint e não antes", () => {
    expect(tabLayoutFor(WIDE_TABS_MIN_WIDTH - 1)).toBe("compact");
    expect(tabLayoutFor(WIDE_TABS_MIN_WIDTH)).toBe("wide");
  });

  test("o celular continua em `compact` e o tablet em `wide`", () => {
    expect(tabLayoutFor(360)).toBe("compact");
    expect(tabLayoutFor(375)).toBe("compact");
    expect(tabLayoutFor(768)).toBe("wide");
    expect(tabLayoutFor(1023)).toBe("wide");
  });

  test("as abas dividem a barra em partes iguais", () => {
    expect(evenTabWidth(300, 3, PADDING)).toBe((300 - 6) / 3);
  });

  test("não devolve valor negativo antes da medição do layout", () => {
    expect(evenTabWidth(0, 3, PADDING)).toBe(0);
  });

  test("o indicador na última aba não passa da borda da barra", () => {
    const barra = 300;
    const largura = evenTabWidth(barra, TABS.length, PADDING);
    const ultima = TABS.length - 1;
    expect(tabOffset(ultima, PADDING, largura) + largura).toBeCloseTo(barra - PADDING);
  });
});

// Com as três abas na mesma linha da ofensiva e do perfil não há largura para
// três rótulos. O nome continua disponível para leitores de tela pelo
// accessibilityLabel do Pressable — o que some é só o texto visível.
describe("rótulo das abas", () => {
  beforeEach(() => {
    mockLarguraJanela = 375;
  });

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

  test("no tablet as três abas mostram o rótulo, inclusive as inativas", () => {
    mockLarguraJanela = 768;

    const { queryByText } = render(<HomeHeader activeTab="home" onChangeTab={jest.fn()} />);

    expect(queryByText("Home")).not.toBeNull();
    expect(queryByText("Social")).not.toBeNull();
    expect(queryByText("Análises")).not.toBeNull();
  });

  test("logo abaixo do breakpoint só a ativa mostra o rótulo", () => {
    mockLarguraJanela = WIDE_TABS_MIN_WIDTH - 1;

    const { queryByText } = render(<HomeHeader activeTab="home" onChangeTab={jest.fn()} />);

    expect(queryByText("Home")).not.toBeNull();
    expect(queryByText("Social")).toBeNull();
    expect(queryByText("Análises")).toBeNull();
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
