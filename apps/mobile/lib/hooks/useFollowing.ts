import { useQuery } from "@tanstack/react-query";
import { fetchFollowing } from "@/lib/api/social";

export const followingKey = ["following"] as const;

export function useFollowing() {
  return useQuery({ queryKey: followingKey, queryFn: fetchFollowing, staleTime: 60_000 });
}
