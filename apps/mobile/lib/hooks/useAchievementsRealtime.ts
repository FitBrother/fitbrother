import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Achievement } from "@fitbrother/shared";
import { removeStaleChannel, supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast/toast-context";
import { achievementsKey, myAchievementsKey, useAchievements } from "./useAchievements";

/**
 * Subscribe to INSERTs on user_achievements (filter user_id) and surface an
 * in-app toast the instant a conquista unlocks — no waiting on the push poller.
 * Also invalidates the unlocked-list query so the achievements screen refreshes.
 *
 * The realtime payload only carries achievement_id, so we resolve the title
 * from the cached catalog (loaded here via useAchievements).
 */
export function useAchievementsRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  const toast = useToast();
  // Ensure the catalog is in cache so we can map id → title for the toast.
  useAchievements();

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const topic = `ua:${userId}`;

    void removeStaleChannel(topic).then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_achievements",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const achievementId = (payload.new as { achievement_id?: string }).achievement_id;
            const catalog = qc.getQueryData<Achievement[]>(achievementsKey);
            const unlocked = catalog?.find((a) => a.id === achievementId);
            toast({
              variant: "info",
              message: unlocked
                ? `🏆 ${unlocked.title} desbloqueada!`
                : "🏆 Nova conquista desbloqueada!",
            });
            qc.invalidateQueries({ queryKey: myAchievementsKey });
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, qc, toast]);
}
