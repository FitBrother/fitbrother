import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeEventSubscription, StyleProp, ViewStyle } from "react-native";
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
        {props.children ?? <Text>conteudo</Text>}
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

  test("tocar num botão dentro do painel aciona o filho e não fecha", () => {
    const onClose = jest.fn();
    const onChild = jest.fn();
    const { getByLabelText } = render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomDrawer visible onClose={onClose} accessibilityLabel={LABEL}>
          <Pressable accessibilityRole="button" accessibilityLabel="Salvar" onPress={onChild}>
            <Text>Salvar</Text>
          </Pressable>
        </BottomDrawer>
      </SafeAreaProvider>,
    );

    fireEvent.press(getByLabelText("Salvar"));

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

  test("a cadeia painel até o conteúdo encolhe com um filho alto (teclado aberto)", () => {
    const { getByTestId, getByLabelText } = render(
      drawer({ children: <View style={{ height: 2000 }} /> }),
    );

    const flat = (node: { props: { style?: unknown } }): ViewStyle =>
      StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {};
    const encolhe = (node: { props: { style?: unknown; className?: string } }) =>
      flat(node).flexShrink === 1 || /\bshrink\b/.test(String(node.props.className ?? ""));

    expect(flat(getByTestId("bottom-drawer-wrapper")).flexShrink).toBe(1);
    expect(encolhe(getByLabelText(LABEL))).toBe(true);
    expect(encolhe(getByTestId("bottom-drawer-content"))).toBe(true);
  });

  test("reabrir no meio da saída mantém o drawer visível", () => {
    const { rerender, getByText } = render(drawer());

    rerender(drawer({ visible: false }));
    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender(drawer({ visible: true }));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(getByText("conteudo")).toBeTruthy();
  });

  test("o overlay ignora toques enquanto sai e deixa passar enquanto visível", () => {
    const { rerender, getByTestId } = render(drawer());
    const eventos = () => StyleSheet.flatten(getByTestId("bottom-drawer-overlay").props.style);

    expect(eventos().pointerEvents).toBe("box-none");
    expect(getByTestId("bottom-drawer-overlay").props["aria-modal"]).toBe(true);

    rerender(drawer({ visible: false }));
    expect(eventos().pointerEvents).toBe("none");
  });
});
