import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

const MEAL_ID = "33333333-3333-4333-8333-333333333333";
const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockOpen = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@/lib/confirm-meal/confirm-meal-context", () => ({
  useConfirmMealSheet: () => ({ open: mockOpen, close: jest.fn() }),
}));

import { useOpenMeal } from "@/lib/hooks/useOpenMeal";
import { mealRoute } from "@/lib/meal-route";

describe("useOpenMeal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("a pending meal opens the confirm drawer", () => {
    const { result } = renderHook(() => useOpenMeal());
    result.current({ id: MEAL_ID, review_required: true });
    expect(mockOpen).toHaveBeenCalledWith(MEAL_ID);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test("a confirmed meal navigates to its detail screen", () => {
    const { result } = renderHook(() => useOpenMeal());
    result.current({ id: MEAL_ID, review_required: false });
    expect(mockRouter.push).toHaveBeenCalledWith(mealRoute(MEAL_ID));
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
