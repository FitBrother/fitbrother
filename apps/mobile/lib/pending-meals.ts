import type { MealResponse } from "@fitbrother/shared";
import type { OptimisticMeal } from "@/lib/hooks/useCreateMealText";

export function pendingMealsOf<T extends OptimisticMeal>(items: readonly T[]): T[] {
  return items.filter((m) => m.review_required && m.__status !== "processing");
}

export function pendingKcal(meals: readonly Pick<MealResponse, "total_kcal">[]): number {
  return meals.reduce((sum, m) => sum + m.total_kcal, 0);
}

export function oldestPending<T extends Pick<MealResponse, "consumed_at">>(
  meals: readonly T[],
): T | undefined {
  let oldest: T | undefined;
  for (const m of meals) {
    if (!oldest || Date.parse(m.consumed_at) < Date.parse(oldest.consumed_at)) oldest = m;
  }
  return oldest;
}
