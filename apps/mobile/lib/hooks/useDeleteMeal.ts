import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { deleteMeal } from "@/lib/api/meals";
import { mealsForDayKey, mealDetailKey } from "./useMealsForDay";

type Args = { id: string; day: string };
type Context = { previous?: MealResponse[] };

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation<void, Error, Args, Context>({
    mutationFn: (args) => deleteMeal(args.id),
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: mealsForDayKey(args.day) });
      const previous = qc.getQueryData<MealResponse[]>(mealsForDayKey(args.day));
      qc.setQueryData<MealResponse[]>(mealsForDayKey(args.day), (old) =>
        old?.filter((m) => m.id !== args.id),
      );
      return { previous };
    },
    onSuccess: (_data, args) => {
      qc.removeQueries({ queryKey: mealDetailKey(args.id) });
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      }
    },
  });
}
