import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  DailySummarySchema,
  StreakSchema,
  type DailySummary,
  type Streak,
} from "@fitbrother/shared";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { supabaseService } from "../lib/supabase.js";
import { hashE164, reverseMatchFollows } from "../services/contacts.js";

const dailySummaryQuerySchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD")
    .optional(),
});

const dailySummariesQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
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

  app.get("/me/streak", { preHandler: [authRequired] }, async (req, reply) => {
    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);

    const [streakQ, riskQ] = await Promise.all([
      supabase.from("streaks").select("*").maybeSingle(),
      supabase.rpc("fitbrother_streak_at_risk", { p_user_id: userId }),
    ]);
    if (streakQ.error) {
      req.log.error({ err: streakQ.error }, "streak_query_failed");
      return reply.code(500).send({ error: streakQ.error.message });
    }

    // No row yet (new user, never hit a goal) → zeroed default so the client
    // can render the counter without special-casing.
    const streak: Streak = streakQ.data
      ? StreakSchema.parse(streakQ.data)
      : {
          user_id: userId,
          current_streak: 0,
          longest_streak: 0,
          last_hit_day: null,
          freezes_available: 0,
          updated_at: new Date().toISOString(),
        };

    return reply.send({ streak, at_risk: riskQ.data === true });
  });

  // Confirma a verificação de telefone feita via Supabase Auth (phone OTP).
  // Não confia no cliente: lê auth.users.phone_confirmed_at via service-role e
  // SÓ ENTÃO carimba profiles (verified + e164 + hash) e dispara reverse-match.
  app.post("/me/verify-phone", { preHandler: [authRequired] }, async (req, reply) => {
    const userId = req.user!.id;
    const admin = supabaseService();

    const { data: udata, error: uerr } = await admin.auth.admin.getUserById(userId);
    if (uerr || !udata.user) {
      req.log.error({ err: uerr }, "verify_phone_getuser_failed");
      return reply.code(500).send({ error: "could_not_read_user" });
    }
    const phone = udata.user.phone;
    const confirmed = udata.user.phone_confirmed_at;
    if (!phone || !confirmed) {
      return reply.code(409).send({ error: "phone_not_confirmed" });
    }

    // Supabase guarda phone sem '+'. Normaliza pra E.164 com '+'.
    const e164 = phone.startsWith("+") ? phone : `+${phone}`;
    const phoneHash = hashE164(e164);

    const { data: prof, error: upErr } = await admin
      .from("profiles")
      .update({
        phone_e164: e164,
        phone_verified_at: new Date().toISOString(),
        phone_hash: phoneHash,
      })
      .eq("user_id", userId)
      .select("full_name")
      .maybeSingle();
    if (upErr) {
      req.log.error({ err: upErr }, "verify_phone_update_failed");
      return reply.code(500).send({ error: upErr.message });
    }

    try {
      const followers = await reverseMatchFollows(
        admin,
        userId,
        phoneHash,
        prof?.full_name ?? null,
      );
      req.log.info({ userId, followers }, "verify_phone_reverse_match");
    } catch (err) {
      // reverse-match é aditivo: não derruba a verificação.
      req.log.error({ err }, "verify_phone_reverse_match_failed");
    }

    return reply.code(204).send();
  });

  app.get("/me/daily-summaries", { preHandler: [authRequired] }, async (req, reply) => {
    const parsed = dailySummariesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "bad_query" });
    }
    const { from, to } = parsed.data;
    const daysDiff = Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
    if (daysDiff < 0) return reply.code(400).send({ error: "from_after_to" });
    if (daysDiff > 31) return reply.code(400).send({ error: "range_too_large" });

    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("daily_summaries")
      .select("*")
      .gte("day", from)
      .lte("day", to)
      .order("day", { ascending: false });

    if (error) {
      req.log.error({ err: error }, "daily_summaries_query_failed");
      return reply.code(500).send({ error: error.message });
    }

    return reply.send({
      summaries: (data ?? []).map((row) => DailySummarySchema.parse(row)),
    });
  });
}
