import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post } from "@fitbrother/shared";
import { setLike } from "@/lib/api/posts";
import { feedKey } from "./useFeed";
import { postKey } from "./usePost";

function aplicarLike(post: Post, liked: boolean): Post {
  return {
    ...post,
    liked_by_me: liked,
    like_count: Math.max(0, post.like_count + (liked ? 1 : -1)),
  };
}

/**
 * Curtir/descurtir com update otimista. Reverte em erro e revalida no fim
 * (a contagem real chega via trigger/realtime).
 *
 * Atualiza DOIS caches: a lista do feed e o post avulso. O mesmo PostCard é
 * renderizado nos dois lugares, e mexer só no feed deixava o botão inerte na
 * tela de post — o like ia para o servidor, mas nada na tela mudava, nem o
 * coração nem a contagem, porque aquela tela lê de `postKey`.
 */
export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) => setLike(postId, liked),
    onMutate: async ({ postId, liked }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: feedKey }),
        qc.cancelQueries({ queryKey: postKey(postId) }),
      ]);

      const prevFeed = qc.getQueryData<Post[]>(feedKey);
      const prevPost = qc.getQueryData<Post>(postKey(postId));

      qc.setQueryData<Post[]>(feedKey, (old) =>
        (old ?? []).map((p) => (p.id === postId ? aplicarLike(p, liked) : p)),
      );
      qc.setQueryData<Post>(postKey(postId), (old) => (old ? aplicarLike(old, liked) : old));

      return { prevFeed, prevPost, postId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevFeed) qc.setQueryData(feedKey, ctx.prevFeed);
      if (ctx?.prevPost) qc.setQueryData(postKey(ctx.postId), ctx.prevPost);
    },
    onSettled: (_data, _err, { postId }) => {
      void qc.invalidateQueries({ queryKey: feedKey });
      void qc.invalidateQueries({ queryKey: postKey(postId) });
    },
  });
}
