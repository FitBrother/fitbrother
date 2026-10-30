import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockCapturar = jest.fn<() => Promise<void>>();
let mockAoCapturar: ((uri: string, t: { width: number; height: number }) => void) | null = null;
let mockAoErrar: ((motivo: string) => void) | null = null;
// A câmera de verdade só avisa quando monta; este interruptor deixa o teste
// exercitar o estado "ainda não pronta".
let mockAvisaPronta = true;

jest.mock("@/components/domain/CameraLive", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { useEffect, useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  return {
    CameraLive: ({ ref, onCapture, onError, onReady }: Record<string, never>) => {
      mockAoCapturar = onCapture as never;
      mockAoErrar = onError as never;
      // `capturar` é o nome no CameraLiveHandle — o prefixo mock existe só
      // porque a factory do jest.mock não alcança variável de fora sem ele.
      useImperativeHandle(ref, () => ({ capturar: mockCapturar }), []);
      // Em efeito, e não no render: `onReady` é setState do pai, e a câmera de
      // verdade também só avisa depois de montar.
      useEffect(() => {
        if (mockAvisaPronta) (onReady as unknown as (() => void) | undefined)?.();
        // Deps vazias de propósito: a câmera avisa "pronta" UMA vez, ao montar.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <View testID="camera-live" />;
    },
  };
});

import { ShareCameraStage } from "./ShareCameraStage";
import type { ShareCardData } from "@/components/domain/ShareCard";

const DADOS: ShareCardData = {
  kind: "meal",
  headline: "Peito de frango grelhado",
  imageUrl: null,
  kcal: 612,
  protein_g: 48,
  carbs_g: 58,
  fat_g: 19,
  dateLabel: "11 out",
};

describe("ShareCameraStage", () => {
  beforeEach(() => {
    mockCapturar.mockReset();
    mockCapturar.mockResolvedValue(undefined);
    mockAoCapturar = null;
    mockAoErrar = null;
    mockAvisaPronta = true;
  });

  test("monta UMA câmera só, não uma por preset", () => {
    const { getAllByTestId } = render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={jest.fn()}
      />,
    );

    // Cinco presets ao vivo, uma câmera. Montar uma por cena travaria o
    // aparelho e pediria permissão cinco vezes.
    expect(getAllByTestId("camera-live")).toHaveLength(1);
  });

  test("mostra o cromo dos cinco presets ao vivo", () => {
    const { getByText } = render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={jest.fn()}
      />,
    );

    expect(getByText("Noturno")).toBeTruthy();
  });

  test("o obturador dispara a captura da câmera", async () => {
    const { getByLabelText } = render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={jest.fn()}
      />,
    );

    // `fireEvent.press`, e não `props.onPress()`: além de ser a API do RNTL,
    // ele respeita o `disabled` — o que faz este teste também provar que o
    // obturador já está habilitado quando a câmera avisou que está pronta.
    await act(async () => {
      fireEvent.press(getByLabelText("Tirar foto"));
    });

    expect(mockCapturar).toHaveBeenCalled();
  });

  test("o obturador fica desabilitado até a câmera avisar que está pronta", () => {
    mockAvisaPronta = false;
    const { getByLabelText } = render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={jest.fn()}
      />,
    );

    fireEvent.press(getByLabelText("Tirar foto"));

    expect(mockCapturar).not.toHaveBeenCalled();
  });

  test("entrega a captura com o preset em cena", async () => {
    const onCapture = jest.fn();
    render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={onCapture}
        onIndisponivel={jest.fn()}
      />,
    );

    await act(async () => {
      mockAoCapturar?.("blob:frame", { width: 1080, height: 1920 });
    });

    // O preset em cena viaja junto: a tela volta ao carrossel completo já
    // naquele estilo, em vez de pular para o primeiro.
    expect(onCapture).toHaveBeenCalledWith("blob:frame", { width: 1080, height: 1920 }, "noturno");
  });

  test("câmera indisponível avisa a tela em vez de mostrar quadro preto", async () => {
    const onIndisponivel = jest.fn();
    render(
      <ShareCameraStage
        data={DADOS}
        escala={0.5}
        onCapture={jest.fn()}
        onIndisponivel={onIndisponivel}
      />,
    );

    await act(async () => {
      mockAoErrar?.("negada");
    });

    expect(onIndisponivel).toHaveBeenCalledWith("negada");
  });
});
