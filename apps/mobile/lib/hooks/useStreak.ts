import { useQuery } from "@tanstack/react-query";
import { fetchStreak } from "@/lib/api/me";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

export const streakKey = ["streak"] as const;

export function useStreak() {
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : null;

  return useQuery({
    queryKey: [...streakKey, userId],
    queryFn: fetchStreak,
    enabled: userId !== null,
    // The streak only changes once a day (cron at the user's day boundary), so
    // a generous staleTime avoids refetching on every Home focus.
    staleTime: 5 * 60_000,
  });
}
