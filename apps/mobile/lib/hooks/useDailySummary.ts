import { useQuery } from "@tanstack/react-query";
import { fetchDailySummary } from "@/lib/api/me";

export const dailySummaryKey = (day: string) => ["daily-summary", day] as const;

export function useDailySummary(day: string) {
  return useQuery({
    queryKey: dailySummaryKey(day),
    queryFn: () => fetchDailySummary(day),
    enabled: Boolean(day),
    staleTime: 60_000,
  });
}
