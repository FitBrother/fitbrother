import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse, CreateMealBarcodeRequest } from "@fitbrother/shared";
import { createMealBarcode } from "@/lib/api/barcode";
import { dailySummariesHistoryKey } from "./useDailySummaries";
import { dailySummaryKey } from "./useDailySummary";
import { mealDetailKey, mealsForDayKey } from "./useMealsForDay";
import type { OptimisticMeal } from "./useCreateMealText";

type Context = { previous?: MealResponse[] };

function makeOptimistic(args: CreateMealBarcodeRequest & { day: string }): OptimisticMeal {
  const now = new Date().toISOString();
  return {
    id: args.client_meal_id,
    source: "app_barcode",
    raw_input: `Código de barras: ${args.barcode}`,
    audio_path: null,
    meal_type: args.meal_type ?? "other",
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

export function useCreateMealBarcode() {
  const queryClient = useQueryClient();

  return useMutation<
    { meal: MealResponse; already_existed: boolean },
    Error,
    CreateMealBarcodeRequest & { day: string },
    Context
  >({
    mutationFn: (args) =>
      createMealBarcode({
        client_meal_id: args.client_meal_id,
        barcode: args.barcode,
        quantity: args.quantity,
        unit: args.unit,
        meal_type: args.meal_type,
        consumed_at: args.consumed_at,
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
