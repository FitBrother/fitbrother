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
    // O streak muda na hora que uma refeição é logada (trigger em
    // daily_summaries, ver migration 0075), não só uma vez por dia — quem
    // dispara o refetch é a invalidação explícita (mutations de meal +
    // useDailySummaryRealtime), não o polling deste staleTime. Ele só evita
    // um refetch redundante toda vez que a Home ganha foco sem nada ter
    // mudado.
    staleTime: 5 * 60_000,
  });
}
