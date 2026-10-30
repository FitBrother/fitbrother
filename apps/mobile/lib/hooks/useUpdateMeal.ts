import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PatchMealRequest } from "@fitbrother/shared";
import { patchMeal } from "@/lib/api/meals";
import { mealDetailKey, mealsForDayKey } from "./useMealsForDay";
import { dailySummaryKey } from "./useDailySummary";
import { dailySummariesHistoryKey } from "./useDailySummaries";
import { streakKey } from "./useStreak";

export function useUpdateMeal(mealId: string, day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PatchMealRequest) => patchMeal(mealId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mealDetailKey(mealId) });
      qc.invalidateQueries({ queryKey: mealsForDayKey(day) });
      qc.invalidateQueries({ queryKey: dailySummaryKey(day) });
      qc.invalidateQueries({ queryKey: dailySummariesHistoryKey });
      qc.invalidateQueries({ queryKey: streakKey });
    },
  });
}
