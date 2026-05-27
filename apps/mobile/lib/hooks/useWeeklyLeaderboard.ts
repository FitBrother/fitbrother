import { useQuery } from "@tanstack/react-query";
import { fetchWeeklyLeaderboard } from "@/lib/api/social";

export const leaderboardKey = ["leaderboard", "weekly"] as const;

export function useWeeklyLeaderboard() {
  return useQuery({
    queryKey: leaderboardKey,
    queryFn: fetchWeeklyLeaderboard,
    staleTime: 60_000,
  });
}
