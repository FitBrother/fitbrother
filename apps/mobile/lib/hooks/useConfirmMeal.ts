import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { confirmMeal } from "@/lib/api/meals";
import { mealsForDayKey, mealDetailKey } from "./useMealsForDay";

type Args = { id: string; day: string };
type Context = { previous?: MealResponse[]; previousDetail?: MealResponse };

export function useConfirmMeal() {
  const qc = useQueryClient();
  return useMutation<MealResponse, Error, Args, Context>({
    mutationFn: (args) => confirmMeal(args.id),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      const previousDetail = qc.getQueryData<MealResponse>(mealDetailKey(args.id));
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) =>
        old?.map((m) => (m.id === args.id ? { ...m, review_required: false } : m)),
      );
      qc.setQueryData<MealResponse>(mealDetailKey(args.id), (old) =>
        old ? { ...old, review_required: false } : old,
      );
      return { previous, previousDetail };
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      }
      if (ctx?.previousDetail !== undefined) {
        qc.setQueryData(mealDetailKey(args.id), ctx.previousDetail);
      }
    },
    onSuccess: (meal, args) => {
      qc.setQueryData(mealDetailKey(args.id), meal);
    },
  });
}
