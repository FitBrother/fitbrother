import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AchievementSchema,
  CommentSchema,
  CommentsResponseSchema,
  CreateAchievementPostRequestSchema,
  CreateCommentRequestSchema,
  CreatePostRequestSchema,
  LikeResponseSchema,
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

    const rows = (data ?? []) as PostRow[];
    const likedSet = await likedPostIds(
      admin,
      userId,
      rows.map((r) => r.id),
    );
    const posts = await attachAuthors(rows, likedSet);
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
    const likedSet = await likedPostIds(admin, userId, [data.id]);
    return reply.send({ post: (await attachAuthors([data as PostRow], likedSet))[0] });
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

  // ── Likes ─────────────────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>("/posts/:id/like", async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();
    const post = await loadVisiblePost(admin, req.params.id, userId);
    if (!post) return reply.code(404).send({ error: "not_found" });

    const { error } = await admin.from("post_likes").insert({ post_id: post.id, user_id: userId });
    if (error && error.code !== "23505") {
      req.log.error({ err: error }, "like_failed");
      return reply.code(500).send({ error: error.message });
    }
    // Notifica o autor só num like NOVO (não duplicado) e se não for o próprio.
    if (!error && post.user_id !== userId) {
      await admin.from("notifications").insert({
        user_id: post.user_id,
        channel: "push",
        kind: "post_like",
        template: "post_like",
        payload: { post_id: post.id, actor_id: userId },
      });
    }
    const { data: fresh } = await admin
      .from("posts")
      .select("like_count")
      .eq("id", post.id)
      .maybeSingle();
    return reply.send(
      LikeResponseSchema.parse({ liked: true, like_count: fresh?.like_count ?? 0 }),
    );
  });

  app.delete<{ Params: { id: string } }>("/posts/:id/like", async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();
    const { error } = await admin
      .from("post_likes")
      .delete()
      .eq("post_id", req.params.id)
      .eq("user_id", userId);
    if (error) {
      req.log.error({ err: error }, "unlike_failed");
      return reply.code(500).send({ error: error.message });
    }
    const { data: fresh } = await admin
      .from("posts")
      .select("like_count")
      .eq("id", req.params.id)
      .maybeSingle();
    return reply.send(
      LikeResponseSchema.parse({ liked: false, like_count: fresh?.like_count ?? 0 }),
    );
  });

  // ── Comentários (lista plana) ───────────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/posts/:id/comments", async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();
    const post = await loadVisiblePost(admin, req.params.id, userId);
    if (!post) return reply.code(404).send({ error: "not_found" });

    const { data, error } = await admin
      .from("post_comments")
      .select("id, post_id, user_id, body, created_at")
      .eq("post_id", post.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      req.log.error({ err: error }, "comments_query_failed");
      return reply.code(500).send({ error: error.message });
    }
    const comments = await attachCommentAuthors(admin, data ?? []);
    return reply.send(CommentsResponseSchema.parse({ comments }));
  });

  app.post<{ Params: { id: string } }>("/posts/:id/comments", async (req, reply) => {
    const userId = req.user!.id;
    const parsed = CreateCommentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    const admin = supabaseService();
    const post = await loadVisiblePost(admin, req.params.id, userId);
    if (!post) return reply.code(404).send({ error: "not_found" });

    const { data, error } = await admin
      .from("post_comments")
      .insert({ id: parsed.data.id, post_id: post.id, user_id: userId, body: parsed.data.body })
      .select("id, post_id, user_id, body, created_at")
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      req.log.error({ err: error }, "comment_insert_failed");
      return reply.code(status).send({ error: error.message });
    }
    if (post.user_id !== userId) {
      await admin.from("notifications").insert({
        user_id: post.user_id,
        channel: "push",
        kind: "post_comment",
        template: "post_comment",
        payload: { post_id: post.id, actor_id: userId, excerpt: parsed.data.body.slice(0, 80) },
      });
    }
    const [comment] = await attachCommentAuthors(admin, [data]);
    return reply.code(201).send({ comment });
  });

  app.delete<{ Params: { id: string } }>("/comments/:id", async (req, reply) => {
    const { error } = await supabaseService()
      .from("post_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id);
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(204).send();
  });
}

// Post visível ao caller (autor ou segue o autor) e não-deletado.
async function loadVisiblePost(
  admin: SupabaseClient,
  postId: string,
  userId: string,
): Promise<{ id: string; user_id: string } | null> {
  const { data } = await admin
    .from("posts")
    .select("id, user_id, deleted_at")
    .eq("id", postId)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  if (data.user_id === userId) return { id: data.id, user_id: data.user_id };
  const { data: follow } = await admin
    .from("follows")
    .select("follower_id")
    .eq("follower_id", userId)
    .eq("followee_id", data.user_id)
    .maybeSingle();
  return follow ? { id: data.id, user_id: data.user_id } : null;
}

// Quais desses posts o usuário curtiu (para liked_by_me).
async function likedPostIds(
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

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

async function attachCommentAuthors(admin: SupabaseClient, rows: CommentRow[]) {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data, error } = await admin
    .from("public_profiles")
    .select("user_id, username, display_name, avatar_url")
    .in("user_id", ids);
  if (error) throw new Error(error.message);
  const authors = new Map((data ?? []).map((a) => [a.user_id, a]));
  return rows.map((row) =>
    CommentSchema.parse({
      ...row,
      author: authors.get(row.user_id) ?? {
        user_id: row.user_id,
        username: null,
        display_name: null,
        avatar_url: null,
      },
    }),
  );
}

async function attachAuthor(row: PostRow) {
  return (await attachAuthors([row]))[0];
}

async function attachAuthors(rows: PostRow[], likedPostIds: Set<string> = new Set()) {
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
      liked_by_me: likedPostIds.has(row.id),
    }),
  );
}
