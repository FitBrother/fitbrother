import { randomUUID } from "expo-crypto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAchievementPost, createPost } from "@/lib/api/posts";
import { feedKey } from "./useFeed";

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; meal_id: string; caption?: string; image_path?: string }) =>
      createPost({ ...input, id: input.id ?? randomUUID() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedKey });
    },
  });
}

export function useCreateAchievementPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { achievement_id: string; caption?: string }) =>
      createAchievementPost({ id: randomUUID(), ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedKey });
    },
  });
}
