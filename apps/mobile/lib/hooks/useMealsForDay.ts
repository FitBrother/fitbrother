import { useQuery } from "@tanstack/react-query";
import { listMealsForDay } from "@/lib/api/meals";

export const mealsForDayKey = (day: string) => ["meals", day] as const;
export const mealDetailKey = (id: string) => ["meal", id] as const;

export function useMealsForDay(day: string) {
  return useQuery({
    queryKey: mealsForDayKey(day),
    queryFn: () => listMealsForDay(day),
    enabled: Boolean(day),
    // Igual useDailySummary: o Realtime (useMealsRealtime) já invalida a
    // query quando algo muda, então isso só evita refetch redundante em
    // cada foco/remonte dentro dessa janela.
    staleTime: 60_000,
  });
}
