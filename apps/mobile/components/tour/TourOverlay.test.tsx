import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";

// Mesma regra de ordenação do tour-context.test.tsx: o import de
// `./TourOverlay` (módulo sob teste) fica no fim do arquivo, depois de todo
// `jest.mock`.
const mockNext = jest.fn();
const mockSkip = jest.fn();
let mockTour: {
  active: boolean;
  currentStepId: string | null;
  targets: Record<string, { x: number; y: number; width: number; height: number }>;
  next: () => void;
  skip: () => void;
};
jest.mock("@/lib/tour/tour-context", () => ({
  useTour: () => mockTour,
}));

const mockPrompt = jest.fn(async () => {});
let mockInstall: { status: string; promptEvent?: object } = { status: "installable-chrome" };
jest.mock("@/lib/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => mockInstall,
}));

beforeEach(() => {
  mockInstall = {
    status: "installable-chrome",
    promptEvent: { prompt: mockPrompt, userChoice: Promise.resolve({ outcome: "accepted" }) },
  };
  mockPrompt.mockClear();
  mockNext.mockReset();
  mockSkip.mockReset();
});

let mockLarguraJanela = 375;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockLarguraJanela, height: 812, scale: 2, fontScale: 1 }),
}));

import { TourOverlay, balloonPlacement } from "./TourOverlay";

describe("TourOverlay", () => {
  test("não renderiza nada quando o tour está inativo", () => {
    mockTour = { active: false, currentStepId: null, targets: {}, next: mockNext, skip: mockSkip };
    const { toJSON } = render(<TourOverlay />);
    expect(toJSON()).toBeNull();
  });

  test("mostra a copy do passo atual", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: { "home-tab": { x: 10, y: 10, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByText } = render(<TourOverlay />);
    expect(getByText("Aqui você vê seu resumo do dia.")).toBeTruthy();
  });

  test("o botão Próximo chama next()", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: { "home-tab": { x: 10, y: 10, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText } = render(<TourOverlay />);
    fireEvent.press(getByLabelText("Próximo passo"));
    expect(mockNext).toHaveBeenCalled();
  });

  test("o botão Pular chama skip()", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: { "home-tab": { x: 10, y: 10, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText } = render(<TourOverlay />);
    fireEvent.press(getByLabelText("Pular tour"));
    expect(mockSkip).toHaveBeenCalled();
  });

  test("no último passo só aparece 'Concluir' (sem Pular)", () => {
    mockInstall = { status: "native" }; // sem atalho: o último é Metas
    mockTour = {
      active: true,
      currentStepId: "goals-editor",
      targets: { "goals-editor": { x: 10, y: 200, width: 300, height: 44 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText, queryByLabelText, getByText } = render(<TourOverlay />);
    expect(getByText("Concluir")).toBeTruthy();
    fireEvent.press(getByLabelText("Concluir tour"));
    expect(mockNext).toHaveBeenCalled();
    expect(queryByLabelText("Pular tour")).toBeNull();
  });

  test("atalho no Chrome: Pular e Instalar; Instalar abre o prompt e encerra", async () => {
    mockTour = {
      active: true,
      currentStepId: "profile-shortcut-card",
      targets: { "profile-shortcut-card": { x: 10, y: 300, width: 300, height: 80 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText, queryByLabelText } = render(<TourOverlay />);
    expect(queryByLabelText("Concluir tour")).toBeNull();
    fireEvent.press(getByLabelText("Pular tour"));
    expect(mockSkip).toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(getByLabelText("Instalar o app"));
    });
    expect(mockPrompt).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  test("atalho no Safari do Mac: texto com o caminho e botão Entendi", () => {
    mockInstall = { status: "installable-mac-safari" };
    mockTour = {
      active: true,
      currentStepId: "profile-shortcut-card",
      targets: { "profile-shortcut-card": { x: 10, y: 300, width: 300, height: 80 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByText, getByLabelText } = render(<TourOverlay />);
    expect(
      getByText(
        "Para instalar, clique em Compartilhar na barra de endereço e escolha “Adicionar ao Dock”.",
      ),
    ).toBeTruthy();
    fireEvent.press(getByLabelText("Concluir tour"));
    expect(mockNext).toHaveBeenCalled();
    expect(getByLabelText("Pular tour")).toBeTruthy();
  });

  test("passo que não é o último tem Pular e Próximo, e o recorte não é botão", () => {
    mockNext.mockReset();
    mockTour = {
      active: true,
      currentStepId: "social-tab",
      targets: { "social-tab": { x: 100, y: 40, width: 44, height: 44 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText, queryByLabelText } = render(<TourOverlay />);
    expect(getByLabelText("Pular tour")).toBeTruthy();
    fireEvent.press(getByLabelText("Próximo passo"));
    expect(mockNext).toHaveBeenCalled();
    expect(queryByLabelText("Veja o progresso dos seus amigos.")).toBeNull();
  });

  test("sem retângulo medido ainda, mostra só o véu (balão espera o recorte)", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: {},
      next: mockNext,
      skip: mockSkip,
    };
    const { queryByText } = render(<TourOverlay />);
    expect(queryByText("Aqui você vê seu resumo do dia.")).toBeNull();
  });

  test("no desktop mostra o texto da variante", () => {
    mockLarguraJanela = 1280;
    mockTour = {
      active: true,
      currentStepId: "streak",
      targets: { streak: { x: 900, y: 40, width: 80, height: 44 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByText } = render(<TourOverlay />);
    expect(
      getByText(
        "Sua ofensiva: dias seguidos registrando. O histórico completo fica em Histórico, no menu.",
      ),
    ).toBeTruthy();
    mockLarguraJanela = 375;
  });
});

describe("balloonPlacement", () => {
  const screen = { width: 1280, height: 800 };

  test("compacto: faixa com as margens laterais (como no celular)", () => {
    const pos = balloonPlacement({ x: 10, y: 40, width: 100, height: 44 }, 375, 812, "compact");
    expect(pos).toMatchObject({ left: 20, right: 20 });
    expect(pos).not.toHaveProperty("maxWidth");
  });

  test("desktop, alvo no trilho da Sidebar: balão ao lado, com largura máxima", () => {
    const pos = balloonPlacement(
      { x: 16, y: 120, width: 216, height: 44 },
      screen.width,
      screen.height,
      "desktop",
    );
    expect(pos).toMatchObject({ left: 16 + 216 + 8 + 16, top: 120 - 8, maxWidth: 360 });
    expect(pos).not.toHaveProperty("right");
  });

  test("desktop, alvo do rodapé da Sidebar: balão ao lado, ancorado por baixo", () => {
    const pos = balloonPlacement(
      { x: 16, y: 730, width: 216, height: 44 },
      screen.width,
      screen.height,
      "desktop",
    );
    expect(pos).toMatchObject({ left: 256, bottom: 800 - 774 - 8, maxWidth: 360 });
  });

  test("desktop, alvo no conteúdo: acima/abaixo, ancorado no alvo e dentro da tela", () => {
    const below = balloonPlacement(
      { x: 600, y: 100, width: 300, height: 44 },
      1280,
      800,
      "desktop",
    );
    expect(below).toMatchObject({ left: 592, top: 100 + 44 + 8 + 16, maxWidth: 360 });
    const nearRightEdge = balloonPlacement(
      { x: 1200, y: 700, width: 52, height: 52 },
      1280,
      800,
      "desktop",
    );
    expect(nearRightEdge).toMatchObject({ left: 1280 - 360 - 20, bottom: 800 - 700 + 8 + 16 });
  });
});
