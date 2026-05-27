import { useQuery } from "@tanstack/react-query";
import { fetchAchievements, fetchMyAchievements } from "@/lib/api/achievements";

export const achievementsKey = ["achievements"] as const;
export const myAchievementsKey = ["me", "achievements"] as const;

// Global catalog rarely changes — cache it hard.
export function useAchievements() {
  return useQuery({
    queryKey: achievementsKey,
    queryFn: fetchAchievements,
    staleTime: 60 * 60_000,
  });
}

export function useMyAchievements() {
  return useQuery({
    queryKey: myAchievementsKey,
    queryFn: fetchMyAchievements,
    staleTime: 60_000,
  });
}
