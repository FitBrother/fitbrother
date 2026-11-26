import { useCallback } from "react";
import { useRouter } from "expo-router";
import type { MealResponse } from "@fitbrother/shared";
import { useConfirmMealSheet } from "@/lib/confirm-meal/confirm-meal-context";
import { mealRoute } from "@/lib/meal-route";

export function useOpenMeal() {
  const router = useRouter();
  const { open } = useConfirmMealSheet();
  return useCallback(
    (meal: Pick<MealResponse, "id" | "review_required">) => {
      if (meal.review_required) open(meal.id);
      else router.push(mealRoute(meal.id));
    },
    [router, open],
  );
}
