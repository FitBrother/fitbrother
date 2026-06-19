import { useQuery } from "@tanstack/react-query";
import { fetchWeeklyLeaderboard } from "@/lib/api/social";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

export const leaderboardKey = ["leaderboard", "weekly"] as const;

export function useWeeklyLeaderboard() {
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : null;

  return useQuery({
    queryKey: [...leaderboardKey, userId],
    queryFn: fetchWeeklyLeaderboard,
    enabled: userId !== null,
    staleTime: 60_000,
  });
}
