import type { FastifyInstance } from "fastify";
import { AchievementSchema, UserAchievementSchema } from "@fitbrother/shared";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { internalError } from "../lib/errors.js";

export async function achievementsRoutes(app: FastifyInstance) {
  // Global catalog (read-only, RLS USING true). The client merges this with
  // /me/achievements to render locked + unlocked side by side.
  app.get("/achievements", { preHandler: [authRequired] }, async (req, reply) => {
    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("achievements")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return internalError(reply, req.log, error, { where: "achievements_query" });
    }

    return reply.send({
      achievements: (data ?? []).map((row) => AchievementSchema.parse(row)),
    });
  });

  // The authenticated user's unlocked achievements (RLS owner_read).
  app.get("/me/achievements", { preHandler: [authRequired] }, async (req, reply) => {
    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .order("unlocked_at", { ascending: false });

    if (error) {
      return internalError(reply, req.log, error, { where: "user_achievements_query" });
    }

    return reply.send({
      achievements: (data ?? []).map((row) => UserAchievementSchema.parse(row)),
    });
  });
}
