import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { mealsForDayKey } from "@/lib/hooks/useMealsForDay";
import { nutritionalDay } from "@/lib/time/nutritional-day";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockProfile = { timezone: "America/Sao_Paulo", day_start_hour: 4 };
const mockToast = jest.fn();
const mockConfirmMeal = jest.fn<(id: string) => Promise<MealResponse>>();
const mockGetMeal = jest.fn<(id: string) => Promise<MealResponse>>();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => ({ id: "33333333-3333-4333-8333-333333333333" }),
}));
jest.mock("@react-navigation/native", () => ({ usePreventRemove: jest.fn() }));
jest.mock("@/lib/api/meals", () => ({
  getMeal: (id: string) => mockGetMeal(id),
  confirmMeal: (id: string) => mockConfirmMeal(id),
}));
jest.mock("@/lib/hooks/useUpdateMeal", () => ({
  useUpdateMeal: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/hooks/useDeleteMeal", () => ({
  useDeleteMeal: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/dialog/dialog-context", () => ({ useDialog: () => ({ confirm: jest.fn() }) }));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => mockToast }));
jest.mock("@/lib/profile/profile-context", () => ({ useProfile: () => mockProfile }));
jest.mock("@/lib/hooks/useFoodSuggestions", () => ({ useFoodSuggestions: jest.fn() }));

import MealDetailScreen from "@/app/(app)/meal/[id]/index";

const CONSUMED_AT = new Date(2026, 10, 24, 12, 40).toISOString();
const DAY = nutritionalDay(new Date(CONSUMED_AT), mockProfile);

const meal = {
  id: MEAL_ID,
  meal_type: "lunch",
  consumed_at: CONSUMED_AT,
  ai_feedback: null,
  review_required: false,
  items: [
    {
      id: "22222222-2222-4222-8222-222222222222",
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

const pending = { ...meal, review_required: true } as MealResponse;

const metrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

const clients: QueryClient[] = [];

async function renderScreen({ settle = true } = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  clients.push(client);
  const utils = render(
    <QueryClientProvider client={client}>
      <SafeAreaProvider initialMetrics={metrics}>
        <MealDetailScreen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
  if (settle) {
    await waitFor(() => expect(screen.queryByTestId("meal-edit-skeleton")).toBeNull());
  }
  return { ...utils, client };
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe("meal detail route", () => {
  test("shows the skeleton while the meal loads", async () => {
    mockGetMeal.mockReturnValue(new Promise(() => {}));
    await renderScreen({ settle: false });

    expect(screen.getByTestId("meal-edit-skeleton")).toBeTruthy();
    expect(screen.queryByText("Refeição")).toBeNull();
  });

  test("shows the not-found message when the request fails", async () => {
    mockGetMeal.mockRejectedValue(new Error("boom"));
    await renderScreen();

    expect(screen.getByText("Refeição não encontrada.")).toBeTruthy();
    expect(screen.queryByTestId("meal-edit-skeleton")).toBeNull();
  });

  test("renders the editor without a banner for a regular meal", async () => {
    mockGetMeal.mockResolvedValue(meal);
    await renderScreen();

    expect(screen.getByText("Refeição")).toBeTruthy();
    expect(screen.getByText("Arroz cozido")).toBeTruthy();
    expect(screen.queryByText("Confira os itens")).toBeNull();
    expect(screen.queryByLabelText("Confirmar refeição")).toBeNull();
    expect(screen.queryByLabelText("Editar refeição")).toBeNull();
  });

  describe("when the meal needs review", () => {
    beforeEach(() => {
      mockGetMeal.mockResolvedValue(pending);
    });

    test("renders the banner and confirms with the id and the nutritional day", async () => {
      mockConfirmMeal.mockResolvedValue(meal);
      const { client } = await renderScreen();
      client.setQueryData(mealsForDayKey(DAY), [pending]);

      expect(screen.getByText("Confira os itens")).toBeTruthy();
      expect(
        screen.getByText("A IA não teve certeza de tudo. Ajuste o que precisar e confirme."),
      ).toBeTruthy();
      expect(screen.queryByText("Salve as alterações para confirmar.")).toBeNull();

      fireEvent.press(screen.getByLabelText("Confirmar refeição"));

      await waitFor(() => expect(screen.queryByText("Confira os itens")).toBeNull());
      expect(mockConfirmMeal).toHaveBeenCalledTimes(1);
      expect(mockConfirmMeal).toHaveBeenCalledWith(MEAL_ID);
      expect(client.getQueryData<MealResponse[]>(mealsForDayKey(DAY))?.[0]?.review_required).toBe(
        false,
      );
      expect(mockToast).not.toHaveBeenCalled();
    });

    test("disables the confirm button and shows the hint while the editor is dirty", async () => {
      await renderScreen();

      fireEvent.press(screen.getByLabelText("Aumentar quantidade de Arroz cozido"));

      expect(screen.getByText("Salve as alterações para confirmar.")).toBeTruthy();
      expect(screen.getByLabelText("Confirmar refeição")).toBeDisabled();
      expect(screen.getByLabelText("Confirmar refeição").props.accessibilityHint).toBe(
        "Salve as alterações para confirmar.",
      );
      fireEvent.press(screen.getByLabelText("Confirmar refeição"));
      expect(mockConfirmMeal).not.toHaveBeenCalled();
    });

    test("shows the error toast and brings the banner back when confirming fails", async () => {
      let fail: (error: Error) => void = () => {};
      mockConfirmMeal.mockReturnValue(
        new Promise<MealResponse>((_resolve, reject) => {
          fail = reject;
        }),
      );
      await renderScreen();

      fireEvent.press(screen.getByLabelText("Confirmar refeição"));
      await waitFor(() => expect(screen.queryByText("Confira os itens")).toBeNull());
      await act(async () => {
        fail(new Error("boom"));
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith({
          variant: "error",
          message: "Não foi possível confirmar",
        }),
      );
      expect(screen.getByText("Confira os itens")).toBeTruthy();
    });
  });
});
