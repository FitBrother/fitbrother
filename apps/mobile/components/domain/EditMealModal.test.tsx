import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { FoodSuggestion, MealResponse } from "@fitbrother/shared";
import { nutritionalDay } from "@/lib/time/nutritional-day";

const mockMutate = jest.fn();
const mockRemove = jest.fn();
const mockConfirm = jest.fn<(opts: { title: string }) => Promise<boolean>>();
const mockToast = jest.fn();
const mockUpdateArgs = jest.fn();
const mockProfile = { timezone: "America/Sao_Paulo", day_start_hour: 4 };

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn() }) }));
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
import { EditMealModal } from "./EditMealModal";

const FOOD_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const DAY = "2026-11-24";
const CONSUMED_AT = new Date(2026, 10, 24, 12, 40).toISOString();

const meal = {
  id: MEAL_ID,
  meal_type: "lunch",
  consumed_at: CONSUMED_AT,
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

function renderModal() {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditMealModal meal={meal} day={DAY} />
    </SafeAreaProvider>,
  );
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

describe("EditMealModal", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockRemove.mockReset();
    mockConfirm.mockReset();
    mockToast.mockReset();
    mockUpdateArgs.mockReset();
    jest.mocked(useFoodSuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodSuggestions>);
  });

  test("save is disabled until something changes", () => {
    renderModal();
    const button = screen.getByRole("button", { name: "Salvar alterações" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByLabelText("Aumentar quantidade"));
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });

  test("saving an untouched item keeps its food_id", async () => {
    renderModal();
    fireEvent.press(screen.getByLabelText("Aumentar quantidade"));
    fireEvent.press(screen.getByLabelText("Diminuir quantidade"));
    await save();
    expect(savedItems()[0]).toMatchObject({
      id: ITEM_ID,
      food_id: FOOD_ID,
      quantity: 100,
      kcal: 128,
    });
  });

  test("the row stepper scales a saved item and the summary shows the delta", async () => {
    renderModal();
    expect(screen.queryByText("+13 kcal")).toBeNull();
    fireEvent.press(screen.getByLabelText("Aumentar quantidade"));
    expect(screen.getByText("110 g")).toBeTruthy();
    expect(screen.getByText("141 kcal")).toBeTruthy();
    expect(screen.getByText("141")).toBeTruthy();
    expect(screen.getByText("+13 kcal")).toBeTruthy();
    await save();
    expect(savedItems()[0]).toMatchObject({ quantity: 110, kcal: 140.8, protein_g: 2.75 });
  });

  test("typing the description in the sheet unlinks the item and keeps macros", async () => {
    renderModal();
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
    renderModal();
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
    renderModal();
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
    renderModal();
    fireEvent.press(screen.getByRole("button", { name: "Buscar e adicionar alimento" }));
    expect(screen.getAllByTestId("meal-item-row")).toHaveLength(2);
    expect(screen.getByLabelText("Descrição do item").props.value).toBe("");
    fireEvent.press(screen.getByText("Concluir item"));
    expect(screen.getAllByTestId("meal-item-row")).toHaveLength(1);
    expect(screen.getByText("Itens · 1")).toBeTruthy();
  });

  test("closing a new item that has a name keeps it", () => {
    renderModal();
    fireEvent.press(screen.getByRole("button", { name: "Buscar e adicionar alimento" }));
    fireEvent.changeText(screen.getByLabelText("Descrição do item"), "Feijão");
    fireEvent.press(screen.getByText("Concluir item"));
    expect(screen.getAllByTestId("meal-item-row")).toHaveLength(2);
    expect(screen.getByText("Itens · 2")).toBeTruthy();
  });

  test("changing the meal type patches meal_type without consumed_at", async () => {
    renderModal();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByText("Jantar"));
    await save();
    expect(savedPatch()).toMatchObject({ meal_type: "dinner" });
    expect(savedPatch()).not.toHaveProperty("consumed_at");
    expect(mockUpdateArgs).toHaveBeenLastCalledWith(MEAL_ID, DAY, undefined);
  });

  test("changing the time patches consumed_at and passes the new nutritional day", async () => {
    renderModal();
    fireEvent.press(screen.getByLabelText("Horário: 12:40"));
    fireEvent.press(screen.getByLabelText("Roda 23"));
    fireEvent.press(screen.getByLabelText("Confirmar"));
    const iso = new Date(2026, 10, 24, 23, 40).toISOString();
    await save();
    expect(savedPatch()).toMatchObject({ consumed_at: iso });
    expect(savedPatch()).not.toHaveProperty("meal_type");
    expect(mockUpdateArgs).toHaveBeenLastCalledWith(
      MEAL_ID,
      DAY,
      nutritionalDay(new Date(iso), mockProfile),
    );
  });

  test("an item with an invalid field shows a toast and does not save", () => {
    renderModal();
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
    renderModal();
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
  });

  test("the trash icon confirms and deletes the meal", async () => {
    mockConfirm.mockResolvedValue(true);
    renderModal();
    fireEvent.press(screen.getByRole("button", { name: "Excluir refeição" }));
    await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Excluir refeição?", destructive: true }),
    );
    expect(mockRemove.mock.calls[0]?.[0]).toEqual({ id: MEAL_ID, day: DAY });
  });

  test("closing with only a meta change asks to discard", async () => {
    mockConfirm.mockResolvedValue(false);
    renderModal();
    fireEvent.press(screen.getByLabelText("Tipo da refeição: Almoço"));
    fireEvent.press(screen.getByText("Jantar"));
    fireEvent.press(screen.getByRole("button", { name: "Fechar edição" }));
    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Descartar alterações?" }),
      ),
    );
  });
});
