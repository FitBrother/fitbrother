import type { SupabaseClient } from "@supabase/supabase-js";
import { AchievementSchema, PostSchema } from "@fitbrother/shared";
import { signAvatarUrls, withSignedAvatars } from "./avatars.js";
import { supabaseService } from "./supabase.js";

/**
 * Montagem de posts para resposta — colunas, autores, conquistas e likes.
 *
 * Mora em `lib/` e não em `routes/posts.ts` porque o perfil público
 * (`GET /users/:id`) devolve exatamente o mesmo formato de post que o feed.
 * Duplicar a montagem faria os dois divergirem no primeiro campo novo.
 */

export type PostRow = {
  id: string;
  user_id: string;
  post_type: "meal" | "achievement";
  meal_id: string | null;
  achievement_id: string | null;
  caption: string | null;
  image_path: string | null;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  deleted_at: string | null;
};

export const POST_SELECT = `
  id, user_id, post_type, meal_id, achievement_id, caption, image_path,
  total_kcal, total_protein_g, total_carbs_g, total_fat_g,
  like_count, comment_count, created_at, deleted_at
`;

export async function likedPostIds(
  admin: SupabaseClient,
  userId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data } = await admin
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  return new Set((data ?? []).map((r) => r.post_id as string));
}

export async function attachAuthors(rows: PostRow[], liked: Set<string> = new Set()) {
  if (rows.length === 0) return [];
  const admin = supabaseService();
  const ids = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data, error } = await admin
    .from("public_profiles")
    .select("user_id, username, display_name, avatar_url")
    .in("user_id", ids);
  if (error) throw new Error(error.message);
  const assinadas = await signAvatarUrls((data ?? []).map((author) => author.avatar_url));
  const authors = new Map(
    withSignedAvatars(data ?? [], assinadas).map((author) => [author.user_id, author]),
  );
  const achievementIds = Array.from(
    new Set(rows.map((row) => row.achievement_id).filter((id): id is string => Boolean(id))),
  );
  const achievements = new Map<string, unknown>();
  if (achievementIds.length > 0) {
    const { data: achievementRows, error: achievementError } = await admin
      .from("achievements")
      .select("*")
      .in("id", achievementIds);
    if (achievementError) throw new Error(achievementError.message);
    for (const achievement of achievementRows ?? []) {
      achievements.set(achievement.id, AchievementSchema.parse(achievement));
    }
  }
  return rows.map((row) =>
    PostSchema.parse({
      ...row,
      achievement: row.achievement_id ? (achievements.get(row.achievement_id) ?? null) : null,
      author: authors.get(row.user_id) ?? {
        user_id: row.user_id,
        username: null,
        display_name: null,
        avatar_url: null,
      },
      liked_by_me: liked.has(row.id),
    }),
  );
}
