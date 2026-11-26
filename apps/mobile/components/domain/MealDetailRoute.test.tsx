import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockProfile = { timezone: "America/Sao_Paulo", day_start_hour: 4 };
const mockToast = jest.fn();
const mockGetMeal = jest.fn<(id: string) => Promise<MealResponse>>();
const mockOpen = jest.fn();

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ dispatch: jest.fn() }),
  useLocalSearchParams: () => ({ id: "33333333-3333-4333-8333-333333333333" }),
}));
jest.mock("@/lib/confirm-meal/confirm-meal-context", () => ({
  useConfirmMealSheet: () => ({ open: mockOpen, close: jest.fn() }),
}));
jest.mock("@react-navigation/native", () => ({ usePreventRemove: jest.fn() }));
jest.mock("@/lib/api/meals", () => ({
  getMeal: (id: string) => mockGetMeal(id),
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
jest.mock("@/lib/storage", () => ({ getPostImageSignedUrl: jest.fn() }));

import MealDetailScreen from "@/app/(app)/meal/[id]/index";

const CONSUMED_AT = new Date(2026, 10, 24, 12, 40).toISOString();

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

  test("the not-found state goes back when there is history", async () => {
    mockRouter.canGoBack.mockReturnValue(true);
    mockGetMeal.mockRejectedValue(new Error("boom"));
    await renderScreen();

    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test("the not-found state goes home when there is no history", async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    mockGetMeal.mockRejectedValue(new Error("boom"));
    await renderScreen();

    fireEvent.press(screen.getByRole("button", { name: "Voltar" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/(app)");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test("renders the regular editor for a confirmed meal", async () => {
    mockGetMeal.mockResolvedValue(meal);
    await renderScreen();

    expect(screen.getByText("Refeição")).toBeTruthy();
    expect(screen.getByText("Arroz cozido")).toBeTruthy();
    expect(screen.queryByText("Confirme o que entendi")).toBeNull();
    expect(screen.queryByLabelText("Confirmar refeição")).toBeNull();
    expect(screen.queryByLabelText("Editar refeição")).toBeNull();
  });

  test("a pending meal opens the confirm drawer and leaves without showing the editor", async () => {
    mockRouter.canGoBack.mockReturnValue(true);
    mockGetMeal.mockResolvedValue(pending);
    await renderScreen({ settle: false });

    await waitFor(() => expect(mockOpen).toHaveBeenCalledWith(MEAL_ID));
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Refeição")).toBeNull();
    expect(screen.queryByText("Arroz cozido")).toBeNull();
    expect(screen.getByTestId("meal-edit-skeleton")).toBeTruthy();
  });

  test("a pending meal opened by deep link goes home under the drawer", async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    mockGetMeal.mockResolvedValue(pending);
    await renderScreen({ settle: false });

    await waitFor(() => expect(mockOpen).toHaveBeenCalledWith(MEAL_ID));
    expect(mockRouter.replace).toHaveBeenCalledWith("/(app)");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test("a confirmed meal does not open the drawer", async () => {
    mockGetMeal.mockResolvedValue(meal);
    await renderScreen();

    expect(mockOpen).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
