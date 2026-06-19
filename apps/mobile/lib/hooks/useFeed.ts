import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api/posts";

export const feedKey = ["feed"] as const;

export function useFeed() {
  return useQuery({
    queryKey: feedKey,
    queryFn: fetchFeed,
    staleTime: 20_000,
  });
}
