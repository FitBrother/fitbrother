import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

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

jest.mock("@/lib/hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ status: "installable-chrome" }),
}));

let mockLarguraJanela = 375;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockLarguraJanela, height: 812, scale: 2, fontScale: 1 }),
}));

import { TourOverlay } from "./TourOverlay";

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
