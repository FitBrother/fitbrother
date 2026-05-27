import { useQuery } from "@tanstack/react-query";
import { fetchStreak } from "@/lib/api/me";

export const streakKey = ["streak"] as const;

export function useStreak() {
  return useQuery({
    queryKey: streakKey,
    queryFn: fetchStreak,
    // The streak only changes once a day (cron at the user's day boundary), so
    // a generous staleTime avoids refetching on every Home focus.
    staleTime: 5 * 60_000,
  });
}
