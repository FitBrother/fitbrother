import { useQuery } from "@tanstack/react-query";
import { fetchInsights } from "@/lib/api/insights";

export function useInsights(period: "day" | "week" | "month") {
  return useQuery({
    queryKey: ["insights", period],
    queryFn: () => fetchInsights(period),
    staleTime: 60_000,
  });
}
