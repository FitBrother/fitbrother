import type { FastifyInstance } from "fastify";
import { FollowedProfileSchema, LeaderboardRowSchema } from "@fitbrother/shared";
import { authRequired } from "../lib/auth.js";
import { supabaseService } from "../lib/supabase.js";

export async function socialRoutes(app: FastifyInstance) {
  // Quem o usuário segue (perfil mínimo). Usa service-role + duas queries:
  // o FK de follows.followee_id aponta pra auth.users (não profiles), então não
  // dá pra embedar; e o RLS owner-only de profiles impede o client do usuário
  // de ler o full_name de terceiros. Só expomos user_id + full_name (sem macros).
  app.get("/following", { preHandler: [authRequired] }, async (req, reply) => {
    const admin = supabaseService();
    const { data: rows, error } = await admin
      .from("follows")
      .select("followee_id")
      .eq("follower_id", req.user!.id);
    if (error) {
      req.log.error({ err: error }, "following_query_failed");
      return reply.code(500).send({ error: error.message });
    }
    const ids = (rows ?? []).map((r) => r.followee_id);
    if (ids.length === 0) return reply.send({ following: [] });

    const { data: profs, error: pErr } = await admin
      .from("public_profiles")
      .select("user_id, display_name")
      .in("user_id", ids);
    if (pErr) {
      req.log.error({ err: pErr }, "following_profiles_failed");
      return reply.code(500).send({ error: pErr.message });
    }
    const following = (profs ?? []).map((p) =>
      FollowedProfileSchema.parse({ user_id: p.user_id, full_name: p.display_name }),
    );
    return reply.send({ following });
  });

  // Ranking semanal da rede do usuário. Usa a RPC (SECURITY DEFINER) via
  // service-role, passando o user_id do JWT. Marca is_me no map.
  app.get("/leaderboard/weekly", { preHandler: [authRequired] }, async (req, reply) => {
    const userId = req.user!.id;
    const { data, error } = await supabaseService().rpc("fitbrother_weekly_leaderboard", {
      p_user_id: userId,
    });
    if (error) {
      req.log.error({ err: error }, "leaderboard_query_failed");
      return reply.code(500).send({ error: error.message });
    }
    const rows = (data ?? []).map((r: Record<string, unknown>) =>
      LeaderboardRowSchema.parse({
        user_id: r.user_id,
        full_name: r.full_name ?? null,
        weekly_hits: r.weekly_hits,
        window_streak: r.window_streak,
        is_me: r.user_id === userId,
      }),
    );
    return reply.send({ rows });
  });
}
