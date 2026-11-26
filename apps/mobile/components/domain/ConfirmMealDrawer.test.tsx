import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { MealResponse } from "@fitbrother/shared";

const mockMutate = jest.fn();
const mockRemove = jest.fn();
const mockConfirm = jest.fn<(opts: { title: string }) => Promise<boolean>>();
const mockToast = jest.fn();
const mockProfile = { timezone: "America/Sao_Paulo", day_start_hour: 4 };
const mockUpdateState = { isPending: false };

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

import { ConfirmMealDrawer } from "./ConfirmMealDrawer";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const DAY = "2026-11-24";
const CONSUMED_AT = new Date(2026, 10, 24, 12, 40).toISOString();

const rice = {
  id: ITEM_ID,
  food_id: null,
  description: "Arroz, tipo 1, cozido",
  quantity: 100,
  unit: "g",
  kcal: 128,
  protein_g: 2.5,
  carbs_g: 28,
  fat_g: 0.2,
};

const beans = {
  ...rice,
  id: "44444444-4444-4444-8444-444444444444",
  description: "Feijão carioca",
  quantity: 80,
  kcal: 61,
};

const pending = {
  id: MEAL_ID,
  source: "app_text",
  raw_input: "arroz e feijão no almoço",
  image_path: null,
  meal_type: "lunch",
  consumed_at: CONSUMED_AT,
  ai_feedback: null,
  confidence: 0.9,
  review_required: true,
  items: [rice, beans],
} as unknown as MealResponse;

const onClose = jest.fn();
const onDirtyChange = jest.fn();

function tree(m: MealResponse) {
  return <ConfirmMealDrawer meal={m} onClose={onClose} onDirtyChange={onDirtyChange} />;
}

function renderDrawer(over: Partial<MealResponse> = {}) {
  return render(tree({ ...pending, ...over } as MealResponse));
}

const confirmButton = () => screen.getByRole("button", { name: "Confirmar" });
const discardButton = () => screen.getByRole("button", { name: "Descartar refeição" });
const sentPatch = () => mockMutate.mock.calls[0]?.[0] as Record<string, unknown>;

function settle(kind: "success" | "error", saved?: MealResponse) {
  const opts = mockMutate.mock.calls[0]?.[1] as {
    onSuccess: (m: MealResponse) => void;
    onError: (e: Error) => void;
  };
  act(() => (kind === "success" ? opts.onSuccess(saved!) : opts.onError(new Error("boom"))));
}

function openAdjust() {
  fireEvent.press(screen.getByRole("button", { name: "Ajustar" }));
}

function stepRiceUp() {
  fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz, tipo 1, cozido"));
}

describe("ConfirmMealDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateState.isPending = false;
    mockMutate.mockImplementation(() => undefined);
  });

  describe("compact view", () => {
    test("shows the label, headline, total, meta line and actions", () => {
      renderDrawer();
      expect(screen.getByText("Entendi isto")).toBeTruthy();
      expect(screen.getByText("Arroz e feijão carioca")).toBeTruthy();
      expect(screen.getByText("189")).toBeTruthy();
      expect(screen.getByText("kcal")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Tipo da refeição: Almoço" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Horário: 12:40" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Ajustar" })).toBeTruthy();
      expect(confirmButton()).toBeTruthy();
      expect(discardButton()).toBeTruthy();
      expect(screen.getByText("Descartar")).toBeTruthy();
    });

    test("twelve items show the count label and the trimmed headline", () => {
      const names = [
        "Arroz",
        "Feijão",
        "Frango",
        "Salada",
        "Tomate",
        "Ovo",
        "Batata",
        "Cenoura",
        "Suco",
        "Pão",
        "Queijo",
        "Banana",
      ];
      renderDrawer({
        items: names.map((description, i) => ({
          ...rice,
          id: `0000000${i}-0000-4000-8000-000000000000`,
          description,
        })) as MealResponse["items"],
      });
      expect(screen.getByText("Entendi 12 itens")).toBeTruthy();
      expect(screen.getByText("Arroz, feijão, frango e mais 9")).toBeTruthy();
    });

    test("typed text shows no extra line", () => {
      renderDrawer();
      expect(screen.queryByText("“arroz e feijão no almoço”")).toBeNull();
      expect(screen.queryByTestId("meal-source-photo-placeholder")).toBeNull();
    });

    test("audio meals show the transcription line", () => {
      renderDrawer({ source: "app_audio", raw_input: "  arroz com feijão  " });
      expect(screen.getByText("“arroz com feijão”")).toBeTruthy();
    });

    test("photo meals show the thumbnail", () => {
      renderDrawer({ source: "app_photo", raw_input: "Foto: u/m.jpg", image_path: null });
      expect(screen.getByTestId("meal-source-photo-placeholder")).toBeTruthy();
    });

    test.each([
      [0.4, true],
      [0.59, true],
      [0.6, false],
      [null, false],
    ])("confidence %s shows the amber line: %s", (confidence, shown) => {
      renderDrawer({ confidence });
      expect(Boolean(screen.queryByText("Não tive certeza das quantidades."))).toBe(shown);
    });
  });

  describe("adjust view", () => {
    test("Ajustar shows the list and the back button returns", () => {
      renderDrawer();
      openAdjust();
      expect(screen.getByText("Ajustar refeição")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Editar Arroz, tipo 1, cozido" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Adicionar item" })).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Voltar ao resumo" }));
      expect(screen.queryByText("Ajustar refeição")).toBeNull();
      expect(screen.getByText("Entendi isto")).toBeTruthy();
    });

    test("the stepper changes the total", () => {
      renderDrawer();
      openAdjust();
      stepRiceUp();
      expect(screen.getByText("110 g")).toBeTruthy();
      expect(screen.getByText("202")).toBeTruthy();
    });
  });

  describe("confirm", () => {
    test("without edits sends only confirm", () => {
      renderDrawer();
      fireEvent.press(confirmButton());
      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(sentPatch()).toEqual({ confirm: true });
    });

    test("after a stepper edit sends items and confirm in one patch", () => {
      renderDrawer();
      openAdjust();
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

    test("after changing only the type sends meal_type without items", () => {
      renderDrawer();
      fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
      fireEvent.press(screen.getByText("Jantar"));
      fireEvent.press(confirmButton());
      expect(sentPatch()).toEqual({ meal_type: "dinner", confirm: true });
    });

    test("an invalid quantity blocks the confirm with the toast and marks the row", () => {
      renderDrawer();
      openAdjust();
      fireEvent.press(screen.getByLabelText("Editar Arroz, tipo 1, cozido"));
      fireEvent.changeText(screen.getByLabelText("Quantidade"), "100000");
      fireEvent.press(screen.getByText("Concluir item"));
      fireEvent.press(confirmButton());
      expect(mockToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Item 1 com campos inválidos",
      });
      expect(screen.getAllByTestId("drawer-item-row")[0].props.className).toContain("bg-danger-50");
      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("a double tap sends once", () => {
      renderDrawer();
      fireEvent.press(confirmButton());
      fireEvent.press(confirmButton());
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    test("success shows the toast and closes", () => {
      renderDrawer();
      fireEvent.press(confirmButton());
      settle("success", { ...pending, review_required: false } as MealResponse);
      expect(mockToast).toHaveBeenCalledWith({
        variant: "success",
        message: "Refeição registrada",
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("failure shows the error toast and keeps the draft", () => {
      renderDrawer();
      openAdjust();
      stepRiceUp();
      fireEvent.press(confirmButton());
      settle("error");
      expect(mockToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Não foi possível confirmar",
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByText("110 g")).toBeTruthy();
      fireEvent.press(confirmButton());
      expect(mockMutate).toHaveBeenCalledTimes(2);
    });

    test("a response still pending is a failure and re-inits the draft", () => {
      renderDrawer();
      openAdjust();
      stepRiceUp();
      fireEvent.press(confirmButton());
      settle("success", {
        ...pending,
        review_required: true,
        items: [{ ...rice, quantity: 110, kcal: 140.8 }, beans],
      } as MealResponse);
      expect(mockToast).toHaveBeenCalledWith({
        variant: "error",
        message: "Não foi possível confirmar",
      });
      expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByText("110 g")).toBeTruthy();
      fireEvent.press(confirmButton());
      expect(mockMutate.mock.calls[1]?.[0]).toEqual({ confirm: true });
    });

    test("while sending the confirm is loading and edits are blocked", () => {
      mockMutate.mockImplementation(() => {
        mockUpdateState.isPending = true;
      });
      const view = renderDrawer();
      openAdjust();
      fireEvent.press(confirmButton());
      view.rerender(tree(pending));
      expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
      const disabled = { disabled: true };
      expect(
        screen.getByLabelText("Aumentar quantidade de Arroz, tipo 1, cozido").props
          .accessibilityState,
      ).toMatchObject(disabled);
      expect(
        screen.getByLabelText("Editar Arroz, tipo 1, cozido").props.accessibilityState,
      ).toMatchObject(disabled);
      expect(
        screen.getByRole("button", { name: "Adicionar item" }).props.accessibilityState,
      ).toMatchObject(disabled);
      expect(
        screen.getByLabelText("Tipo da refeição: Almoço").props.accessibilityState,
      ).toMatchObject(disabled);
      expect(discardButton().props.accessibilityState).toMatchObject(disabled);
    });
  });

  describe("discard", () => {
    test("asks, deletes and closes", async () => {
      mockConfirm.mockResolvedValue(true);
      renderDrawer();
      fireEvent.press(discardButton());
      await waitFor(() => expect(mockRemove).toHaveBeenCalled());
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Descartar refeição?",
          description: "Ela será excluída e não entra no seu dia.",
          confirmLabel: "Descartar",
          destructive: true,
        }),
      );
      expect(mockRemove.mock.calls[0]?.[0]).toEqual({ id: MEAL_ID, day: DAY });
      const opts = mockRemove.mock.calls[0]?.[1] as { onSuccess: () => void };
      act(() => opts.onSuccess());
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("refusing keeps the meal", async () => {
      mockConfirm.mockResolvedValue(false);
      renderDrawer();
      fireEvent.press(discardButton());
      await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
      expect(mockRemove).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    test("confirming with zero items goes to the discard flow", async () => {
      mockConfirm.mockResolvedValue(true);
      renderDrawer({ items: [] });
      fireEvent.press(confirmButton());
      await waitFor(() => expect(mockRemove).toHaveBeenCalled());
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Descartar refeição?" }),
      );
      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("removing the last item goes to the discard flow", async () => {
      mockConfirm.mockResolvedValue(true);
      renderDrawer({ items: [rice] as MealResponse["items"] });
      openAdjust();
      fireEvent.press(screen.getByLabelText("Editar Arroz, tipo 1, cozido"));
      fireEvent.press(screen.getByLabelText("Remover item"));
      await waitFor(() => expect(mockRemove).toHaveBeenCalled());
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Descartar refeição?", destructive: true }),
      );
    });
  });

  describe("item view", () => {
    test("tapping a name opens the editor and Concluir item returns to the list", () => {
      renderDrawer();
      openAdjust();
      fireEvent.press(screen.getByLabelText("Editar Arroz, tipo 1, cozido"));
      expect(screen.getByDisplayValue("Arroz, tipo 1, cozido")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Voltar à lista" })).toBeTruthy();
      expect(screen.queryByText("Ajustar refeição")).toBeNull();
      fireEvent.press(screen.getByText("Concluir item"));
      expect(screen.getByText("Ajustar refeição")).toBeTruthy();
    });

    test("removing an item returns to the list without it", () => {
      renderDrawer();
      openAdjust();
      fireEvent.press(screen.getByLabelText("Editar Feijão carioca"));
      fireEvent.press(screen.getByLabelText("Remover item"));
      expect(screen.getByText("Ajustar refeição")).toBeTruthy();
      expect(screen.queryByLabelText("Editar Feijão carioca")).toBeNull();
      expect(screen.getByText("128")).toBeTruthy();
    });

    test("a new unnamed item is discarded when going back", () => {
      renderDrawer();
      openAdjust();
      fireEvent.press(screen.getByRole("button", { name: "Adicionar item" }));
      expect(screen.getByRole("button", { name: "Voltar à lista" })).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Voltar à lista" }));
      expect(screen.getAllByTestId("drawer-item-row")).toHaveLength(2);
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  test("onDirtyChange follows the edits", () => {
    renderDrawer();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    openAdjust();
    stepRiceUp();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  test("onDirtyChange follows a meta change", () => {
    renderDrawer();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByText("Jantar"));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  describe("meal data replaced", () => {
    const chicken = {
      ...rice,
      id: "55555555-5555-4555-8555-555555555555",
      description: "Frango grelhado",
      quantity: 120,
      kcal: 190,
    };
    const threeItems = [rice, beans, chicken] as MealResponse["items"];
    const twoItems = [rice, beans] as MealResponse["items"];

    function openChicken() {
      const view = renderDrawer({ items: threeItems });
      openAdjust();
      fireEvent.press(screen.getByLabelText("Editar Frango grelhado"));
      expect(screen.getByRole("button", { name: "Voltar à lista" })).toBeTruthy();
      return view;
    }

    test("a clean draft leaves the item view for the adjust list", () => {
      const view = openChicken();
      view.rerender(tree({ ...pending, items: twoItems } as MealResponse));
      expect(screen.queryByRole("button", { name: "Voltar à lista" })).toBeNull();
      expect(screen.getByText("Ajustar refeição")).toBeTruthy();
      expect(screen.getAllByTestId("drawer-item-row")).toHaveLength(2);
    });

    test("a dirty draft is kept and stays on the open item", () => {
      const view = openChicken();
      fireEvent.changeText(screen.getByLabelText("Quantidade"), "250");
      view.rerender(tree({ ...pending, items: twoItems } as MealResponse));
      expect(screen.getByDisplayValue("Frango grelhado")).toBeTruthy();
      expect(screen.getByDisplayValue("250")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Voltar à lista" }));
      expect(screen.getAllByTestId("drawer-item-row")).toHaveLength(3);
    });
  });

  test("cancelling the discard after removing the last item keeps it", async () => {
    mockConfirm.mockResolvedValue(false);
    renderDrawer({ items: [rice] as MealResponse["items"] });
    openAdjust();
    fireEvent.press(screen.getByLabelText("Editar Arroz, tipo 1, cozido"));
    fireEvent.press(screen.getByLabelText("Remover item"));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockRemove).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Ajustar refeição")).toBeTruthy();
    expect(screen.getAllByTestId("drawer-item-row")).toHaveLength(1);
  });

  test("a failed delete shows the toast and keeps the drawer", async () => {
    mockConfirm.mockResolvedValue(true);
    renderDrawer();
    fireEvent.press(discardButton());
    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    const opts = mockRemove.mock.calls[0]?.[1] as { onError: (e: Error) => void };
    act(() => opts.onError(new Error("boom")));
    expect(mockToast).toHaveBeenCalledWith({
      variant: "error",
      message: "Não foi possível excluir",
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("taps while sending change nothing and send nothing", () => {
    mockUpdateState.isPending = true;
    renderDrawer();
    fireEvent.press(confirmButton());
    fireEvent.press(screen.getByRole("button", { name: "Ajustar" }));
    expect(screen.queryByText("Ajustar refeição")).toBeNull();
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("189")).toBeTruthy();
  });
});
