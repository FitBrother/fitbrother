import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { FollowRequestSchema, PublicProfileSchema, UsernameSchema } from "@fitbrother/shared";
import { signAvatarUrls, withSignedAvatars } from "../lib/avatars.js";
import { authRequired } from "../lib/auth.js";
import { internalError } from "../lib/errors.js";
import { supabaseService } from "../lib/supabase.js";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(20),
});

const availableQuerySchema = z.object({
  u: UsernameSchema,
});

export async function usersRoutes(app: FastifyInstance) {
  app.get("/users/search", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
    }

    const userId = req.user!.id;
    const { data, error } = await supabaseService()
      .from("public_profiles")
      .select("user_id, username, display_name, avatar_url")
      .ilike("username", `${parsed.data.q}%`)
      .neq("user_id", userId)
      .not("username", "is", null)
      .limit(20);

    if (error) {
      return internalError(reply, req.log, error, { where: "user_search" });
    }

    const perfis = data ?? [];
    const assinadas = await signAvatarUrls(perfis.map((u) => u.avatar_url));
    return reply.send({
      users: withSignedAvatars(perfis, assinadas).map((u) => PublicProfileSchema.parse(u)),
    });
  });

  app.get("/users/username-available", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = availableQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
    }

    const { count, error } = await supabaseService()
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .ilike("username", parsed.data.u);

    if (error) {
      return internalError(reply, req.log, error, { where: "username_available" });
    }

    return reply.send({ available: (count ?? 0) === 0 });
  });

  app.post("/follows", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = FollowRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_body" });
    }

    const userId = req.user!.id;
    if (parsed.data.followee_id === userId) {
      return reply.code(400).send({ error: "cannot_follow_self" });
    }

    const admin = supabaseService();
    const { data: target, error: targetError } = await admin
      .from("public_profiles")
      .select("user_id")
      .eq("user_id", parsed.data.followee_id)
      .maybeSingle();
    if (targetError)
      return internalError(reply, req.log, targetError, { where: "follow_target_lookup" });
    if (!target) return reply.code(404).send({ error: "user_not_found" });

    const { error } = await admin
      .from("follows")
      .upsert(
        { follower_id: userId, followee_id: parsed.data.followee_id },
        { onConflict: "follower_id,followee_id", ignoreDuplicates: true },
      );

    if (error) {
      return internalError(reply, req.log, error, { where: "follow" });
    }

    return reply.code(204).send();
  });

  app.delete("/follows/:followeeId", { preHandler: [authRequired] }, async (req, reply) => {
    const { followeeId } = req.params as { followeeId: string };
    const userId = req.user!.id;

    const { error } = await supabaseService()
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("followee_id", followeeId);

    if (error) {
      return internalError(reply, req.log, error, { where: "unfollow" });
    }

    return reply.code(204).send();
  });
}
