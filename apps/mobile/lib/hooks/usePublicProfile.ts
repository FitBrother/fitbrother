import { useQuery } from "@tanstack/react-query";
import { fetchPublicProfile } from "@/lib/api/users";

export const publicProfileKey = ["public-profile"] as const;

export function publicProfileKeyFor(userId: string) {
  return [...publicProfileKey, userId] as const;
}

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: publicProfileKeyFor(userId ?? ""),
    queryFn: () => fetchPublicProfile(userId!),
    enabled: Boolean(userId),
    // Curto porque seguir/deixar de seguir muda contagens e libera os posts —
    // voltar para o perfil depois disso tem que refletir o novo estado.
    staleTime: 15_000,
  });
}
