import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockPick = jest.fn<(o: unknown) => Promise<string | null>>();
const mockCapturar = jest.fn<() => Promise<void>>();
let mockProps: Record<string, unknown> = {};

jest.mock("@/lib/media/image-picker", () => ({ pickImage: (o: unknown) => mockPick(o) }));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => jest.fn() }));
jest.mock("@/components/domain/CameraLive", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  return {
    CameraLive: ({ ref, ...resto }: Record<string, never>) => {
      mockProps = resto;
      useImperativeHandle(ref, () => ({ capturar: mockCapturar }), []);
      return <View testID="camera-live" />;
    },
  };
});

import { PostCameraStep } from "./PostCameraStep";

function montar() {
  const props = { onFoto: jest.fn(), onSemFoto: jest.fn(), onFechar: jest.fn() };
  const r = render(<PostCameraStep {...props} />);
  fireEvent(r.getByTestId("area-camera"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 760 } },
  });
  act(() => (mockProps.onReady as () => void)());
  return { ...r, props };
}

describe("PostCameraStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProps = {};
  });

  test("abre a câmera no quadro 4:5 do feed", () => {
    montar();
    expect(mockProps.aspect).toBe(0.8);
  });

  test("capturar entrega a foto", () => {
    const { props } = montar();
    act(() => (mockProps.onCapture as (u: string, t: unknown) => void)("blob:foto", {}));
    expect(props.onFoto).toHaveBeenCalledWith("blob:foto");
  });

  test("sem foto segue para o formulário", () => {
    const { props, getByLabelText } = montar();
    fireEvent.press(getByLabelText("Continuar sem foto"));
    expect(props.onSemFoto).toHaveBeenCalledTimes(1);
    expect(props.onFoto).not.toHaveBeenCalled();
  });

  test("galeria pede a qualidade máxima, porque quem comprime é o recorte", async () => {
    mockPick.mockResolvedValue("file:///galeria.jpg");
    const { props, getByLabelText } = montar();
    await act(async () => fireEvent.press(getByLabelText("Escolher foto da galeria")));

    expect(mockPick).toHaveBeenCalledWith({ quality: 1 });
    expect(props.onFoto).toHaveBeenCalledWith("file:///galeria.jpg");
  });

  test("galeria cancelada continua na câmera", async () => {
    mockPick.mockResolvedValue(null);
    const { props, getByLabelText } = montar();
    await act(async () => fireEvent.press(getByLabelText("Escolher foto da galeria")));

    expect(props.onFoto).not.toHaveBeenCalled();
  });

  test("não tem fila de presets: no feed não há card para escolher", () => {
    const { queryByLabelText, getByLabelText } = montar();
    expect(getByLabelText("Tirar foto")).toBeTruthy();
    expect(queryByLabelText(/^Preset /)).toBeNull();
  });
});
