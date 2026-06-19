import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "@/lib/api/users";

export function useUserSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ["user-search", trimmed],
    queryFn: () => searchUsers(trimmed),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}
