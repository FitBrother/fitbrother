import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MealResponse } from "@fitbrother/shared";
import { deleteMeal } from "@/lib/api/meals";
import { dailySummaryKey } from "./useDailySummary";
import { mealsForDayKey, mealDetailKey } from "./useMealsForDay";
import { streakKey } from "./useStreak";

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
      // Não depende só do Realtime de daily_summaries: o canal pode estar no
      // meio de um resubscribe (troca de dia, remount) bem na hora do delete
      // e perder o evento — invalidar aqui garante que os macros do dia
      // sempre refletem a exclusão assim que o servidor confirma.
      void qc.invalidateQueries({ queryKey: dailySummaryKey(args.day) });
      // Apagar uma refeição pode zerar ou restaurar o streak do dia (mesmo
      // trigger de daily_summaries que o recomputa ao logar) — sem isso o
      // usuário só via o streak certo depois de sair e voltar pra tela.
      void qc.invalidateQueries({ queryKey: streakKey });
    },
    onError: (_err, args, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(mealsForDayKey(args.day), ctx.previous);
      }
    },
  });
}
