import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { FoodSuggestion, MealResponse } from "@fitbrother/shared";
import { nutritionalDay } from "@/lib/time/nutritional-day";

const mockMutate = jest.fn();
const mockRemove = jest.fn();
const mockConfirm = jest.fn<(opts: { title: string }) => Promise<boolean>>();
const mockToast = jest.fn();
const mockUpdateArgs = jest.fn();
const mockProfile = { timezone: "America/Sao_Paulo", day_start_hour: 4 };

type GuardCallback = (opts: { data: { action: unknown } }) => void;
const BACK_ACTION = { type: "GO_BACK" };
const mockGuard: { prevent: boolean; callback: GuardCallback | null } = {
  prevent: false,
  callback: null,
};
const mockLeave = jest.fn();
const mockPush = jest.fn();
// Simulates the navigator: a back attempt goes through the prevent-remove guard.
const mockBack = jest.fn(() => {
  if (mockGuard.prevent && mockGuard.callback)
    mockGuard.callback({ data: { action: BACK_ACTION } });
  else mockLeave(BACK_ACTION);
});
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: mockPush }),
  useNavigation: () => ({ dispatch: mockLeave }),
}));
jest.mock("@react-navigation/native", () => ({
  usePreventRemove: (prevent: boolean, callback: GuardCallback) => {
    mockGuard.prevent = prevent;
    mockGuard.callback = callback;
  },
}));
jest.mock("@/lib/hooks/useUpdateMeal", () => ({
  useUpdateMeal: (...args: unknown[]) => {
    mockUpdateArgs(...args);
    return { mutate: mockMutate, isPending: false };
  },
}));
jest.mock("@/lib/hooks/useDeleteMeal", () => ({
  useDeleteMeal: () => ({ mutate: mockRemove, isPending: false }),
}));
jest.mock("@/lib/dialog/dialog-context", () => ({
  useDialog: () => ({ confirm: mockConfirm }),
}));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => mockToast }));
jest.mock("@/lib/profile/profile-context", () => ({ useProfile: () => mockProfile }));
jest.mock("@/lib/hooks/useFoodSuggestions", () => ({ useFoodSuggestions: jest.fn() }));
jest.mock("@/components/WheelPicker", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    WheelPicker: ({ max, onChange }: { max: number; onChange: (v: number) => void }) => (
      <Pressable accessibilityLabel={`Roda ${max}`} onPress={() => onChange(max)}>
        <Text>{`roda ${max}`}</Text>
      </Pressable>
    ),
  };
});

import { useFoodSuggestions } from "@/lib/hooks/useFoodSuggestions";
import { MealEditor } from "./MealEditor";

const FOOD_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const DAY = "2026-11-24";
const CONSUMED_AT = new Date(2026, 10, 24, 12, 40).toISOString();

const meal = {
  id: MEAL_ID,
  meal_type: "lunch",
  consumed_at: CONSUMED_AT,
  ai_feedback: null,
  review_required: false,
  items: [
    {
      id: ITEM_ID,
      food_id: FOOD_ID,
      description: "Arroz, tipo 1, cozido",
      quantity: 100,
      unit: "g",
      kcal: 128,
      protein_g: 2.5,
      carbs_g: 28,
      fat_g: 0.2,
    },
  ],
} as unknown as MealResponse;

const rice: FoodSuggestion = {
  kind: "catalog",
  food_id: FOOD_ID,
  name: "Arroz, tipo 1, cozido",
  serving_label: null,
  serving_grams: null,
  kcal_per_100g: 128,
  protein_per_100g: 2.5,
  carbs_per_100g: 28,
  fat_per_100g: 0.2,
  quantity: null,
  unit: null,
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
};

const metrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

const twoItemMeal = {
  ...meal,
  items: [
    ...meal.items,
    {
      id: "44444444-4444-4444-8444-444444444444",
      food_id: null,
      description: "Feijão carioca",
      quantity: 80,
      unit: "g",
      kcal: 61,
      protein_g: 3.8,
      carbs_g: 10.9,
      fat_g: 0.4,
    },
  ],
} as unknown as MealResponse;

function editorTree(m: MealResponse, banner?: (ctx: { dirty: boolean }) => React.ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <MealEditor meal={m} banner={banner} />
    </SafeAreaProvider>
  );
}

function renderEditor(
  m: MealResponse = meal,
  banner?: (ctx: { dirty: boolean }) => React.ReactNode,
) {
  return render(editorTree(m, banner));
}

function withRice(quantity: number, kcal: number): MealResponse {
  return { ...meal, items: [{ ...meal.items[0], quantity, kcal }] } as unknown as MealResponse;
}

function mockSaveReturns(...saved: MealResponse[]) {
  for (const m of saved) {
    mockMutate.mockImplementationOnce((...args: unknown[]) => {
      (args[1] as { onSuccess: (r: MealResponse) => void }).onSuccess(m);
    });
  }
}

function saveBar() {
  return screen.queryByRole("button", { name: "Salvar alterações" });
}

function stepRiceUp() {
  fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz, tipo 1, cozido"));
}

function pickDinner() {
  fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
  fireEvent.press(screen.getByText("Jantar"));
}

function savedPatch(): Record<string, unknown> {
  return mockMutate.mock.calls[0]?.[0] as Record<string, unknown>;
}

function savedItems(): Record<string, unknown>[] {
  return savedPatch().items as Record<string, unknown>[];
}

async function save() {
  fireEvent.press(screen.getByRole("button", { name: "Salvar alterações" }));
  await waitFor(() => expect(mockMutate).toHaveBeenCalled());
}

function openRice() {
  fireEvent.press(screen.getByLabelText("Editar Arroz, tipo 1, cozido"));
}

describe("MealEditor", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockRemove.mockReset();
    mockConfirm.mockReset();
    mockToast.mockReset();
    mockUpdateArgs.mockReset();
    mockBack.mockClear();
    mockLeave.mockReset();
    mockPush.mockReset();
    jest.mocked(useFoodSuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodSuggestions>);
  });

  test("without changes there is no save bar and back leaves without asking", () => {
    renderEditor();
    expect(saveBar()).toBeNull();
    expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockLeave).toHaveBeenCalledWith(BACK_ACTION);
  });

  test("a change shows the save bar and hides the share block", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Novo post" })).toBeTruthy();
    stepRiceUp();
    expect(saveBar()).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Compartilhar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo post" })).toBeNull();
  });

  test("Descartar restores the initial items and meta and hides the bar", () => {
    renderEditor();
    stepRiceUp();
    pickDinner();
    expect(screen.getByText("+13 kcal")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Descartar" }));
    expect(saveBar()).toBeNull();
    expect(screen.queryByText("+13 kcal")).toBeNull();
    expect(screen.getByText("100 g")).toBeTruthy();
    expect(screen.getByLabelText("Tipo da refeição: Almoço")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeTruthy();
  });

  test("leaving with changes asks to discard and stays if refused", async () => {
    mockConfirm.mockResolvedValue(false);
    renderEditor();
    stepRiceUp();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Descartar alterações?", destructive: true }),
      ),
    );
    expect(mockLeave).not.toHaveBeenCalled();
  });

  test("leaving with changes leaves once the discard is confirmed", async () => {
    mockConfirm.mockResolvedValue(true);
    renderEditor();
    stepRiceUp();
    // Same path as the iOS swipe and the Android back button.
    act(() => mockGuard.callback?.({ data: { action: BACK_ACTION } }));
    await waitFor(() => expect(mockLeave).toHaveBeenCalledWith(BACK_ACTION));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  test("shows the AI feedback when present", () => {
    renderEditor({ ...meal, ai_feedback: "Boa fonte de carboidrato." } as MealResponse);
    expect(screen.getByText("Boa fonte de carboidrato.")).toBeTruthy();
  });

  test("does not show an AI feedback card when it is null", () => {
    renderEditor();
    expect(screen.queryByTestId("meal-ai-feedback")).toBeNull();
  });

  test("hides the share block while the meal requires review", () => {
    renderEditor({ ...meal, review_required: true } as MealResponse);
    expect(screen.queryByRole("button", { name: "Compartilhar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo post" })).toBeNull();
  });

  test("share block navigates to share and new post", () => {
    renderEditor();
    fireEvent.press(screen.getByRole("button", { name: "Compartilhar" }));
    expect(mockPush).toHaveBeenCalledWith(`/(app)/share/meal/${MEAL_ID}`);
    fireEvent.press(screen.getByRole("button", { name: "Novo post" }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/(app)/post/new",
      params: { meal_id: MEAL_ID },
    });
  });

  test("banner receives the dirty state", () => {
    renderEditor(meal, ({ dirty }) => <Text>{dirty ? "banner sujo" : "banner limpo"}</Text>);
    expect(screen.getByText("banner limpo")).toBeTruthy();
    stepRiceUp();
    expect(screen.getByText("banner sujo")).toBeTruthy();
  });

  test("a successful save stays on screen and resets the baseline to the saved meal", async () => {
    const saved = {
      ...meal,
      meal_type: "dinner",
      items: [{ ...meal.items[0], quantity: 110, kcal: 140.8, protein_g: 2.75 }],
    } as unknown as MealResponse;
    mockMutate.mockImplementation((...args: unknown[]) => {
      const opts = args[1] as { onSuccess: (m: MealResponse) => void };
      opts.onSuccess(saved);
    });
    renderEditor();
    stepRiceUp();
    pickDinner();
    await save();
    await waitFor(() => expect(saveBar()).toBeNull());
    expect(mockToast).toHaveBeenCalledWith({ variant: "success", message: "Alterações salvas" });
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.queryByText("+13 kcal")).toBeNull();
    expect(screen.getByText("141")).toBeTruthy();
    expect(screen.getByLabelText("Tipo da refeição: Jantar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  test("saving an untouched item keeps its food_id", async () => {
    renderEditor();
    fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz, tipo 1, cozido"));
    fireEvent.press(screen.getByLabelText("Diminuir quantidade de Arroz, tipo 1, cozido"));
    await save();
    expect(savedItems()[0]).toMatchObject({
      id: ITEM_ID,
      food_id: FOOD_ID,
      quantity: 100,
      kcal: 128,
    });
  });

  test("the row stepper scales a saved item and the summary shows the delta", async () => {
    renderEditor();
    expect(screen.queryByText("+13 kcal")).toBeNull();
    fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz, tipo 1, cozido"));
    expect(screen.getByText("110 g")).toBeTruthy();
    expect(screen.getByText("141 kcal")).toBeTruthy();
    expect(screen.getByText("141")).toBeTruthy();
    expect(screen.getByText("+13 kcal")).toBeTruthy();
    await save();
    expect(savedItems()[0]).toMatchObject({ quantity: 110, kcal: 140.8, protein_g: 2.75 });
  });

  test("typing the description in the sheet unlinks the item and keeps macros", async () => {
    renderEditor();
    openRice();
    fireEvent.changeText(screen.getByLabelText("Descrição do item"), "Arroz caseiro");
    fireEvent.press(screen.getByText("Concluir item"));
    expect(screen.queryByLabelText("Descrição do item")).toBeNull();
    expect(screen.getByText("Arroz caseiro")).toBeTruthy();
    await save();
    expect(savedItems()[0]).toMatchObject({
      description: "Arroz caseiro",
      food_id: null,
      kcal: 128,
      protein_g: 2.5,
    });
  });

  test("editing a macro in the sheet flags the row as Ajustado", () => {
    renderEditor();
    openRice();
    fireEvent(screen.getByLabelText("Ajustar macros manualmente"), "valueChange", true);
    fireEvent.changeText(screen.getByLabelText("kcal, valor numérico"), "150");
    fireEvent.press(screen.getByText("Concluir item"));
    expect(screen.getByText("Ajustado")).toBeTruthy();
    expect(screen.getByText("150 kcal")).toBeTruthy();
  });

  test("selecting a suggestion in the sheet links it and rescales on quantity", async () => {
    jest.mocked(useFoodSuggestions).mockReturnValue({
      data: [rice],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodSuggestions>);
    renderEditor();
    openRice();
    fireEvent(screen.getByLabelText("Descrição do item"), "focus");
    fireEvent.press(screen.getByLabelText(/^Arroz, tipo 1, cozido,/));
    fireEvent.changeText(screen.getByLabelText("Quantidade"), "200");
    fireEvent.press(screen.getByText("Concluir item"));
    expect(screen.getByText("256 kcal")).toBeTruthy();
    await save();
    expect(savedItems()[0]).toMatchObject({ food_id: FOOD_ID, quantity: 200, kcal: 256 });
  });

  test("adding an item opens its sheet and closing it unnamed removes the item", () => {
    renderEditor();
    fireEvent.press(screen.getByRole("button", { name: "Buscar e adicionar alimento" }));
    expect(screen.getAllByTestId("meal-item-row")).toHaveLength(2);
    expect(screen.getByLabelText("Descrição do item").props.value).toBe("");
    expect(screen.getByLabelText("Descrição do item").props.autoFocus).toBe(true);
    fireEvent.press(screen.getByText("Concluir item"));
    expect(screen.getAllByTestId("meal-item-row")).toHaveLength(1);
    expect(screen.getByText("Itens · 1")).toBeTruthy();
  });

  test("discarding an unnamed new item leaves the screen clean", () => {
    renderEditor();
    fireEvent.press(screen.getByRole("button", { name: "Buscar e adicionar alimento" }));
    fireEvent.press(screen.getByText("Concluir item"));
    expect(saveBar()).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockLeave).toHaveBeenCalled();
  });

  test("removing a non-last item keeps the error marker on the invalid row", () => {
    renderEditor(twoItemMeal);
    fireEvent.press(screen.getByLabelText("Editar Feijão carioca"));
    fireEvent.changeText(screen.getByLabelText("Quantidade"), "0");
    fireEvent.press(screen.getByText("Concluir item"));
    fireEvent.press(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mockToast).toHaveBeenCalledWith({
      variant: "error",
      message: "Item 2 com campos inválidos",
    });
    openRice();
    fireEvent.press(screen.getByLabelText("Remover item"));
    const rows = screen.getAllByTestId("meal-item-row");
    expect(rows).toHaveLength(1);
    expect(screen.queryByLabelText("Editar Arroz, tipo 1, cozido")).toBeNull();
    expect(screen.getByLabelText("Editar Feijão carioca")).toBeTruthy();
    expect(rows[0]?.props.className).toContain("border-danger-500");
  });

  test("closing a new item that has a name keeps it", () => {
    renderEditor();
    fireEvent.press(screen.getByRole("button", { name: "Buscar e adicionar alimento" }));
    fireEvent.changeText(screen.getByLabelText("Descrição do item"), "Feijão");
    fireEvent.press(screen.getByText("Concluir item"));
    expect(screen.getAllByTestId("meal-item-row")).toHaveLength(2);
    expect(screen.getByText("Itens · 2")).toBeTruthy();
  });

  test("changing the meal type patches meal_type without consumed_at", async () => {
    renderEditor();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByText("Jantar"));
    await save();
    expect(savedPatch()).toMatchObject({ meal_type: "dinner" });
    expect(savedPatch()).not.toHaveProperty("consumed_at");
    expect(savedPatch()).not.toHaveProperty("items");
    expect(mockUpdateArgs).toHaveBeenLastCalledWith(MEAL_ID, DAY, undefined);
  });

  test("changing the time patches consumed_at and passes the new nutritional day", async () => {
    renderEditor();
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    fireEvent.press(screen.getByLabelText("Roda 23"));
    fireEvent.press(screen.getByLabelText("Confirmar"));
    const iso = new Date(2026, 10, 24, 23, 40).toISOString();
    await save();
    expect(savedPatch()).toMatchObject({ consumed_at: iso });
    expect(savedPatch()).not.toHaveProperty("meal_type");
    expect(savedPatch()).not.toHaveProperty("items");
    expect(mockUpdateArgs).toHaveBeenLastCalledWith(
      MEAL_ID,
      DAY,
      nutritionalDay(new Date(iso), mockProfile),
    );
  });

  test("an item with an invalid field shows a toast and does not save", () => {
    renderEditor();
    openRice();
    fireEvent.changeText(screen.getByLabelText("Quantidade"), "0");
    fireEvent.press(screen.getByText("Concluir item"));
    fireEvent.press(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mockToast).toHaveBeenCalledWith({
      variant: "error",
      message: "Item 1 com campos inválidos",
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test("removing every item asks to delete the meal", async () => {
    mockConfirm.mockResolvedValue(true);
    renderEditor();
    openRice();
    fireEvent.press(screen.getByLabelText("Remover item"));
    expect(screen.queryByTestId("meal-item-row")).toBeNull();
    expect(screen.getByText("Sem itens")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Excluir refeição?" }),
    );
    expect(mockRemove.mock.calls[0]?.[0]).toEqual({ id: MEAL_ID, day: DAY });
    expect(mockMutate).not.toHaveBeenCalled();
    const opts = mockRemove.mock.calls[0]?.[1] as { onSuccess: () => void };
    act(() => opts.onSuccess());
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockLeave).toHaveBeenCalledWith(BACK_ACTION);
  });

  test("the trash icon confirms and deletes the meal", async () => {
    mockConfirm.mockResolvedValue(true);
    renderEditor();
    fireEvent.press(screen.getByRole("button", { name: "Excluir refeição" }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Excluir refeição?", destructive: true }),
    );
    expect(mockRemove.mock.calls[0]?.[0]).toEqual({ id: MEAL_ID, day: DAY });
    const opts = mockRemove.mock.calls[0]?.[1] as { onSuccess: () => void };
    act(() => opts.onSuccess());
    expect(mockBack).toHaveBeenCalled();
    expect(mockLeave).toHaveBeenCalledWith(BACK_ACTION);
  });

  test("closing with only a meta change asks to discard", async () => {
    mockConfirm.mockResolvedValue(false);
    renderEditor();
    pickDinner();
    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Descartar alterações?" }),
      ),
    );
  });

  test("an item change still sends items together with the changed meta", async () => {
    renderEditor();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByText("Jantar"));
    fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz, tipo 1, cozido"));
    await save();
    expect(savedPatch()).toMatchObject({ meal_type: "dinner" });
    expect(savedItems()[0]).toMatchObject({ id: ITEM_ID, quantity: 110 });
    expect(mockBack).not.toHaveBeenCalled();
  });

  test.each([
    ["100000", "above the column limit"],
    ["0,001", "below 0.01"],
  ])("quantity %s (%s) marks the row invalid and does not save", (typed) => {
    renderEditor();
    openRice();
    fireEvent.changeText(screen.getByLabelText("Quantidade"), typed);
    fireEvent.press(screen.getByText("Concluir item"));
    fireEvent.press(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mockToast).toHaveBeenCalledWith({
      variant: "error",
      message: "Item 1 com campos inválidos",
    });
    expect(screen.getByTestId("meal-item-row").props.className).toContain("border-danger-500");
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test("trashing an unnamed new item from its sheet leaves the screen clean", () => {
    renderEditor();
    fireEvent.press(screen.getByRole("button", { name: "Buscar e adicionar alimento" }));
    fireEvent.press(screen.getByLabelText("Remover item"));
    expect(screen.getAllByTestId("meal-item-row")).toHaveLength(1);
    expect(saveBar()).toBeNull();
  });
  test("a changed meal prop refreshes a clean screen", () => {
    const view = renderEditor();
    view.rerender(editorTree(withRice(150, 192)));
    expect(screen.getByText("150 g")).toBeTruthy();
    expect(screen.getByText("192 kcal")).toBeTruthy();
    expect(screen.queryByText(/^[+−]\d+ kcal$/)).toBeNull();
    expect(saveBar()).toBeNull();
  });

  test("a changed meal prop does not touch a dirty draft, and discard picks it up", () => {
    const view = renderEditor();
    stepRiceUp();
    view.rerender(editorTree(withRice(150, 192)));
    expect(screen.getByText("110 g")).toBeTruthy();
    expect(saveBar()).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.getByText("150 g")).toBeTruthy();
    expect(saveBar()).toBeNull();
  });

  test("a refetch with equal data does not reset the screen", () => {
    const view = renderEditor();
    openRice();
    view.rerender(editorTree(JSON.parse(JSON.stringify(meal)) as MealResponse));
    expect(screen.getByLabelText("Descrição do item")).toBeTruthy();
  });

  test("a refetch of the just-saved meal keeps the post-save state", async () => {
    const saved = withRice(110, 140.8);
    mockSaveReturns(saved);
    const view = renderEditor();
    stepRiceUp();
    await save();
    view.rerender(editorTree(JSON.parse(JSON.stringify(saved)) as MealResponse));
    expect(screen.getByText("110 g")).toBeTruthy();
    expect(saveBar()).toBeNull();
    expect(screen.queryByText(/^[+−]\d+ kcal$/)).toBeNull();
  });

  test("a saved new item keeps its server id on the next save", async () => {
    const NEW_ID = "55555555-5555-4555-8555-555555555555";
    const saved = {
      ...meal,
      items: [
        ...meal.items,
        {
          id: NEW_ID,
          food_id: null,
          description: "Feijão",
          quantity: 1,
          unit: "unit",
          kcal: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
        },
      ],
    } as unknown as MealResponse;
    mockSaveReturns(saved, saved);
    renderEditor();
    fireEvent.press(screen.getByRole("button", { name: "Buscar e adicionar alimento" }));
    fireEvent.changeText(screen.getByLabelText("Descrição do item"), "Feijão");
    fireEvent.press(screen.getByText("Concluir item"));
    await save();
    expect(savedItems()[1]).not.toHaveProperty("id");
    stepRiceUp();
    fireEvent.press(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(2));
    const second = (mockMutate.mock.calls[1]?.[0] as { items: Record<string, unknown>[] }).items;
    expect(second).toHaveLength(2);
    expect(second[1]).toMatchObject({ id: NEW_ID, description: "Feijão" });
  });

  test("the invalidation day follows the saved consumed_at", async () => {
    const moved = { ...meal, consumed_at: new Date(2026, 10, 25, 12, 40).toISOString() };
    mockSaveReturns(moved as MealResponse);
    renderEditor();
    stepRiceUp();
    await save();
    await waitFor(() =>
      expect(mockUpdateArgs).toHaveBeenLastCalledWith(MEAL_ID, "2026-11-25", undefined),
    );
  });
});
