import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

const mockConfirm = jest.fn<(o: Record<string, unknown>) => Promise<boolean>>();
const mockBack = jest.fn();
const mockGetMeal = jest.fn<(id: string) => Promise<unknown>>();
const mockPatchMeal = jest.fn<(id: string, b: unknown) => Promise<void>>();
const mockFetchPost = jest.fn<(id: string) => Promise<unknown>>();
const mockFetchInsight = jest.fn<(id: string) => Promise<unknown>>();
const mockSignedUrl = jest.fn<(p: string) => Promise<string>>();
const mockUpload = jest.fn<(p: Record<string, unknown>) => Promise<{ path: string }>>();
const mockPick = jest.fn<() => Promise<string | null>>();
const mockCapture = jest.fn<() => Promise<string>>();
const mockSave = jest.fn<(uri: string) => Promise<void>>();

let mockAoCapturar: ((uri: string, t: { width: number; height: number }) => void) | null = null;
let mockAoPronta: (() => void) | null = null;

jest.mock("@/lib/dialog/dialog-context", () => ({
  useDialog: () => ({ confirm: mockConfirm }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock("@/lib/api/meals", () => ({
  getMeal: (id: string) => mockGetMeal(id),
  patchMeal: (id: string, b: unknown) => mockPatchMeal(id, b),
}));
jest.mock("@/lib/api/posts", () => ({ fetchPost: (id: string) => mockFetchPost(id) }));
jest.mock("@/lib/api/insights", () => ({ fetchInsight: (id: string) => mockFetchInsight(id) }));
jest.mock("@/lib/storage", () => ({
  getPostImageSignedUrl: (p: string) => mockSignedUrl(p),
  uploadMealPhoto: (p: Record<string, unknown>) => mockUpload(p),
}));
jest.mock("@/lib/media/image-picker", () => ({ pickImage: () => mockPick() }));
jest.mock("@/lib/media/measure-image", () => ({
  medirImagem: async () => ({ width: 1080, height: 1920 }),
}));
jest.mock("@/lib/hooks/useAuthSession", () => ({
  useAuthSession: () => ({ status: "signed_in", session: { user: { id: "u1" } } }),
}));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => jest.fn() }));
jest.mock("@/lib/share-card", () => ({
  captureCard: () => mockCapture(),
  shareCard: jest.fn(),
  saveCardToGallery: (uri: string) => mockSave(uri),
  podeCompartilharArquivos: () => true,
  toDisplayableImageUri: async (u: string) => u,
}));
jest.mock("@/components/domain/CameraLive", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CameraLive: ({ onCapture, onReady }: Record<string, never>) => {
      mockAoCapturar = onCapture as never;
      mockAoPronta = onReady as never;
      return <View testID="camera-live" />;
    },
  };
});

import { ShareFlow } from "./ShareFlow";

const REFEICAO = {
  items: [{ description: "Frango" }],
  image_path: null as string | null,
  total_kcal: 612,
  total_protein_g: 48,
  total_carbs_g: 58,
  total_fat_g: 19,
  consumed_at: "2026-10-11T12:00:00Z",
};

function montar(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Espera a câmera aparecer: ela só monta depois de medir a área. */
async function abrirCamera(r: ReturnType<typeof render>) {
  const area = await r.findByTestId("area-camera");
  fireEvent(area, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 760 } } });
  await r.findByTestId("camera-live");
  act(() => mockAoPronta?.());
}

async function tirarFoto(uri = "blob:nova") {
  await act(async () => mockAoCapturar?.(uri, { width: 1080, height: 1920 }));
}

async function exportar(r: ReturnType<typeof render>) {
  const botao = await r.findByLabelText("Salvar na galeria");
  await act(async () => fireEvent.press(botao));
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
}

describe("ShareFlow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(false);
    mockGetMeal.mockResolvedValue(REFEICAO);
    mockPatchMeal.mockResolvedValue(undefined);
    mockSignedUrl.mockResolvedValue("https://x/assinada");
    mockUpload.mockResolvedValue({ path: "p" });
    mockCapture.mockResolvedValue("blob:png");
    mockSave.mockResolvedValue(undefined);
  });

  test("refeição sem foto abre a câmera sem perguntar", async () => {
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("refeição com foto pergunta com os dois rótulos", async () => {
    mockGetMeal.mockResolvedValue({ ...REFEICAO, image_path: "u1/m1.jpg" });
    montar(<ShareFlow type="meal" id="m1" />);

    await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "Usar a foto salva", cancelLabel: "Tirar outra" }),
    );
  });

  test("usar a foto salva abre o editor sem montar a câmera", async () => {
    mockConfirm.mockResolvedValue(true);
    mockGetMeal.mockResolvedValue({ ...REFEICAO, image_path: "u1/m1.jpg" });
    const r = montar(<ShareFlow type="meal" id="m1" />);

    await r.findByTestId("area-editor");
    expect(r.queryByTestId("camera-live")).toBeNull();
  });

  test("usar a foto salva e exportar não sobe nada", async () => {
    mockConfirm.mockResolvedValue(true);
    mockGetMeal.mockResolvedValue({ ...REFEICAO, image_path: "u1/m1.jpg" });
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await exportar(r);

    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("tirar outra abre a câmera, e a foto nova não substitui a original", async () => {
    mockGetMeal.mockResolvedValue({ ...REFEICAO, image_path: "u1/m1.jpg" });
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await tirarFoto();
    await exportar(r);

    expect(mockSave).toHaveBeenCalledWith("blob:png");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("foto salva que não carregou: não pergunta e nunca sobrescreve", async () => {
    mockSignedUrl.mockRejectedValue(new Error("offline"));
    mockGetMeal.mockResolvedValue({ ...REFEICAO, image_path: "u1/m1.jpg" });
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await tirarFoto();
    await exportar(r);

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("refeição sem foto ganha a foto no primeiro export, uma vez só", async () => {
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await tirarFoto();
    expect(mockUpload).not.toHaveBeenCalled();

    await exportar(r);
    await exportar(r);

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith({ userId: "u1", mealId: "m1", fileUri: "blob:nova" });
    await waitFor(() => expect(mockPatchMeal).toHaveBeenCalledWith("m1", { has_photo: true }));
    expect(mockPatchMeal).toHaveBeenCalledTimes(1);
  });

  test("exportar, voltar, tirar outra e exportar não salva de novo", async () => {
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await tirarFoto("blob:primeira");
    await exportar(r);

    fireEvent.press(r.getByLabelText("Voltar"));
    await abrirCamera(r);
    await tirarFoto("blob:segunda");
    await exportar(r);

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({ fileUri: "blob:primeira" }));
  });

  test("falha ao salvar deixa o próximo export tentar de novo", async () => {
    mockUpload.mockRejectedValueOnce(new Error("rede"));
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await tirarFoto();
    await exportar(r);
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    await act(async () => {});

    await exportar(r);
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
  });

  test("voltar sem exportar descarta a foto e reabre a câmera", async () => {
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await tirarFoto();
    await r.findByTestId("area-editor");

    fireEvent.press(r.getByLabelText("Voltar"));
    await abrirCamera(r);

    expect(r.queryByTestId("area-editor")).toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("sem foto, mesmo havendo foto salva, abre o editor sem foto", async () => {
    mockGetMeal.mockResolvedValue({ ...REFEICAO, image_path: "u1/m1.jpg" });
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    fireEvent.press(r.getByLabelText("Continuar sem foto"));

    await r.findByTestId("area-editor");
    expect(r.queryByLabelText("Desligar vinheta")).toBeNull();
    expect(r.getByText("Pôster")).toBeTruthy();
  });

  test("galeria leva ao editor", async () => {
    mockPick.mockResolvedValue("blob:galeria");
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await act(async () => fireEvent.press(r.getByLabelText("Escolher foto da galeria")));

    await r.findByTestId("area-editor");
  });

  test("galeria cancelada continua na câmera", async () => {
    mockPick.mockResolvedValue(null);
    const r = montar(<ShareFlow type="meal" id="m1" />);
    await abrirCamera(r);
    await act(async () => fireEvent.press(r.getByLabelText("Escolher foto da galeria")));

    expect(r.queryByTestId("area-editor")).toBeNull();
  });

  test("post abre o editor com a foto dele, e voltar fecha a tela", async () => {
    mockFetchPost.mockResolvedValue({
      caption: "Almoço",
      image_path: "p.jpg",
      total_kcal: 500,
      total_protein_g: 30,
      total_carbs_g: 50,
      total_fat_g: 10,
      created_at: "2026-10-11T12:00:00Z",
    });
    const r = montar(<ShareFlow type="post" id="p1" />);

    await r.findByTestId("area-editor");
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(r.getByLabelText("Desligar vinheta")).toBeTruthy();

    fireEvent.press(r.getByLabelText("Voltar"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test("exportar um post nunca salva na refeição", async () => {
    mockFetchPost.mockResolvedValue({
      caption: "Almoço",
      image_path: "p.jpg",
      total_kcal: 500,
      total_protein_g: 30,
      total_carbs_g: 50,
      total_fat_g: 10,
      created_at: "2026-10-11T12:00:00Z",
    });
    const r = montar(<ShareFlow type="post" id="p1" />);
    await exportar(r);

    expect(mockUpload).not.toHaveBeenCalled();
  });

  test("análise abre direto, em Pôster", async () => {
    mockFetchInsight.mockResolvedValue({
      payload: { title: "Semana", headline: "Boa", bullets: [], score: 80 },
      created_at: "2026-10-11T12:00:00Z",
    });
    const r = montar(<ShareFlow type="insight" id="i1" />);

    await r.findByTestId("area-editor");
    expect(r.getByText("Pôster")).toBeTruthy();
  });

  test("falha ao carregar avisa e deixa voltar", async () => {
    mockGetMeal.mockRejectedValue(new Error("x"));
    const r = montar(<ShareFlow type="meal" id="m1" />);

    await r.findByText(/Não foi possível carregar/);
    fireEvent.press(r.getByLabelText("Voltar"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
