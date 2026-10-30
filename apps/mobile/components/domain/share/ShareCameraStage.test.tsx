import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

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
        mockMontagensDaCamera += 1;
        if (mockAvisaPronta) (onReady as unknown as (() => void) | undefined)?.();
        // Deps vazias de propósito: a câmera avisa "pronta" UMA vez, ao montar.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <View testID="camera-live" />;
    },
  };
});

let mockTrocarIndice: ((i: number) => void) | null = null;
jest.mock("@/components/domain/SwipeableTabs", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    SwipeableTabs: ({ children, onIndexChange }: Record<string, never>) => {
      mockTrocarIndice = onIndexChange as never;
      // Todas as cenas montadas, de propósito: o pager real monta só a visitada,
      // e isso esconderia uma câmera montada por cena.
      return <View testID="pager">{children}</View>;
    },
  };
});

let mockMontagensDaCamera = 0;

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

const ALTURA_VAO = 500;

/** Monta o palco e dispara o `onLayout` do vão — o jest não faz layout. */
function montar(props: Record<string, unknown> = {}) {
  const tela = render(
    <ShareCameraStage
      data={DADOS}
      temMacros
      onCapture={jest.fn()}
      onIndisponivel={jest.fn()}
      onErroCaptura={jest.fn()}
      {...props}
    />,
  );
  fireEvent(tela.getByTestId("slot-card"), "layout", {
    nativeEvent: { layout: { height: ALTURA_VAO, width: 390, x: 0, y: 0 } },
  });
  return tela;
}

describe("ShareCameraStage", () => {
  beforeEach(() => {
    mockCapturar.mockReset();
    mockCapturar.mockResolvedValue(undefined);
    mockAoCapturar = null;
    mockAoErrar = null;
    mockAvisaPronta = true;
    mockMontagensDaCamera = 0;
    mockTrocarIndice = null;
  });

  test("monta UMA câmera só, não uma por preset", () => {
    const { getAllByTestId } = montar();

    // Com TODAS as cinco cenas montadas (ver o mock do pager), uma câmera por
    // cena daria cinco. Montar uma por cena pediria permissão cinco vezes e
    // travaria o aparelho — é a razão de a câmera viver fora do pager.
    expect(getAllByTestId("camera-live")).toHaveLength(1);
    expect(mockMontagensDaCamera).toBe(1);
  });

  test("o card cabe no vão que sobra, não na área inteira da tela", () => {
    const { getByTestId } = montar();

    // A regressão que isto pega: usar a escala calculada pela TELA, que mede a
    // área inteira sem descontar o label e o obturador que este palco acrescenta
    // — o card saía ~135dp maior que o vão e sangrava por cima do cabeçalho.
    const { height } = StyleSheet.flatten(getByTestId("card-preview").props.style);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(ALTURA_VAO);
  });

  test("leva os cinco presets ao vivo para o carrossel", () => {
    const { getAllByTestId } = montar();

    // Conta cenas, não o label do próprio palco: o label diria "Noturno" mesmo
    // com um carrossel de um item só.
    expect(getAllByTestId("cena-preset")).toHaveLength(5);
  });

  test("sem macros, o carrossel ao vivo cai para três", () => {
    const { getAllByTestId } = montar({ temMacros: false });

    expect(getAllByTestId("cena-preset")).toHaveLength(3);
  });

  test("o obturador dispara a captura da câmera", async () => {
    const { getByLabelText } = montar();

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
    const { getByLabelText } = montar();

    fireEvent.press(getByLabelText("Tirar foto"));

    expect(mockCapturar).not.toHaveBeenCalled();
  });

  test("entrega a captura com o preset em cena, não com o primeiro", async () => {
    const onCapture = jest.fn();
    montar({ onCapture });

    // Índice NÃO-ZERO de propósito: no índice 0 um `presetId` cravado em
    // "noturno" passaria, e o teste não provaria nada.
    await act(async () => {
      mockTrocarIndice?.(2);
    });
    await act(async () => {
      mockAoCapturar?.("blob:frame", { width: 1080, height: 1920 });
    });

    expect(onCapture).toHaveBeenCalledWith("blob:frame", { width: 1080, height: 1920 }, "etiqueta");
  });

  test("falha na captura avisa a tela em vez de sumir calada", async () => {
    const onErroCaptura = jest.fn();
    mockCapturar.mockRejectedValue(new Error("frame_sem_dados"));
    const { getByLabelText } = montar({ onErroCaptura });

    await act(async () => {
      fireEvent.press(getByLabelText("Tirar foto"));
    });

    // Sem isto, a promessa do obturador rejeita sem dono: nada na tela, nada no
    // Sentry, e a pessoa toca de novo achando que não registrou.
    expect(onErroCaptura).toHaveBeenCalled();
  });

  test("toque duplo no obturador captura uma vez só", async () => {
    let resolver: (() => void) | null = null;
    mockCapturar.mockImplementation(() => new Promise<void>((r) => (resolver = () => r())));
    const { getByLabelText } = montar();

    // No nativo `takePictureAsync` leva centenas de ms — um toque duplo normal
    // cai dentro da janela. Duas capturas = dois uploads correndo no mesmo path
    // e o que fica salvo pode não ser o frame que a pessoa compartilhou.
    await act(async () => {
      fireEvent.press(getByLabelText("Tirar foto"));
    });
    await act(async () => {
      fireEvent.press(getByLabelText("Tirar foto"));
    });

    expect(mockCapturar).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver?.();
    });
  });

  test("câmera indisponível avisa a tela em vez de mostrar quadro preto", async () => {
    const onIndisponivel = jest.fn();
    montar({ onIndisponivel });

    await act(async () => {
      mockAoErrar?.("negada");
    });

    expect(onIndisponivel).toHaveBeenCalledWith("negada");
  });
});
