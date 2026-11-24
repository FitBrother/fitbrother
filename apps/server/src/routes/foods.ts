import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { internalError } from "../lib/errors.js";
import { searchFoods } from "../services/food-search.js";

const searchQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
});

export async function foodsRoutes(app: FastifyInstance) {
  app.get("/foods/search", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
    }

    try {
      const suggestions = await searchFoods(supabaseForRequest(req), parsed.data.q ?? "");
      return reply.send({ suggestions });
    } catch (err) {
      return internalError(reply, req.log, err, { where: "foods_search" });
    }
  });
}
