import { useMutation, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type { MealResponse } from "@fitbrother/shared";
import { createMealText } from "@/lib/api/meals";
import { mealsForDayKey, mealDetailKey } from "./useMealsForDay";
import { dailySummariesHistoryKey } from "./useDailySummaries";

export type OptimisticMeal = MealResponse & { __status?: "processing" };

type Args = {
  client_meal_id: string;
  text: string;
  consumed_at?: string;
  locale: string;
  day: string;
};
type Context = { previous?: MealResponse[] };

function makeOptimistic(args: Args): OptimisticMeal {
  const now = new Date().toISOString();
  return {
    id: args.client_meal_id,
    source: "app_text",
    raw_input: args.text,
    audio_path: null,
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

export function useCreateMealText() {
  const qc = useQueryClient();

  return useMutation<
    { meal: MealResponse; cache_hit: boolean; already_existed: boolean },
    Error,
    Args,
    Context
  >({
    mutationFn: (args) =>
      createMealText({
        client_meal_id: args.client_meal_id,
        text: args.text,
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
      // Backfill: reflete a mudança no infinite scroll de /history.
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

export function newClientMealId(): string {
  return randomUUID();
}
