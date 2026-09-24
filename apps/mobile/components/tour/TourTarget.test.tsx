import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
// @ts-expect-error -- módulo de mock do jest do RN, sem .d.ts
import MockNativeMethods from "react-native/jest/MockNativeMethods";

const mockRegisterTarget = jest.fn();
let mockCurrentStepId: string | null = "home-tab";
jest.mock("@/lib/tour/tour-context", () => ({
  useTour: () => ({
    active: true,
    currentStepId: mockCurrentStepId,
    registerTarget: mockRegisterTarget,
  }),
}));

import { TourTarget } from "./TourTarget";

type MeasureCb = (x: number, y: number, w: number, h: number) => void;
const measureInWindow = (MockNativeMethods as { measureInWindow: unknown })
  .measureInWindow as jest.Mock<(cb: MeasureCb) => void>;

beforeEach(() => {
  jest.useFakeTimers();
  mockRegisterTarget.mockReset();
  mockCurrentStepId = "home-tab";
});

afterEach(() => {
  measureInWindow.mockReset();
  jest.useRealTimers();
});

function advanceFrames(n: number) {
  for (let i = 0; i < n; i++) {
    act(() => {
      jest.advanceTimersByTime(16);
    });
  }
}

test("só registra quando a medida para de mudar, já com o retângulo final", () => {
  // Largura animando (aba abrindo) por 5 frames, depois parada.
  const widths = [40, 60, 80, 100, 110];
  let call = 0;
  measureInWindow.mockImplementation((cb) => {
    const width = widths[Math.min(call, widths.length - 1)]!;
    call += 1;
    cb(10, 50, width, 40);
  });

  render(
    <TourTarget id="home-tab">
      <Text>Home</Text>
    </TourTarget>,
  );

  advanceFrames(20);
  // Uma única chamada = nenhuma largura intermediária da animação vazou.
  expect(mockRegisterTarget).toHaveBeenCalledTimes(1);
  expect(mockRegisterTarget).toHaveBeenCalledWith("home-tab", {
    x: 10,
    y: 50,
    width: 110,
    height: 40,
  });
});

test("não mede quando o passo atual é outro", () => {
  mockCurrentStepId = "social-tab";
  render(
    <TourTarget id="home-tab">
      <Text>Home</Text>
    </TourTarget>,
  );
  advanceFrames(10);
  expect(measureInWindow).not.toHaveBeenCalled();
});

test("alvo invisível (0×0, display: none) nunca registra", () => {
  measureInWindow.mockImplementation((cb) => cb(0, 0, 0, 0));
  render(
    <TourTarget id="home-tab">
      <Text>Home</Text>
    </TourTarget>,
  );
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(mockRegisterTarget).not.toHaveBeenCalled();
});
