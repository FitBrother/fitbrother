import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSubscription } from "@/lib/api/billing";
import { removeStaleChannel, supabase } from "@/lib/supabase";

export const subscriptionKey = ["billing", "subscription"] as const;

export function useSubscription() {
  return useQuery({ queryKey: subscriptionKey, queryFn: getSubscription });
}

export function useSubscriptionRealtime(userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const topic = `sub:${userId}`;

    void removeStaleChannel(topic).then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "subscriptions",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: subscriptionKey });
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
