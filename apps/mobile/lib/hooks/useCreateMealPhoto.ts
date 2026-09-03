import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { createMealPhoto } from "@/lib/api/meals";
import { dailySummariesHistoryKey } from "./useDailySummaries";
import { dailySummaryKey } from "./useDailySummary";
import { mealDetailKey, mealsForDayKey } from "./useMealsForDay";
import { streakKey } from "./useStreak";
import type { OptimisticMeal } from "./useCreateMealText";

type Args = {
  client_meal_id: string;
  image_path: string;
  consumed_at?: string;
  locale: string;
  day: string;
};
type Context = { previous?: MealResponse[] };

function makeOptimistic(args: Args): OptimisticMeal {
  const now = new Date().toISOString();
  return {
    id: args.client_meal_id,
    source: "app_photo",
    raw_input: "Foto da refeição",
    audio_path: null,
    meal_type: "other",
    consumed_at: args.consumed_at ?? now,
    total_kcal: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: null,
    review_required: false,
    ai_feedback: null,
    created_at: now,
    deleted_at: null,
    items: [],
    __status: "processing",
  };
}

export function useCreateMealPhoto() {
  const queryClient = useQueryClient();

  return useMutation<
    { meal: MealResponse; cache_hit: boolean; already_existed: boolean },
    Error,
    Args,
    Context
  >({
    mutationFn: (args) =>
      createMealPhoto({
        client_meal_id: args.client_meal_id,
        image_path: args.image_path,
        consumed_at: args.consumed_at,
        locale: args.locale,
      }),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = queryClient.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      queryClient.setQueryData<OptimisticMeal[]>(mealsForDayKey(args.day), (old) => [
        makeOptimistic(args),
        ...(old ?? []),
      ]);
      return { previous };
    },
    onSuccess: (result, args) => {
      queryClient.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) => {
        if (!old) return [result.meal];
        return old.map((meal) => (meal.id === args.client_meal_id ? result.meal : meal));
      });
      queryClient.setQueryData(mealDetailKey(result.meal.id), result.meal);
      queryClient.invalidateQueries({ queryKey: dailySummaryKey(args.day) });
      queryClient.invalidateQueries({ queryKey: dailySummariesHistoryKey });
      queryClient.invalidateQueries({ queryKey: streakKey });
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(mealsForDayKey(args.day), ctx.previous);
      } else {
        queryClient.invalidateQueries({ queryKey: mealsForDayKey(args.day) });
      }
    },
  });
}
