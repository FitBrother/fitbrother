import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { createMealAudio } from "@/lib/api/meals";
import { mealsForDayKey, mealDetailKey } from "./useMealsForDay";
import { dailySummariesHistoryKey } from "./useDailySummaries";
import type { OptimisticMeal } from "./useCreateMealText";

type Args = {
  client_meal_id: string;
  audio_path: string;
  duration_s: number;
  consumed_at?: string;
  locale: string;
  day: string;
};
type Context = { previous?: MealResponse[] };

function makeOptimistic(args: Args): OptimisticMeal {
  const now = new Date().toISOString();
  return {
    id: args.client_meal_id,
    source: "app_audio",
    raw_input: null,
    audio_path: args.audio_path,
    meal_type: "other",
    consumed_at: args.consumed_at ?? now,
    total_kcal: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: null,
    review_required: false,
    created_at: now,
    deleted_at: null,
    items: [],
    __status: "processing",
  };
}

export function useCreateMealAudio() {
  const qc = useQueryClient();

  return useMutation<
    {
      meal: MealResponse;
      cache_hit_transcription: boolean;
      cache_hit_extraction: boolean;
      already_existed: boolean;
    },
    Error,
    Args,
    Context
  >({
    mutationFn: (args) =>
      createMealAudio({
        client_meal_id: args.client_meal_id,
        audio_path: args.audio_path,
        duration_s: args.duration_s,
        consumed_at: args.consumed_at,
        locale: args.locale,
      }),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      qc.setQueryData<OptimisticMeal[]>(mealsForDayKey(args.day), (old) => [
        makeOptimistic(args),
        ...(old ?? []),
      ]);
      return { previous };
    },
    onSuccess: (result, args) => {
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) => {
        if (!old) return [result.meal];
        return old.map((m) => (m.id === args.client_meal_id ? result.meal : m));
      });
      qc.setQueryData(mealDetailKey(result.meal.id), result.meal);
      if (args.consumed_at) {
        qc.invalidateQueries({ queryKey: dailySummariesHistoryKey });
      }
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      } else {
        qc.invalidateQueries({ queryKey: mealsForDayKey(args.day) });
      }
    },
  });
}
