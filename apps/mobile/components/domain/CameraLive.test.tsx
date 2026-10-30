import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";

type Permissao = { granted: boolean; canAskAgain: boolean } | null;

let mockPermissao: Permissao = null;
const mockPedirPermissao = jest.fn<() => Promise<{ granted: boolean }>>();

jest.mock("expo-camera", () => {
  const { View } = jest.requireActual("react-native");
  return {
    CameraView: (props: Record<string, never>) => <View testID="camera-view" {...props} />,
    useCameraPermissions: () => [mockPermissao, mockPedirPermissao],
  };
});

import { CameraLive } from "./CameraLive";

describe("CameraLive (nativo)", () => {
  beforeEach(() => {
    mockPedirPermissao.mockReset();
    mockPedirPermissao.mockResolvedValue({ granted: true });
    mockPermissao = null;
  });

  test("permissão negada em definitivo avisa uma vez, não a cada render", () => {
    mockPermissao = { granted: false, canAskAgain: false };
    const onError = jest.fn();

    const tela = render(<CameraLive aspect={0.5625} onCapture={jest.fn()} onError={onError} />);
    // Re-render com as MESMAS props: é o que acontece quando o pai troca de
    // preset. Avisar de novo aqui empilharia banner de erro e, no caminho de
    // render, dispararia setState do pai no meio do render do filho.
    tela.update(<CameraLive aspect={0.5625} onCapture={jest.fn()} onError={onError} />);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("negada");
  });

  test("pede permissão uma vez quando ainda pode pedir", () => {
    mockPermissao = { granted: false, canAskAgain: true };

    const tela = render(<CameraLive aspect={0.5625} onCapture={jest.fn()} onError={jest.fn()} />);
    tela.update(<CameraLive aspect={0.5625} onCapture={jest.fn()} onError={jest.fn()} />);

    expect(mockPedirPermissao).toHaveBeenCalledTimes(1);
  });

  test("sem permissão não monta a câmera", () => {
    mockPermissao = { granted: false, canAskAgain: false };

    const { queryByTestId } = render(
      <CameraLive aspect={0.5625} onCapture={jest.fn()} onError={jest.fn()} />,
    );

    expect(queryByTestId("camera-view")).toBeNull();
  });

  test("com permissão monta a câmera", () => {
    mockPermissao = { granted: true, canAskAgain: false };

    const { getByTestId } = render(
      <CameraLive aspect={0.5625} onCapture={jest.fn()} onError={jest.fn()} />,
    );

    expect(getByTestId("camera-view")).toBeTruthy();
  });
});
