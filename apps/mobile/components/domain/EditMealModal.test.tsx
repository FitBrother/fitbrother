import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { FoodSuggestion, MealResponse } from "@fitbrother/shared";

const mockMutate = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn() }) }));
jest.mock("@/lib/hooks/useUpdateMeal", () => ({
  useUpdateMeal: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock("@/lib/hooks/useDeleteMeal", () => ({
  useDeleteMeal: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/dialog/dialog-context", () => ({
  useDialog: () => ({ confirm: jest.fn() }),
}));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => jest.fn() }));
jest.mock("@/lib/hooks/useFoodSuggestions", () => ({ useFoodSuggestions: jest.fn() }));

import { useFoodSuggestions } from "@/lib/hooks/useFoodSuggestions";
import { EditMealModal } from "./EditMealModal";

const FOOD_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

const meal = {
  id: "33333333-3333-4333-8333-333333333333",
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
      <EditMealModal meal={meal} day="2026-11-24" />
    </SafeAreaProvider>,
  );
}

function savedItems(): Record<string, unknown>[] {
  const patch = mockMutate.mock.calls[0]?.[0] as { items: Record<string, unknown>[] };
  return patch.items;
}

describe("EditMealModal food autocomplete integration", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    jest.mocked(useFoodSuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodSuggestions>);
  });

  test("saving an untouched item keeps its food_id", async () => {
    renderModal();
    fireEvent.changeText(screen.getByLabelText("Qtd, valor numérico"), "100");
    fireEvent.press(screen.getByLabelText("Salvar alterações"));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(savedItems()[0]).toMatchObject({ id: ITEM_ID, food_id: FOOD_ID, kcal: 128 });
  });

  test("typing in the description unlinks the item and keeps macros", async () => {
    renderModal();
    fireEvent.changeText(screen.getByLabelText("Descrição do item"), "Arroz caseiro");
    fireEvent.changeText(screen.getByLabelText("kcal, valor numérico"), "150");
    fireEvent.press(screen.getByLabelText("Salvar alterações"));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(savedItems()[0]).toMatchObject({
      description: "Arroz caseiro",
      food_id: null,
      kcal: 150,
      protein_g: 2.5,
    });
  });

  test("editing macros of an unlinked item shows no Ajustado chip", () => {
    renderModal();
    fireEvent.changeText(screen.getByLabelText("Descrição do item"), "Arroz caseiro");
    fireEvent.changeText(screen.getByLabelText("kcal, valor numérico"), "150");
    expect(screen.queryByText("Ajustado")).toBeNull();
    expect(screen.queryByLabelText("Voltar ao catálogo")).toBeNull();
  });

  test("selecting a suggestion links it, rescales on quantity and flags manual macro edits", async () => {
    jest.mocked(useFoodSuggestions).mockReturnValue({
      data: [rice],
      isLoading: false,
    } as unknown as ReturnType<typeof useFoodSuggestions>);
    renderModal();
    fireEvent(screen.getByLabelText("Descrição do item"), "focus");
    fireEvent.press(screen.getByLabelText(/^Arroz, tipo 1, cozido,/));
    fireEvent.changeText(screen.getByLabelText("Qtd, valor numérico"), "200");
    expect(screen.getByLabelText("kcal, valor numérico").props.value).toBe("256");
    expect(screen.queryByText("Ajustado")).toBeNull();

    fireEvent.changeText(screen.getByLabelText("kcal, valor numérico"), "300");
    expect(screen.getByText("Ajustado")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Voltar ao catálogo"));
    expect(screen.queryByText("Ajustado")).toBeNull();
    expect(screen.getByLabelText("kcal, valor numérico").props.value).toBe("256");

    fireEvent.press(screen.getByLabelText("Salvar alterações"));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(savedItems()[0]).toMatchObject({ food_id: FOOD_ID, quantity: 200, kcal: 256 });
  });
});
