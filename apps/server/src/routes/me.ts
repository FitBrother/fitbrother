import type { FastifyInstance } from "fastify";
import { authRequired, supabaseForRequest } from "../lib/auth.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [authRequired] }, async (req, reply) => {
    const supabase = supabaseForRequest(req);

    const [profileQ, goalQ, anthroQ] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase.from("nutrition_goals").select("*").is("effective_to", null).maybeSingle(),
      supabase
        .from("anthropometrics")
        .select("*")
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const firstError = profileQ.error ?? goalQ.error ?? anthroQ.error;
    if (firstError) {
      req.log.error({ err: firstError }, "me_query_failed");
      return reply.code(500).send({ error: firstError.message });
    }

    if (!profileQ.data) {
      return reply.code(404).send({ error: "profile_not_found" });
    }

    return reply.send({
      profile: profileQ.data,
      nutrition_goal: goalQ.data,
      anthropometric: anthroQ.data,
    });
  });
}
