import { useQuery } from "@tanstack/react-query";
import { listMealsForDay } from "@/lib/api/meals";

export const mealsForDayKey = (day: string) => ["meals", day] as const;

export function useMealsForDay(day: string) {
  return useQuery({
    queryKey: mealsForDayKey(day),
    queryFn: () => listMealsForDay(day),
    enabled: Boolean(day),
  });
}
