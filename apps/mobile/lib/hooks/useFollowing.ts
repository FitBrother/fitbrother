import { useQuery } from "@tanstack/react-query";
import { fetchFollowing } from "@/lib/api/social";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

export const followingKey = ["following"] as const;

export function useFollowing() {
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : null;

  return useQuery({
    queryKey: [...followingKey, userId],
    queryFn: fetchFollowing,
    enabled: userId !== null,
    staleTime: 60_000,
  });
}
