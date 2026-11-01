import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";
import { FOTO_PADRAO, type FotoLivre, type Sticker } from "@/lib/share/story";
import type { StoryCardData } from "./StoryCard";

const mockCaptureCard = jest.fn<() => Promise<string>>();
const mockShareCard = jest.fn<(uri: string) => Promise<void>>();
const mockSave = jest.fn<(uri: string) => Promise<void>>();
const mockPodeCompartilhar = jest.fn<() => boolean>();

jest.mock("@/lib/share-card", () => ({
  captureCard: () => mockCaptureCard(),
  shareCard: (uri: string) => mockShareCard(uri),
  saveCardToGallery: (uri: string) => mockSave(uri),
  podeCompartilharArquivos: () => mockPodeCompartilhar(),
}));

const mockToast = jest.fn();
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => mockToast }));

type Fim = (removido: string | null, stickers: Sticker[], foto: FotoLivre) => void;
let mockFim: Fim = () => {};
let mockValoresStickers: { value: Sticker[] } = { value: [] };

jest.mock("./useStoryGestos", () => {
  const { Gesture } = jest.requireActual<typeof import("react-native-gesture-handler")>(
    "react-native-gesture-handler",
  );
  const { useSharedValue } =
    jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");
  return {
    useStoryGestos: ({ stickers, onFim }: { stickers: { value: Sticker[] }; onFim: Fim }) => {
      mockFim = onFim;
      mockValoresStickers = stickers;
      return { gesto: Gesture.Tap(), sobreLixeira: useSharedValue(false) };
    },
  };
});

import { StoryEditor } from "./StoryEditor";

const DADOS: StoryCardData = {
  kind: "meal",
  headline: "Frango grelhado",
  imageUrl: null,
  temFotoSalva: false,
  kcal: 612,
  protein_g: 48,
  carbs_g: 58,
  fat_g: 19,
  dateLabel: "11 out",
};

function montar(over: Partial<Parameters<typeof StoryEditor>[0]> = {}) {
  const props = {
    data: DADOS,
    foto: "blob:foto" as string | null,
    fotoNatural: { width: 1080, height: 1920 },
    presetInicial: "completo" as const,
    vinhetaInicial: true,
    onVoltar: jest.fn(),
    onExportar: jest.fn(),
    ...over,
  };
  const r = render(<StoryEditor {...props} />);
  fireEvent(r.getByTestId("area-editor"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 760 } },
  });
  return { ...r, props };
}

describe("StoryEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCaptureCard.mockResolvedValue("blob:png");
    mockShareCard.mockResolvedValue(undefined);
    mockSave.mockResolvedValue(undefined);
    mockPodeCompartilhar.mockReturnValue(true);
  });

  test("sem canShare não há Compartilhar, e Baixar segue lá", () => {
    jest.replaceProperty(Platform, "OS", "web");
    mockPodeCompartilhar.mockReturnValue(false);
    const { queryByLabelText, getByLabelText } = montar();
    expect(queryByLabelText("Compartilhar imagem")).toBeNull();
    expect(getByLabelText("Baixar imagem")).toBeTruthy();
    jest.restoreAllMocks();
  });

  test("no nativo o botão é salvar na galeria", () => {
    expect(montar().getByLabelText("Salvar na galeria")).toBeTruthy();
  });

  test("baixar captura, salva e avisa a tela", async () => {
    const { getByLabelText, props } = montar();
    await act(async () => fireEvent.press(getByLabelText("Salvar na galeria")));

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith("blob:png"));
    expect(props.onExportar).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  test("compartilhar captura e avisa a tela", async () => {
    const { getByLabelText, props } = montar();
    await act(async () => fireEvent.press(getByLabelText("Compartilhar imagem")));

    await waitFor(() => expect(mockShareCard).toHaveBeenCalledWith("blob:png"));
    expect(props.onExportar).toHaveBeenCalledTimes(1);
  });

  test("cancelar a folha de compartilhar não é erro", async () => {
    const aborto = new Error("x");
    aborto.name = "AbortError";
    mockShareCard.mockRejectedValue(aborto);
    const { getByLabelText } = montar();
    await act(async () => fireEvent.press(getByLabelText("Compartilhar imagem")));

    expect(mockToast).not.toHaveBeenCalled();
  });

  test("trocar de preset refaz os stickers e aplica a vinheta dele", () => {
    const r = montar();
    expect(r.queryAllByTestId("vinheta")).not.toHaveLength(0);

    fireEvent.press(r.getByLabelText("Preset Etiqueta"));

    expect(mockValoresStickers.value.map((s) => s.id)).toEqual(["placa", "logo"]);
    expect(r.queryAllByTestId("vinheta")).toHaveLength(0);
  });

  test("tocar no preset selecionado devolve o sticker removido", () => {
    const r = montar();
    const stickers = mockValoresStickers.value;
    act(() => mockFim("itens", stickers, FOTO_PADRAO));
    expect(mockValoresStickers.value.find((s) => s.id === "itens")?.removido).toBe(true);

    fireEvent.press(r.getByLabelText("Refazer Completo"));
    expect(mockValoresStickers.value.find((s) => s.id === "itens")?.removido).toBe(false);
  });

  test("o gesto soltado chega ao nó da captura", () => {
    const r = montar();
    const stickers = mockValoresStickers.value.map((s) =>
      s.id === "calorias" ? { ...s, dx: 40 } : s,
    );
    act(() => mockFim(null, stickers, FOTO_PADRAO));

    // O nó de captura é o que vira PNG, e é o único que usa a caixa estática.
    const caixa = r.getByTestId("sticker-calorias", { includeHiddenElements: true });
    expect(StyleSheet.flatten(caixa.props.style).transform).toContainEqual({ translateX: 40 });
  });

  test("o logo não pode ser removido", () => {
    montar();
    const stickers = mockValoresStickers.value;
    act(() => mockFim("logo", stickers, FOTO_PADRAO));
    expect(mockValoresStickers.value.find((s) => s.id === "logo")?.removido).toBe(false);
  });

  test("a vinheta alterna", () => {
    const r = montar();
    fireEvent.press(r.getByLabelText("Desligar vinheta"));
    expect(r.queryAllByTestId("vinheta")).toHaveLength(0);
    fireEvent.press(r.getByLabelText("Ligar vinheta"));
    expect(r.queryAllByTestId("vinheta")).not.toHaveLength(0);
  });

  test("sem foto não há botão de vinheta", () => {
    const { queryByLabelText } = montar({ foto: null, presetInicial: "poster" });
    expect(queryByLabelText("Desligar vinheta")).toBeNull();
    expect(queryByLabelText("Ligar vinheta")).toBeNull();
  });

  test("voltar chama onVoltar", () => {
    const { getByLabelText, props } = montar();
    fireEvent.press(getByLabelText("Voltar"));
    expect(props.onVoltar).toHaveBeenCalledTimes(1);
  });

  test("preset que não cabe no conteúdo cai no primeiro da lista", () => {
    const { getByText } = montar({ foto: null, presetInicial: "etiqueta" });
    expect(getByText("Pôster")).toBeTruthy();
  });
});
