import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api/posts";

export const feedKey = ["feed"] as const;

/**
 * Feed paginado: cada página traz `FEED_PAGE_SIZE` posts (ver
 * apps/server/src/routes/posts.ts) mais o cursor `next_cursor` pra pedir a
 * próxima. `feed.data.pages` é a lista de páginas — achate com `flatMap` pra
 * ter os posts em sequência.
 */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: feedKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 20_000,
  });
}
