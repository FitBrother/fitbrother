import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDailySummaries } from "@/lib/api/me";

const WEEK_DAYS = 7;

function addDays(iso: string, n: number): string {
  // Trabalhamos com strings YYYY-MM-DD pra evitar fuso. UTC-anchored interno
  // só pra somar dias; o resultado volta como ISO calendar date.
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type DailySummariesPageParam = { from: string; to: string };

export const dailySummariesHistoryKey = ["daily-summaries-history"] as const;

export function useDailySummaries(todayIso: string) {
  return useInfiniteQuery({
    queryKey: dailySummariesHistoryKey,
    initialPageParam: {
      from: addDays(todayIso, -(WEEK_DAYS - 1)),
      to: todayIso,
    } satisfies DailySummariesPageParam,
    queryFn: ({ pageParam }) => fetchDailySummaries(pageParam.from, pageParam.to),
    getNextPageParam: (_last, _all, lastParam) =>
      ({
        from: addDays(lastParam.from, -WEEK_DAYS),
        to: addDays(lastParam.from, -1),
      }) satisfies DailySummariesPageParam,
    enabled: Boolean(todayIso),
  });
}
