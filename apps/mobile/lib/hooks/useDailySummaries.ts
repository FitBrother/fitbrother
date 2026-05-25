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

function clampFrom(candidate: string, cutoff: string | undefined): string {
  if (!cutoff) return candidate;
  return candidate < cutoff ? cutoff : candidate;
}

export type DailySummariesPageParam = { from: string; to: string };

export const dailySummariesHistoryKey = ["daily-summaries-history"] as const;

/**
 * Infinite query paginada por semana, mais recente primeiro.
 *
 * @param todayIso  Dia nutricional "hoje" do usuário (YYYY-MM-DD).
 * @param cutoffIso (opcional) Dia mais antigo a retroceder — quando atingido,
 *   getNextPageParam retorna undefined. Tipicamente o dia nutricional de
 *   criação da conta, pra UX não mostrar dias anteriores ao signup.
 */
export function useDailySummaries(todayIso: string, cutoffIso?: string) {
  return useInfiniteQuery({
    queryKey: dailySummariesHistoryKey,
    initialPageParam: {
      from: clampFrom(addDays(todayIso, -(WEEK_DAYS - 1)), cutoffIso),
      to: todayIso,
    } satisfies DailySummariesPageParam,
    queryFn: ({ pageParam }) => fetchDailySummaries(pageParam.from, pageParam.to),
    getNextPageParam: (_last, _all, lastParam) => {
      const candidateTo = addDays(lastParam.from, -1);
      if (cutoffIso && candidateTo < cutoffIso) return undefined;
      const candidateFrom = addDays(lastParam.from, -WEEK_DAYS);
      return {
        from: clampFrom(candidateFrom, cutoffIso),
        to: candidateTo,
      } satisfies DailySummariesPageParam;
    },
    enabled: Boolean(todayIso),
  });
}
