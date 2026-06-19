import type { FastifyInstance } from "fastify";
import {
  AchievementSchema,
  CreateAchievementPostRequestSchema,
  CreatePostRequestSchema,
  PostSchema,
} from "@fitbrother/shared";
import { authRequired } from "../lib/auth.js";
import { supabaseService } from "../lib/supabase.js";

type PostRow = {
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

const POST_SELECT = `
  id, user_id, post_type, meal_id, achievement_id, caption, image_path,
  total_kcal, total_protein_g, total_carbs_g, total_fat_g,
  like_count, comment_count, created_at, deleted_at
`;

export async function postsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authRequired);

  app.post("/posts", async (req, reply) => {
    const parsed = CreatePostRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }

    const userId = req.user!.id;
    const admin = supabaseService();
    const { data: meal, error: mealError } = await admin
      .from("meals")
      .select(
        "id, user_id, total_kcal, total_protein_g, total_carbs_g, total_fat_g, deleted_at, review_required",
      )
      .eq("id", parsed.data.meal_id)
      .maybeSingle();

    if (mealError) {
      req.log.error({ err: mealError }, "post_meal_lookup_failed");
      return reply.code(500).send({ error: mealError.message });
    }
    if (!meal || meal.deleted_at) return reply.code(404).send({ error: "meal_not_found" });
    if (meal.user_id !== userId) return reply.code(403).send({ error: "meal_not_owned" });
    if (meal.review_required) return reply.code(409).send({ error: "meal_review_required" });

    const { data, error } = await admin
      .from("posts")
      .insert({
        id: parsed.data.id,
        user_id: userId,
        post_type: "meal",
        meal_id: meal.id,
        caption: parsed.data.caption?.trim() || null,
        image_path: parsed.data.image_path ?? null,
        total_kcal: meal.total_kcal,
        total_protein_g: meal.total_protein_g,
        total_carbs_g: meal.total_carbs_g,
        total_fat_g: meal.total_fat_g,
      })
      .select(POST_SELECT)
      .single();

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      req.log.error({ err: error }, "post_insert_failed");
      return reply
        .code(status)
        .send({ error: error.code === "23505" ? "already_posted" : error.message });
    }

    const post = await attachAuthor(data as PostRow);
    return reply.code(201).send({ post });
  });

  app.post("/posts/achievement", async (req, reply) => {
    const parsed = CreateAchievementPostRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }

    const userId = req.user!.id;
    const admin = supabaseService();
    const { data: unlocked, error: unlockedError } = await admin
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)
      .eq("achievement_id", parsed.data.achievement_id)
      .maybeSingle();
    if (unlockedError) {
      req.log.error({ err: unlockedError }, "achievement_post_unlocked_lookup_failed");
      return reply.code(500).send({ error: unlockedError.message });
    }
    if (!unlocked) return reply.code(403).send({ error: "achievement_not_unlocked" });

    const { data, error } = await admin
      .from("posts")
      .insert({
        id: parsed.data.id,
        user_id: userId,
        post_type: "achievement",
        achievement_id: parsed.data.achievement_id,
        caption: parsed.data.caption?.trim() || null,
      })
      .select(POST_SELECT)
      .single();

    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      req.log.error({ err: error }, "achievement_post_insert_failed");
      return reply
        .code(status)
        .send({ error: error.code === "23505" ? "already_posted" : error.message });
    }

    return reply.code(201).send({ post: await attachAuthor(data as PostRow) });
  });

  app.get("/feed", async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();

    const { data: follows, error: followsError } = await admin
      .from("follows")
      .select("followee_id")
      .eq("follower_id", userId);
    if (followsError) {
      req.log.error({ err: followsError }, "feed_follows_failed");
      return reply.code(500).send({ error: followsError.message });
    }

    const network = [userId, ...((follows ?? []).map((f) => f.followee_id) as string[])];
    const { data, error } = await admin
      .from("posts")
      .select(POST_SELECT)
      .in("user_id", network)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      req.log.error({ err: error }, "feed_posts_failed");
      return reply.code(500).send({ error: error.message });
    }

    const posts = await attachAuthors((data ?? []) as PostRow[]);
    return reply.send({ posts });
  });

  app.get<{ Params: { id: string } }>("/posts/:id", async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();
    const { data, error } = await admin
      .from("posts")
      .select(POST_SELECT)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data || data.deleted_at) return reply.code(404).send({ error: "not_found" });
    if (data.user_id !== userId) {
      const { data: follow } = await admin
        .from("follows")
        .select("follower_id")
        .eq("follower_id", userId)
        .eq("followee_id", data.user_id)
        .maybeSingle();
      if (!follow) return reply.code(404).send({ error: "not_found" });
    }
    return reply.send({ post: await attachAuthor(data as PostRow) });
  });

  app.delete<{ Params: { id: string } }>("/posts/:id", async (req, reply) => {
    const { error } = await supabaseService()
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(204).send();
  });
}

async function attachAuthor(row: PostRow) {
  return (await attachAuthors([row]))[0];
}

async function attachAuthors(rows: PostRow[]) {
  if (rows.length === 0) return [];
  const admin = supabaseService();
  const ids = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data, error } = await admin
    .from("public_profiles")
    .select("user_id, username, display_name, avatar_url")
    .in("user_id", ids);
  if (error) throw new Error(error.message);
  const authors = new Map((data ?? []).map((author) => [author.user_id, author]));
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
    }),
  );
}
