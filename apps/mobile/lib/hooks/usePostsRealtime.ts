import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { feedKey } from "./useFeed";

/**
 * Assina mudanças em posts (inclui like_count/comment_count via trigger) e
 * invalida o feed. A RLS do Realtime já limita o que o cliente recebe aos
 * posts que ele enxerga.
 */
export function usePostsRealtime(userId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`posts-feed:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        void qc.invalidateQueries({ queryKey: feedKey });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
