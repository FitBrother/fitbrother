import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { MealResponse } from "@fitbrother/shared";

const mockMutate = jest.fn();
const mockRemove = jest.fn();
const mockConfirm = jest.fn<(opts: { title: string }) => Promise<boolean>>();
const mockToast = jest.fn();
const mockProfile = { timezone: "America/Sao_Paulo", day_start_hour: 4 };

type GuardCallback = (opts: { data: { action: unknown } }) => void;
const BACK_ACTION = { type: "GO_BACK" };
const mockGuard: { prevent: boolean; callback: GuardCallback | null } = {
  prevent: false,
  callback: null,
};
const mockLeave = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockUpdateState = { isPending: false };
const mockBack = jest.fn(() => {
  if (mockGuard.prevent && mockGuard.callback)
    mockGuard.callback({ data: { action: BACK_ACTION } });
  else mockLeave(BACK_ACTION);
});
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: jest.fn(),
    canGoBack: mockCanGoBack,
  }),
  useNavigation: () => ({ dispatch: mockLeave }),
}));
jest.mock("@react-navigation/native", () => ({
  usePreventRemove: (prevent: boolean, callback: GuardCallback) => {
    mockGuard.prevent = prevent;
    mockGuard.callback = callback;
  },
}));
jest.mock("@/lib/hooks/useUpdateMeal", () => ({
  useUpdateMeal: () => ({ mutate: mockMutate, isPending: mockUpdateState.isPending }),
}));
jest.mock("@/lib/hooks/useDeleteMeal", () => ({
  useDeleteMeal: () => ({ mutate: mockRemove, isPending: false }),
}));
jest.mock("@/lib/dialog/dialog-context", () => ({
  useDialog: () => ({ confirm: mockConfirm }),
}));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => mockToast }));
jest.mock("@/lib/profile/profile-context", () => ({ useProfile: () => mockProfile }));
jest.mock("@/lib/hooks/useFoodSuggestions", () => ({
  useFoodSuggestions: () => ({ data: [], isLoading: false }),
}));
jest.mock("@/lib/storage", () => ({
  getPostImageSignedUrl: () => new Promise(() => {}),
}));

import { MealEditor } from "./MealEditor";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const DAY = "2026-11-24";
const CONSUMED_AT = new Date(2026, 10, 24, 12, 40).toISOString();

const pending = {
  id: MEAL_ID,
  source: "app_text",
  raw_input: "arroz no almoço",
  image_path: null,
  meal_type: "lunch",
  consumed_at: CONSUMED_AT,
  ai_feedback: null,
  confidence: 0.9,
  review_required: true,
  items: [
    {
      id: ITEM_ID,
      food_id: null,
      description: "Arroz cozido",
      quantity: 100,
      unit: "g",
      kcal: 128,
      protein_g: 2.5,
      carbs_g: 28,
      fat_g: 0.2,
    },
  ],
} as unknown as MealResponse;

const metrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

function tree(m: MealResponse) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <MealEditor meal={m} />
    </SafeAreaProvider>
  );
}

function renderPending(over: Partial<MealResponse> = {}) {
  return render(tree({ ...pending, ...over } as MealResponse));
}

function confirmButton() {
  return screen.getByRole("button", { name: "Confirmar refeição" });
}

function sentPatch(): Record<string, unknown> {
  return mockMutate.mock.calls[0]?.[0] as Record<string, unknown>;
}

function settle(kind: "success" | "error", saved?: MealResponse) {
  const opts = mockMutate.mock.calls[0]?.[1] as {
    onSuccess: (m: MealResponse) => void;
    onError: (e: Error) => void;
  };
  act(() => (kind === "success" ? opts.onSuccess(saved!) : opts.onError(new Error("boom"))));
}

function stepRiceUp() {
  fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz cozido"));
}

describe("MealEditor pending mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack.mockReturnValue(true);
    mockUpdateState.isPending = false;
  });

  test("shows the confirmation layout", () => {
    renderPending();
    expect(screen.getByText("Confirme o que entendi")).toBeTruthy();
    expect(screen.queryByText("Refeição")).toBeNull();
    expect(screen.getByText("Você escreveu")).toBeTruthy();
    expect(screen.getByText("“arroz no almoço”")).toBeTruthy();
    expect(screen.getByText("ainda não conta no seu dia")).toBeTruthy();
    expect(screen.getByText("Ajuste o que estiver errado")).toBeTruthy();
    expect(confirmButton()).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descartar refeição" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Excluir refeição" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Compartilhar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo post" })).toBeNull();
  });

  test("audio meals show what the user said", () => {
    renderPending({ source: "app_audio", raw_input: "pão com ovo" });
    expect(screen.getByText("Você disse")).toBeTruthy();
    expect(screen.getByText("“pão com ovo”")).toBeTruthy();
  });

  test("photo meals show the photo label and the item count", () => {
    renderPending({ source: "app_photo", raw_input: "Foto: x", image_path: "u/m.jpg" });
    expect(screen.getByText("Foto do prato")).toBeTruthy();
    expect(screen.getByText("Identifiquei 1 item na foto")).toBeTruthy();
  });

  test("edits keep the confirm button and never show the save bar", () => {
    renderPending();
    stepRiceUp();
    expect(confirmButton()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
    expect(screen.getByText("ainda não conta no seu dia")).toBeTruthy();
  });

  test.each([
    [0.4, true],
    [0.59, true],
    [0.6, false],
    [null, false],
  ])("confidence %s shows the uncertainty banner: %s", (confidence, shown) => {
    renderPending({ confidence });
    expect(Boolean(screen.queryByText("Não tive certeza de alguns itens"))).toBe(shown);
    if (shown) {
      expect(
        screen.getByText("Confira os alimentos e as quantidades antes de confirmar."),
      ).toBeTruthy();
    }
  });

  test("confirming without edits sends only confirm", () => {
    renderPending();
    fireEvent.press(confirmButton());
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(sentPatch()).toEqual({ confirm: true });
  });

  test("confirming after a stepper edit sends items and confirm in one patch", () => {
    renderPending();
    stepRiceUp();
    fireEvent.press(confirmButton());
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(sentPatch()).toMatchObject({ confirm: true });
    expect((sentPatch().items as Record<string, unknown>[])[0]).toMatchObject({
      id: ITEM_ID,
      quantity: 110,
    });
    expect(sentPatch()).not.toHaveProperty("meal_type");
  });

  test("confirming after changing only the type sends meal_type without items", () => {
    renderPending();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByText("Jantar"));
    fireEvent.press(confirmButton());
    expect(sentPatch()).toEqual({ meal_type: "dinner", confirm: true });
  });

  test("an invalid quantity blocks the confirm with the toast", () => {
    renderPending();
    fireEvent.press(screen.getByLabelText("Editar Arroz cozido"));
    fireEvent.changeText(screen.getByLabelText("Quantidade"), "100000");
    fireEvent.press(screen.getByText("Concluir item"));
    fireEvent.press(confirmButton());
    expect(mockToast).toHaveBeenCalledWith({
      variant: "error",
      message: "Item 1 com campos inválidos",
    });
    expect(screen.getByTestId("meal-item-row").props.className).toContain("border-danger-500");
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test("a successful confirm shows the toast and leaves pending mode", () => {
    renderPending();
    stepRiceUp();
    fireEvent.press(confirmButton());
    settle("success", {
      ...pending,
      review_required: false,
      items: [{ ...pending.items[0], quantity: 110, kcal: 140.8 }],
    } as MealResponse);
    expect(mockToast).toHaveBeenCalledWith({ variant: "success", message: "Refeição registrada" });
    expect(screen.getByText("Refeição")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar refeição" })).toBeNull();
    expect(screen.queryByText("ainda não conta no seu dia")).toBeNull();
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeTruthy();
    expect(screen.getByText("110 g")).toBeTruthy();
    expect(screen.queryByText(/^[+−]\d+ kcal$/)).toBeNull();
  });

  test("a failed confirm shows the toast and keeps the pending draft", () => {
    renderPending();
    stepRiceUp();
    fireEvent.press(confirmButton());
    settle("error");
    expect(mockToast).toHaveBeenCalledWith({
      variant: "error",
      message: "Não foi possível confirmar",
    });
    expect(screen.getByText("Confirme o que entendi")).toBeTruthy();
    expect(screen.getByText("110 g")).toBeTruthy();
    expect(confirmButton()).toBeTruthy();
  });

  test("a double tap sends once", () => {
    renderPending();
    fireEvent.press(confirmButton());
    fireEvent.press(confirmButton());
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  test("while confirming the button is loading and edits are blocked", () => {
    mockMutate.mockImplementation(() => {
      mockUpdateState.isPending = true;
    });
    const view = renderPending();
    fireEvent.press(confirmButton());
    view.rerender(tree(pending));
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    expect(
      screen.getByLabelText("Aumentar quantidade de Arroz cozido").props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(
      screen.getByRole("button", { name: "Descartar refeição" }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  test("discard asks, then deletes and goes back", async () => {
    mockConfirm.mockResolvedValue(true);
    renderPending();
    fireEvent.press(screen.getByRole("button", { name: "Descartar refeição" }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Descartar refeição?",
        description: "Ela será excluída e não entra no seu dia.",
        destructive: true,
      }),
    );
    expect(mockRemove.mock.calls[0]?.[0]).toEqual({ id: MEAL_ID, day: DAY });
    const opts = mockRemove.mock.calls[0]?.[1] as { onSuccess: () => void };
    act(() => opts.onSuccess());
    expect(mockBack).toHaveBeenCalled();
    expect(mockLeave).toHaveBeenCalledWith(BACK_ACTION);
  });

  test("discard with edits leaves without asking twice", async () => {
    mockConfirm.mockResolvedValue(true);
    renderPending();
    stepRiceUp();
    fireEvent.press(screen.getByRole("button", { name: "Descartar refeição" }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    const opts = mockRemove.mock.calls[0]?.[1] as { onSuccess: () => void };
    act(() => opts.onSuccess());
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockLeave).toHaveBeenCalledWith(BACK_ACTION);
  });

  test("refusing the discard keeps the meal", async () => {
    mockConfirm.mockResolvedValue(false);
    renderPending();
    fireEvent.press(screen.getByRole("button", { name: "Descartar refeição" }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockRemove).not.toHaveBeenCalled();
  });

  test("leaving without edits leaves at once and deletes nothing", () => {
    renderPending();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockLeave).toHaveBeenCalledWith(BACK_ACTION);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test("leaving with edits asks to discard the changes", async () => {
    mockConfirm.mockResolvedValue(false);
    renderPending();
    stepRiceUp();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Descartar alterações?" }),
      ),
    );
    expect(mockLeave).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  test("a confirmed meal shows none of the pending pieces", () => {
    renderPending({ review_required: false, confidence: 0.3 });
    expect(screen.getByText("Refeição")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir refeição" })).toBeTruthy();
    expect(screen.queryByText("Você escreveu")).toBeNull();
    expect(screen.queryByText("ainda não conta no seu dia")).toBeNull();
    expect(screen.queryByText("Não tive certeza de alguns itens")).toBeNull();
    expect(screen.queryByText("Ajuste o que estiver errado")).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar refeição" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Descartar refeição" })).toBeNull();
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeTruthy();
  });
});
