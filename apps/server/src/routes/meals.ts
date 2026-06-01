import {
  CreateMealAudioRequestSchema,
  CreateMealTextRequestSchema,
  PatchMealRequestSchema,
} from "@fitbrother/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { authRequired, supabaseForRequest } from "../lib/auth.js";
import { addDaysIso } from "../lib/dateMath.js";
import { AiQuotaExceededError } from "../services/ai-usage.js";
import { extractMeal } from "../services/extraction.js";
import { applyCatalogToItems } from "../services/meals.js";
import { transcribeFromPath } from "../services/transcription.js";

/**
 * Meal endpoints — the M2 capture pipeline.
 *
 *   POST /meals/text         → extract via LLM, persist, return meal
 *   GET  /meals?day=...      → list meals for a nutritional day
 *   GET  /meals/:id          → single meal with items (used by detail screen)
 *   PATCH /meals/:id         → edit type / consumed_at / items (full replace)
 *   POST /meals/:id/confirm  → flip review_required=false → counts in summary
 *   DELETE /meals/:id        → soft delete (sets meals.deleted_at)
 *
 * Auth: all routes require a Supabase JWT. The `supabaseForRequest(req)`
 * helper returns a user-scoped client; RLS owner_all on every table makes
 * cross-user reads/writes impossible.
 *
 * Audio (POST /meals/audio + signed-upload-url) lands in PR-M2.3.
 */

const MEAL_DETAIL_SELECT = `
  id, source, raw_input, audio_path, meal_type, consumed_at,
  total_kcal, total_protein_g, total_carbs_g, total_fat_g,
  confidence, review_required, created_at, deleted_at,
  items:meal_items(
    id, food_id, description, quantity, unit,
    kcal, protein_g, carbs_g, fat_g, density_assumed
  )
`;

export async function mealsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authRequired);

  /* ── POST /meals/text ──────────────────────────────────────────────── */
  app.post("/meals/text", async (req, reply) => {
    const parsed = CreateMealTextRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    const { client_meal_id, text, consumed_at, locale } = parsed.data;
    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);

    if (consumed_at) {
      const { data: backfillDayRaw, error: dayErr } = await supabase.rpc(
        "fitbrother_nutritional_day",
        { p_user_id: userId, p_ts: consumed_at },
      );
      if (dayErr || !backfillDayRaw) {
        req.log.error({ err: dayErr, consumed_at }, "nutritional_day_failed");
        return reply.code(500).send({ error: "nutritional_day_failed" });
      }
      const { data: todayRaw, error: todayErr } = await supabase.rpc("fitbrother_today", {
        p_user_id: userId,
      });
      if (todayErr || !todayRaw) {
        req.log.error({ err: todayErr, userId }, "today_lookup_failed");
        return reply.code(500).send({ error: "today_lookup_failed" });
      }
      const backfillDay = backfillDayRaw as string;
      const today = todayRaw as string;
      const minDay = addDaysIso(today, -6);
      if (backfillDay < minDay || backfillDay > today) {
        return reply.code(400).send({
          error: "backfill_window_exceeded",
          window: { from: minDay, to: today },
        });
      }
    }

    let extraction;
    try {
      extraction = await extractMeal({
        userClient: supabase,
        userId,
        text,
        locale,
      });
    } catch (err) {
      if (err instanceof AiQuotaExceededError) {
        return reply.code(429).send({ error: err.code, kind: err.kind });
      }
      // Upstream LLM/provider failures may carry their own .status (e.g.
      // Gemini 401 for an invalid key). We MUST NOT re-emit those — Fastify's
      // default error handler would mirror them, and the mobile client treats
      // 401 as "session expired" and signs the user out. Always 502 for
      // upstream failures.
      req.log.error({ err }, "extraction_failed");
      return reply.code(502).send({ error: "ai_extraction_failed" });
    }

    const { applied } = await applyCatalogToItems(supabase, extraction.output);

    const { data: rpcResult, error: rpcError } = await supabase.rpc("create_meal_with_items", {
      payload: {
        id: client_meal_id,
        source: "app_text",
        raw_input: text,
        audio_path: null,
        meal_type: extraction.output.meal_type,
        consumed_at: consumed_at ?? null,
        confidence: extraction.output.confidence,
        items: applied,
      },
    });

    if (rpcError) {
      req.log.error({ err: rpcError, client_meal_id }, "create_meal_rpc_failed");
      return reply.code(500).send({ error: rpcError.message });
    }

    const meal = await loadMeal(supabase, client_meal_id, req);
    if (!meal) {
      return reply.code(500).send({ error: "meal_disappeared_after_create" });
    }

    return reply.code(201).send({
      meal,
      cache_hit: extraction.cacheHit,
      already_existed: (rpcResult as { already_existed?: boolean })?.already_existed === true,
    });
  });

  /* ── POST /meals/audio ─────────────────────────────────────────────── */
  app.post("/meals/audio", async (req, reply) => {
    const parsed = CreateMealAudioRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    const { client_meal_id, audio_path, duration_s, consumed_at, locale } = parsed.data;
    const userId = req.user!.id;
    const supabase = supabaseForRequest(req);

    // Ownership check: the storage RLS already gated the upload, but the
    // server downloads via service_role (which bypasses RLS) so we must
    // verify the prefix matches the caller before touching the bucket.
    if (!audio_path.startsWith(`${userId}/`)) {
      return reply.code(403).send({ error: "audio_path_ownership_mismatch" });
    }

    if (consumed_at) {
      const { data: backfillDayRaw, error: dayErr } = await supabase.rpc(
        "fitbrother_nutritional_day",
        { p_user_id: userId, p_ts: consumed_at },
      );
      if (dayErr || !backfillDayRaw) {
        req.log.error({ err: dayErr, consumed_at }, "nutritional_day_failed");
        return reply.code(500).send({ error: "nutritional_day_failed" });
      }
      const { data: todayRaw, error: todayErr } = await supabase.rpc("fitbrother_today", {
        p_user_id: userId,
      });
      if (todayErr || !todayRaw) {
        req.log.error({ err: todayErr, userId }, "today_lookup_failed");
        return reply.code(500).send({ error: "today_lookup_failed" });
      }
      const backfillDay = backfillDayRaw as string;
      const today = todayRaw as string;
      const minDay = addDaysIso(today, -6);
      if (backfillDay < minDay || backfillDay > today) {
        return reply.code(400).send({
          error: "backfill_window_exceeded",
          window: { from: minDay, to: today },
        });
      }
    }

    // 1. Transcribe (with cap + cache).
    let transcription;
    try {
      transcription = await transcribeFromPath({
        userClient: supabase,
        userId,
        audioPath: audio_path,
        durationS: duration_s,
        locale,
      });
    } catch (err) {
      if (err instanceof AiQuotaExceededError) {
        return reply.code(429).send({ error: err.code, kind: err.kind });
      }
      req.log.error({ err, audio_path }, "transcription_failed");
      return reply.code(502).send({ error: "transcription_failed" });
    }

    if (!transcription.text || transcription.text.length === 0) {
      // Whisper returns empty string for silence/noise. Treat as user error.
      return reply.code(422).send({ error: "empty_transcription" });
    }

    // 2. Extract meal from transcribed text (reuses M2.3 service).
    let extraction;
    try {
      extraction = await extractMeal({
        userClient: supabase,
        userId,
        text: transcription.text,
        locale,
      });
    } catch (err) {
      if (err instanceof AiQuotaExceededError) {
        return reply.code(429).send({ error: err.code, kind: err.kind });
      }
      req.log.error({ err }, "extraction_failed");
      return reply.code(502).send({ error: "ai_extraction_failed" });
    }

    const { applied } = await applyCatalogToItems(supabase, extraction.output);

    // 3. Persist meal via RPC. source="app_audio" + audio_path set.
    const { data: rpcResult, error: rpcError } = await supabase.rpc("create_meal_with_items", {
      payload: {
        id: client_meal_id,
        source: "app_audio",
        raw_input: transcription.text,
        audio_path,
        meal_type: extraction.output.meal_type,
        consumed_at: consumed_at ?? null,
        confidence: extraction.output.confidence,
        items: applied,
      },
    });

    if (rpcError) {
      req.log.error({ err: rpcError, client_meal_id }, "create_meal_rpc_failed");
      return reply.code(500).send({ error: rpcError.message });
    }

    const meal = await loadMeal(supabase, client_meal_id, req);
    if (!meal) {
      return reply.code(500).send({ error: "meal_disappeared_after_create" });
    }

    return reply.code(201).send({
      meal,
      cache_hit_transcription: transcription.cacheHit,
      cache_hit_extraction: extraction.cacheHit,
      already_existed: (rpcResult as { already_existed?: boolean })?.already_existed === true,
    });
  });

  /* ── GET /meals?day=YYYY-MM-DD ─────────────────────────────────────── */
  app.get<{ Querystring: { day?: string } }>("/meals", async (req, reply) => {
    const day = req.query.day;
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return reply.code(400).send({ error: "day_required_YYYY_MM_DD" });
    }
    const supabase = supabaseForRequest(req);

    // We need meals where fitbrother_nutritional_day(user, consumed_at) = day.
    // PostgREST can't call the helper inline. Cheapest correct query: pull a
    // ±3-day window (covers any timezone + day_start_hour combo) then have
    // the DB classify each candidate via the boundary RPC. A dedicated
    // RPC `fitbrother_meals_for_day(user, day)` would beat the N+1 calls
    // here; deferred until the list grows past trivial sizes.
    const from = new Date(`${day}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 3);
    const to = new Date(`${day}T00:00:00Z`);
    to.setUTCDate(to.getUTCDate() + 3);

    const { data, error } = await supabase
      .from("meals")
      .select(MEAL_DETAIL_SELECT)
      .gte("consumed_at", from.toISOString())
      .lt("consumed_at", to.toISOString())
      .is("deleted_at", null)
      .order("consumed_at", { ascending: false });

    if (error) return reply.code(500).send({ error: error.message });

    // Filter by the nutritional day for this user (avoid mis-attributing
    // meals around the day_start_hour boundary).
    const meals = await filterByNutritionalDay(supabase, req.user!.id, data ?? [], day);
    return reply.send({ meals });
  });

  /* ── GET /meals/:id ────────────────────────────────────────────────── */
  app.get<{ Params: { id: string } }>("/meals/:id", async (req, reply) => {
    const supabase = supabaseForRequest(req);
    const { data, error } = await supabase
      .from("meals")
      .select(MEAL_DETAIL_SELECT)
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: "not_found" });
    return reply.send({ meal: data });
  });

  /* ── PATCH /meals/:id ──────────────────────────────────────────────── */
  app.patch<{ Params: { id: string } }>("/meals/:id", async (req, reply) => {
    const parsed = PatchMealRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    const supabase = supabaseForRequest(req);
    const patch: Record<string, unknown> = {};
    if (parsed.data.meal_type) patch.meal_type = parsed.data.meal_type;
    if (parsed.data.consumed_at) patch.consumed_at = parsed.data.consumed_at;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("meals").update(patch).eq("id", req.params.id);
      if (error) return reply.code(500).send({ error: error.message });
    }

    if (parsed.data.items) {
      // Items: full replacement semantics. Simpler client logic + the
      // trigger handles the recompute regardless of how many rows change.
      const { error: deleteErr } = await supabase
        .from("meal_items")
        .delete()
        .eq("meal_id", req.params.id);
      if (deleteErr) return reply.code(500).send({ error: deleteErr.message });

      const { error: insertErr } = await supabase.from("meal_items").insert(
        parsed.data.items.map((it) => ({
          meal_id: req.params.id,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          kcal: it.kcal,
          protein_g: it.protein_g,
          carbs_g: it.carbs_g,
          fat_g: it.fat_g,
        })),
      );
      if (insertErr) return reply.code(500).send({ error: insertErr.message });
    }

    const meal = await loadMeal(supabase, req.params.id, req);
    if (!meal) return reply.code(404).send({ error: "not_found" });
    return reply.send({ meal });
  });

  /* ── POST /meals/:id/confirm ──────────────────────────────────────── */
  app.post<{ Params: { id: string } }>("/meals/:id/confirm", async (req, reply) => {
    const supabase = supabaseForRequest(req);
    const { error } = await supabase
      .from("meals")
      .update({ review_required: false })
      .eq("id", req.params.id);
    if (error) return reply.code(500).send({ error: error.message });
    const meal = await loadMeal(supabase, req.params.id, req);
    if (!meal) return reply.code(404).send({ error: "not_found" });
    return reply.send({ meal });
  });

  /* ── DELETE /meals/:id ─────────────────────────────────────────────── */
  app.delete<{ Params: { id: string } }>("/meals/:id", async (req, reply) => {
    const supabase = supabaseForRequest(req);
    const { error } = await supabase
      .from("meals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(204).send();
  });
}

async function loadMeal(
  supabase: ReturnType<typeof supabaseForRequest>,
  id: string,
  req: FastifyRequest,
) {
  const { data, error } = await supabase
    .from("meals")
    .select(MEAL_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    req.log.error({ err: error, meal_id: id }, "meal_load_failed");
    return null;
  }
  return data;
}

type MealRow = {
  consumed_at: string;
  [key: string]: unknown;
};

async function filterByNutritionalDay(
  supabase: ReturnType<typeof supabaseForRequest>,
  userId: string,
  meals: MealRow[],
  targetDay: string,
): Promise<MealRow[]> {
  // For each candidate meal, ask the DB what nutritional day it belongs to.
  // Batched in a single RPC call would be ideal; for MVP N is small (~5/day).
  const result: MealRow[] = [];
  for (const meal of meals) {
    const { data, error } = await supabase.rpc("fitbrother_nutritional_day", {
      p_user_id: userId,
      p_ts: meal.consumed_at,
    });
    if (error) continue;
    if (data === targetDay) result.push(meal);
  }
  return result;
}
