import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DailySummarySchema, type DailySummary } from "@fitbrother/shared";
import { authRequired, supabaseForRequest } from "../lib/auth.js";

const dailySummaryQuerySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD")
    .optional(),
});

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

  app.get("/me/daily-summary", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = dailySummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
    }
    const { day } = parsed.data;
    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);

    // Caso 1: dia explícito → query direta.
    // Caso 2: sem dia → view resolve "hoje" via boundary do user.
    const query = day
      ? supabase.from("daily_summaries").select("*").eq("day", day).maybeSingle()
      : supabase.from("vw_today_summary").select("*").maybeSingle();

    const { data, error } = await query;
    if (error) {
      req.log.error({ err: error }, "daily_summary_query_failed");
      return reply.code(500).send({ error: error.message });
    }

    if (data) {
      return reply.send({ summary: DailySummarySchema.parse(data) });
    }

    // Empty fallback — resolve dia via RPC, busca meta vigente, retorna shape zerado.
    const resolvedDay = day ?? (await supabase.rpc("fitbrother_today", { p_user_id: userId })).data;

    if (!resolvedDay) {
      req.log.error({ userId }, "fitbrother_today_returned_null");
      return reply.code(500).send({ error: "could_not_resolve_today" });
    }

    const { data: goal } = await supabase
      .from("nutrition_goals")
      .select("kcal, protein_g, carbs_g, fat_g")
      .lte("effective_from", resolvedDay)
      .or(`effective_to.is.null,effective_to.gte.${resolvedDay}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    const summary: DailySummary = {
      user_id: userId,
      day: resolvedDay,
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      goal_kcal: goal?.kcal ?? null,
      goal_protein_g: goal?.protein_g ?? null,
      goal_carbs_g: goal?.carbs_g ?? null,
      goal_fat_g: goal?.fat_g ?? null,
      goal_hit: false,
      meals_count: 0,
      updated_at: new Date().toISOString(),
    } satisfies DailySummary;

    return reply.send({ summary });
  });
}
