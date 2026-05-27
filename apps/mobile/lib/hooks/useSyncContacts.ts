import { useMutation, useQueryClient } from "@tanstack/react-query";
import { collectContactHashes } from "@/lib/contacts";
import { syncContacts } from "@/lib/api/social";
import { followingKey } from "./useFollowing";
import { leaderboardKey } from "./useWeeklyLeaderboard";

/** Lê a agenda, hasheia no device e sincroniza; invalida following + ranking. */
export function useSyncContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const hashes = await collectContactHashes();
      return syncContacts(hashes);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: followingKey });
      qc.invalidateQueries({ queryKey: leaderboardKey });
    },
  });
}
