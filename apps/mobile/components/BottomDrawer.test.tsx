import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler, Dimensions, StyleSheet, Text } from "react-native";
import type { NativeEventSubscription } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BottomDrawer } from "./BottomDrawer";

const WINDOW_HEIGHT = 800;
const LABEL = "Confirmar refeição";

type BackHandlerListener = () => boolean | null | undefined;
let backListeners: BackHandlerListener[] = [];
let removeSpies: jest.Mock[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Dimensions, "get").mockReturnValue({
    width: 400,
    height: WINDOW_HEIGHT,
    scale: 2,
    fontScale: 1,
  });
  backListeners = [];
  removeSpies = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(((
    _event: string,
    listener: BackHandlerListener,
  ) => {
    backListeners.push(listener);
    const remove = jest.fn(() => {
      backListeners = backListeners.filter((l) => l !== listener);
    });
    removeSpies.push(remove);
    return { remove } as NativeEventSubscription;
  }) as typeof BackHandler.addEventListener);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const metrics = {
  frame: { x: 0, y: 0, width: 400, height: WINDOW_HEIGHT },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function drawer(props: Partial<React.ComponentProps<typeof BottomDrawer>> = {}) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <BottomDrawer visible onClose={jest.fn()} accessibilityLabel={LABEL} {...props}>
        <Text>conteudo</Text>
      </BottomDrawer>
    </SafeAreaProvider>
  );
}

describe("BottomDrawer", () => {
  test("invisível desde o início não renderiza nada", () => {
    const { queryByText, queryByLabelText } = render(drawer({ visible: false }));

    expect(queryByText("conteudo")).toBeNull();
    expect(queryByLabelText("Fechar")).toBeNull();
    expect(queryByLabelText(LABEL)).toBeNull();
  });

  test("visível renderiza os filhos e o painel como dialog com o label", () => {
    const { getByText, getByLabelText } = render(drawer());

    expect(getByText("conteudo")).toBeTruthy();
    expect(getByLabelText(LABEL).props.role).toBe("dialog");
  });

  test("tocar no fundo fecha uma vez", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(drawer({ onClose }));

    fireEvent.press(getByLabelText("Fechar"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("tocar dentro do painel não fecha e entrega o toque aos filhos", () => {
    const onClose = jest.fn();
    const onChild = jest.fn();
    const { getByText, getByLabelText } = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomDrawer visible onClose={onClose} accessibilityLabel={LABEL}>
          <Text onPress={onChild}>conteudo</Text>
        </BottomDrawer>
      </SafeAreaProvider>,
    );

    fireEvent.press(getByLabelText(LABEL));
    fireEvent.press(getByText("conteudo"));

    expect(onChild).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("o botão voltar do Android fecha enquanto visível", () => {
    const onClose = jest.fn();
    render(drawer({ onClose }));

    expect(backListeners).toHaveLength(1);
    expect(backListeners[0]?.()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("invisível não registra o listener de voltar", () => {
    render(drawer({ visible: false }));

    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });

  test("o listener sai ao fechar e ao desmontar", () => {
    const { rerender, unmount } = render(drawer());
    expect(backListeners).toHaveLength(1);

    rerender(drawer({ visible: false }));
    expect(removeSpies[0]).toHaveBeenCalledTimes(1);
    expect(backListeners).toHaveLength(0);

    rerender(drawer({ visible: true }));
    expect(backListeners).toHaveLength(1);

    unmount();
    expect(removeSpies[1]).toHaveBeenCalledTimes(1);
    expect(backListeners).toHaveLength(0);
  });

  test("o teto de altura do painel é 0,88 da janela por padrão", () => {
    const { getByLabelText } = render(drawer());

    expect(StyleSheet.flatten(getByLabelText(LABEL).props.style).maxHeight).toBe(
      WINDOW_HEIGHT * 0.88,
    );
  });

  test("respeita maxHeightRatio customizado", () => {
    const { getByLabelText } = render(drawer({ maxHeightRatio: 0.5 }));

    expect(StyleSheet.flatten(getByLabelText(LABEL).props.style).maxHeight).toBe(
      WINDOW_HEIGHT * 0.5,
    );
  });

  test("ao ficar invisível, desmonta o overlay depois da saída", () => {
    const { rerender, queryByText, queryByLabelText } = render(drawer());

    rerender(drawer({ visible: false }));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(queryByText("conteudo")).toBeNull();
    expect(queryByLabelText("Fechar")).toBeNull();
  });

  test("reabrir depois de fechar mostra o drawer de novo", () => {
    const { rerender, getByText } = render(drawer());

    rerender(drawer({ visible: false }));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    rerender(drawer({ visible: true }));

    expect(getByText("conteudo")).toBeTruthy();
  });
});
