import { useQuery } from "@tanstack/react-query";
import { fetchPost } from "@/lib/api/posts";

export const postKey = (postId: string) => ["post", postId] as const;

export function usePost(postId: string) {
  return useQuery({
    queryKey: postKey(postId),
    queryFn: () => fetchPost(postId),
    enabled: Boolean(postId),
  });
}
