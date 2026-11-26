import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import type { MealResponse } from "@fitbrother/shared";

const mockMutate = jest.fn();
const mockToast = jest.fn();

jest.mock("@/lib/hooks/useUpdateMeal", () => ({
  useUpdateMeal: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock("@/lib/hooks/useDeleteMeal", () => ({
  useDeleteMeal: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/lib/dialog/dialog-context", () => ({
  useDialog: () => ({ confirm: jest.fn() }),
}));
jest.mock("@/lib/toast/toast-context", () => ({ useToast: () => mockToast }));
jest.mock("@/lib/profile/profile-context", () => ({
  useProfile: () => ({ timezone: "America/Sao_Paulo", day_start_hour: 4 }),
}));

import { useMealConfirmation } from "./useMealConfirmation";

const meal = {
  id: "33333333-3333-4333-8333-333333333333",
  source: "app_text",
  raw_input: "arroz",
  image_path: null,
  meal_type: "lunch",
  consumed_at: new Date(2026, 10, 24, 12, 40).toISOString(),
  confidence: 0.9,
  review_required: true,
  items: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      food_id: null,
      description: "Arroz",
      quantity: 100,
      unit: "g",
      kcal: 128,
      protein_g: 2.5,
      carbs_g: 28,
      fat_g: 0.2,
    },
  ],
} as unknown as MealResponse;

function setup() {
  const onClose = jest.fn();
  const hook = renderHook(() => useMealConfirmation(meal, onClose));
  return { ...hook, onClose };
}

describe("useMealConfirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("starts clean in the compact view", () => {
    const { result } = setup();
    expect(result.current.view).toEqual({ name: "compact" });
    expect(result.current.dirty).toBe(false);
    expect(result.current.totals.kcal).toBe(128);
  });

  test("adding an item opens it and leaving it unnamed drops it", () => {
    const { result } = setup();
    act(() => result.current.addItem());
    expect(result.current.view).toEqual({ name: "item", index: 1 });
    expect(result.current.items).toHaveLength(2);
    act(() => result.current.leaveItem());
    expect(result.current.view).toEqual({ name: "adjust" });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.dirty).toBe(false);
  });

  test("a meta change makes the draft dirty and is sent alone", () => {
    const { result } = setup();
    act(() => result.current.setMealType("dinner"));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.confirm());
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0]?.[0]).toEqual({ meal_type: "dinner", confirm: true });
  });

  test("confirm runs once until the request settles", () => {
    const { result } = setup();
    act(() => result.current.confirm());
    act(() => result.current.confirm());
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });
});
