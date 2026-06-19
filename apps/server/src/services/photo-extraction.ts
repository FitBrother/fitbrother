import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealExtraction } from "@fitbrother/shared";
import { env } from "../lib/env.js";
import { supabaseService } from "../lib/supabase.js";
import { assertWithinCap, recordUsage } from "./ai-usage.js";
import { extractMealImageWithGemini } from "./llm/gemini.js";

const IMAGE_BUCKET = "post-images";

export type PhotoExtractionResult = {
  output: MealExtraction;
  cacheHit: boolean;
  inputHash: string;
};

function mimeFromPath(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function extractMealFromPhoto(params: {
  userClient: SupabaseClient;
  userId: string;
  imagePath: string;
  locale: string;
}): Promise<PhotoExtractionResult> {
  const { userClient, userId, imagePath, locale } = params;
  const { data: blob, error: downloadError } = await userClient.storage
    .from(IMAGE_BUCKET)
    .download(imagePath);
  if (downloadError || !blob) {
    throw new Error(`photo_download_failed: ${downloadError?.message ?? "empty_blob"}`);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const inputHash = createHash("sha256")
    .update(bytes)
    .update(`\x00photo\x00${env.LLM_PROMPT_VERSION}\x00${locale}`)
    .digest("hex");

  const { data: cached, error: lookupError } = await userClient
    .from("ai_extractions")
    .select("result_json")
    .eq("input_hash", inputHash)
    .maybeSingle();
  if (lookupError) throw new Error(`photo_cache_lookup_failed: ${lookupError.message}`);
  if (cached) {
    await logExtractionHit(userId, inputHash, true);
    return { output: cached.result_json as MealExtraction, cacheHit: true, inputHash };
  }

  if (env.LLM_PROVIDER !== "gemini") {
    throw new Error("photo_extraction_requires_gemini");
  }

  await assertWithinCap(userClient, userId, "llm_tokens");
  const { output, usage } = await extractMealImageWithGemini({
    base64: Buffer.from(bytes).toString("base64"),
    mimeType: mimeFromPath(imagePath),
    locale,
  });

  const svc = supabaseService();
  const { error: insertError } = await svc.from("ai_extractions").insert({
    input_hash: inputHash,
    result_json: output,
    model: "gemini-2.5-flash",
    prompt_version: `${env.LLM_PROMPT_VERSION}:photo`,
    tokens_input: usage.inputTokens,
    tokens_output: usage.outputTokens,
    cost_cents: usage.costCents,
    confidence: output.confidence,
  });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`photo_cache_insert_failed: ${insertError.message}`);
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
  const { error } = await supabaseService().from("ai_extraction_hits").insert({
    user_id: userId,
    input_hash: inputHash,
    was_cache_hit: wasCacheHit,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[photo-extraction] hit log failed:", error.message);
  }
}
