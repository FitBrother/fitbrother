import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealExtraction } from "@fitbrother/shared";
import { env } from "../lib/env.js";
import { supabaseService } from "../lib/supabase.js";
import { getLlmProvider } from "./llm/index.js";
import { assertWithinCap, recordUsage } from "./ai-usage.js";

/**
 * Extract structured meal data from natural language text. Caches by
 * sha256(text + prompt_version + locale) so identical input from any user
 * is a free DB lookup.
 *
 * Bumping LLM_PROMPT_VERSION invalidates the entire cache without TRUNCATE —
 * new requests miss because the hash differs.
 *
 * Cap accounting (CLAUDE.md #4):
 *   * Cache hit → no cap check, no record. The user already "paid" for this
 *     extraction when it was first computed (by them or anyone else); the
 *     hits table tracks who touched what for analytics + LGPD.
 *   * Cache miss → assertWithinCap('llm_tokens') BEFORE the call,
 *     recordUsage(...) AFTER. Failure to record (after a successful LLM call)
 *     is logged but does NOT roll back the cache write — losing 1 row of
 *     accounting beats forcing the user to pay twice.
 */

export type ExtractionResult = {
  output: MealExtraction;
  cacheHit: boolean;
  inputHash: string;
};

function hashInput(text: string, locale: string): string {
  return createHash("sha256")
    .update(`${text}\x00${env.LLM_PROMPT_VERSION}\x00${locale}`)
    .digest("hex");
}

export async function extractMeal(params: {
  userClient: SupabaseClient;
  userId: string;
  text: string;
  locale: string;
}): Promise<ExtractionResult> {
  const { userClient, userId, text, locale } = params;
  const inputHash = hashInput(text, locale);

  // 1. Cache lookup — global (any user can hit any cached extraction).
  const { data: cached, error: lookupErr } = await userClient
    .from("ai_extractions")
    .select("result_json")
    .eq("input_hash", inputHash)
    .maybeSingle();

  if (lookupErr) throw new Error(`extraction_cache_lookup_failed: ${lookupErr.message}`);

  if (cached) {
    await logExtractionHit(userId, inputHash, true);
    return {
      output: cached.result_json as MealExtraction,
      cacheHit: true,
      inputHash,
    };
  }

  // 2. Cache miss → cap check + provider call.
  await assertWithinCap(userClient, userId, "llm_tokens");

  const provider = getLlmProvider();
  const { output, usage } = await provider.extractMeal({ text, locale });

  // 3. Persist cache + hits + usage. Use service_role for writes because
  // these tables don't grant INSERT to authenticated users.
  const svc = supabaseService();
  const { error: insertErr } = await svc.from("ai_extractions").insert({
    input_hash: inputHash,
    result_json: output,
    model: provider.name === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini",
    prompt_version: env.LLM_PROMPT_VERSION,
    tokens_input: usage.inputTokens,
    tokens_output: usage.outputTokens,
    cost_cents: usage.costCents,
    confidence: output.confidence,
  });
  // Race: another concurrent request may have inserted the same hash. Treat
  // unique violation as success (we already have the data we need).
  if (insertErr && insertErr.code !== "23505") {
    throw new Error(`extraction_cache_insert_failed: ${insertErr.message}`);
  }

  await logExtractionHit(userId, inputHash, false);

  await recordUsage(userId, {
    llmInputTokens: usage.inputTokens,
    llmOutputTokens: usage.outputTokens,
    llmCostCents: usage.costCents,
  });

  return { output, cacheHit: false, inputHash };
}

async function logExtractionHit(
  userId: string,
  inputHash: string,
  wasCacheHit: boolean,
): Promise<void> {
  // service_role write — table has no INSERT policy for authenticated.
  const { error } = await supabaseService().from("ai_extraction_hits").insert({
    user_id: userId,
    input_hash: inputHash,
    was_cache_hit: wasCacheHit,
  });
  if (error) {
    // Logging failure must not break extraction — degrade silently.
    // eslint-disable-next-line no-console
    console.warn("[extraction] hit log failed:", error.message);
  }
}
