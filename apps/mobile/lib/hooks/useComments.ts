import { randomUUID } from "expo-crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addComment, fetchComments } from "@/lib/api/posts";
import { feedKey } from "./useFeed";

export const commentsKey = (postId: string) => ["comments", postId] as const;

export function useComments(postId: string) {
  return useQuery({
    queryKey: commentsKey(postId),
    queryFn: () => fetchComments(postId),
    enabled: Boolean(postId),
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addComment(postId, { id: randomUUID(), body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(postId) });
      void qc.invalidateQueries({ queryKey: feedKey });
    },
  });
}
