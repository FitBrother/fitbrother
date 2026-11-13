import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

const mockCapturar = jest.fn<() => Promise<void>>();
let mockAoCapturar: ((uri: string, t: { width: number; height: number }) => void) | null = null;
let mockAoErrar: ((motivo: string) => void) | null = null;
let mockAoPronta: (() => void) | null = null;
let mockMontagens = 0;
let mockProps: Record<string, unknown> = {};

jest.mock("@/components/domain/CameraLive", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { useEffect, useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  return {
    CameraLive: ({ ref, onCapture, onError, onReady, ...resto }: Record<string, never>) => {
      mockAoCapturar = onCapture as never;
      mockAoErrar = onError as never;
      mockAoPronta = onReady as never;
      mockProps = resto;
      useImperativeHandle(ref, () => ({ capturar: mockCapturar }), []);
      useEffect(() => {
        mockMontagens += 1;
      }, []);
      return <View testID="camera-live" />;
    },
  };
});

import { CameraStage } from "./CameraStage";

function montar(over: Partial<Parameters<typeof CameraStage>[0]> = {}) {
  const props = {
    aspect: 9 / 16,
    rotulo: "Compartilhar",
    onCapture: jest.fn(),
    onGaleria: jest.fn(),
    onSemFoto: jest.fn(),
    onFechar: jest.fn(),
    onErroCaptura: jest.fn(),
    ...over,
  };
  const r = render(<CameraStage {...props} />);
  fireEvent(r.getByTestId("area-camera"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 760 } },
  });
  return { ...r, props };
}

describe("CameraStage", () => {
  beforeEach(() => {
    mockCapturar.mockReset();
    mockCapturar.mockResolvedValue(undefined);
    mockMontagens = 0;
    mockProps = {};
  });

  test("monta uma câmera só, na proporção pedida", () => {
    const { getAllByTestId } = montar();
    expect(getAllByTestId("camera-live")).toHaveLength(1);
    expect(mockProps.aspect).toBeCloseTo(9 / 16);
  });

  test("o quadro ocupa a largura da área", () => {
    const { getByTestId } = montar();
    expect(getByTestId("quadro-camera").props.style).toMatchObject({ width: 390, height: 693 });
  });

  test("o disparo fica bloqueado até a câmera avisar que está pronta", async () => {
    const { getByLabelText } = montar();
    fireEvent.press(getByLabelText("Tirar foto"));
    expect(mockCapturar).not.toHaveBeenCalled();

    act(() => mockAoPronta?.());
    await act(async () => fireEvent.press(getByLabelText("Tirar foto")));
    expect(mockCapturar).toHaveBeenCalledTimes(1);
  });

  test("toque duplo não captura duas vezes", async () => {
    let soltar: () => void = () => {};
    mockCapturar.mockReturnValue(new Promise<void>((r) => (soltar = r)));
    const { getByLabelText } = montar();
    act(() => mockAoPronta?.());

    fireEvent.press(getByLabelText("Tirar foto"));
    fireEvent.press(getByLabelText("Tirar foto"));
    expect(mockCapturar).toHaveBeenCalledTimes(1);
    await act(async () => soltar());
  });

  test("falha ao capturar vai para onErroCaptura", async () => {
    const erro = new Error("frame_sem_dados");
    mockCapturar.mockRejectedValue(erro);
    const { getByLabelText, props } = montar();
    act(() => mockAoPronta?.());

    await act(async () => fireEvent.press(getByLabelText("Tirar foto")));
    expect(props.onErroCaptura).toHaveBeenCalledWith(erro);
  });

  test("entrega a foto capturada", () => {
    const { props } = montar();
    act(() => mockAoCapturar?.("blob:x", { width: 1080, height: 1920 }));
    expect(props.onCapture).toHaveBeenCalledWith("blob:x", { width: 1080, height: 1920 });
  });

  test("virar a câmera troca o lado sem remontar", () => {
    const { getByLabelText } = montar();
    expect(mockProps.facing).toBe("back");

    fireEvent.press(getByLabelText("Virar câmera"));
    expect(mockProps.facing).toBe("front");
    expect(mockMontagens).toBe(1);
  });

  test("sem câmera, avisa e mantém galeria e sem foto", () => {
    const { getByText, getByLabelText, props } = montar();
    act(() => mockAoErrar?.("negada"));

    expect(getByText(/Sem câmera aqui/)).toBeTruthy();
    fireEvent.press(getByLabelText("Tirar foto"));
    expect(mockCapturar).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText("Escolher foto da galeria"));
    fireEvent.press(getByLabelText("Continuar sem foto"));
    expect(props.onGaleria).toHaveBeenCalledTimes(1);
    expect(props.onSemFoto).toHaveBeenCalledTimes(1);
  });

  test("fechar chama onFechar", () => {
    const { getByLabelText, props } = montar();
    fireEvent.press(getByLabelText("Fechar"));
    expect(props.onFechar).toHaveBeenCalledTimes(1);
  });

  test("o rótulo da etapa aparece na barra", () => {
    expect(montar({ rotulo: "Novo post" }).getByText("Novo post")).toBeTruthy();
  });

  test("desenha a sobreposição do tamanho do quadro", () => {
    const sobreposicao = jest.fn(({ width }: { width: number }) => (
      <Text>{`largura ${width}`}</Text>
    ));
    expect(montar({ sobreposicao }).getByText("largura 390")).toBeTruthy();
  });

  test("a fila substitui o disparo padrão e recebe como disparar", async () => {
    const { getByText, queryByLabelText } = montar({
      fila: ({ disparar }) => <Text onPress={disparar}>fila</Text>,
    });
    expect(queryByLabelText("Tirar foto")).toBeNull();

    act(() => mockAoPronta?.());
    await act(async () => fireEvent.press(getByText("fila")));
    expect(mockCapturar).toHaveBeenCalledTimes(1);
  });
});
