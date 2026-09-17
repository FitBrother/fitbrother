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

const mockLarguraJanela = 375;
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

  test("no último passo o botão vira 'Concluir tour'", () => {
    mockTour = {
      active: true,
      currentStepId: "profile-shortcut-card",
      targets: { "profile-shortcut-card": { x: 10, y: 500, width: 100, height: 40 } },
      next: mockNext,
      skip: mockSkip,
    };
    const { getByLabelText } = render(<TourOverlay />);
    expect(getByLabelText("Concluir tour")).toBeTruthy();
  });

  test("sem retângulo medido ainda, mostra só o véu (sem quebrar)", () => {
    mockTour = {
      active: true,
      currentStepId: "home-tab",
      targets: {},
      next: mockNext,
      skip: mockSkip,
    };
    const { getByText } = render(<TourOverlay />);
    expect(getByText("Aqui você vê seu resumo do dia.")).toBeTruthy();
  });
});
