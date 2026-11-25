type MealLike = { review_required: boolean; __status?: "processing" };

export function hasConfirmedMeal(meals: readonly MealLike[]): boolean {
  return meals.some((m) => m.__status !== "processing" && !m.review_required);
}
