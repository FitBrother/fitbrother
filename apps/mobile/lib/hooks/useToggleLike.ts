import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post } from "@fitbrother/shared";
import { setLike } from "@/lib/api/posts";
import { feedKey } from "./useFeed";

/**
 * Curtir/descurtir com update otimista no cache do feed. Reverte em erro e
 * revalida no fim (a contagem real chega via trigger/realtime).
 */
export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => setLike(postId, liked),
    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: feedKey });
      const prev = qc.getQueryData<Post[]>(feedKey);
      qc.setQueryData<Post[]>(feedKey, (old) =>
        (old ?? []).map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: liked,
                like_count: Math.max(0, p.like_count + (liked ? 1 : -1)),
              }
            : p,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(feedKey, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: feedKey });
    },
  });
}
