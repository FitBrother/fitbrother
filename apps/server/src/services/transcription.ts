import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "../lib/supabase.js";
import { assertWithinCap, recordUsage } from "./ai-usage.js";
import { transcribe } from "./llm/whisper.js";

/**
 * Transcribe an audio file already uploaded to the `meal-audios` bucket.
 *
 * Cap accounting (CLAUDE.md #4):
 *   * Cache hit  → no cap check, no record. The hit table doesn't exist for
 *     transcriptions (intentional — the bucket itself is the audit trail).
 *   * Cache miss → assertWithinCap('whisper_seconds') BEFORE the call,
 *     recordUsage(...) AFTER.
 *
 * Why service_role for download:
 *   The user already passed RLS on upload (storage policy by folder). We
 *   download with service_role because the cache lookup needs the raw bytes
 *   regardless of which user originally uploaded the same content (the
 *   cross-user cache is intentional — see migration 0016).
 */

const AUDIO_BUCKET = "meal-audios";

export type TranscribeFromPathResult = {
  text: string;
  cacheHit: boolean;
  audioHash: string;
};

export async function transcribeFromPath(params: {
  userClient: SupabaseClient;
  userId: string;
  audioPath: string;
  durationS: number;
  locale: string;
}): Promise<TranscribeFromPathResult> {
  const { userClient, userId, audioPath, durationS, locale } = params;

  // 1. Download via service_role. We trust the route to have validated
  //    that audioPath starts with `${userId}/`.
  const svc = supabaseService();
  const { data: blob, error: downloadErr } = await svc.storage
    .from(AUDIO_BUCKET)
    .download(audioPath);
  if (downloadErr) {
    throw new Error(`transcription_download_failed: ${downloadErr.message}`);
  }
  const audioBuffer = await blob.arrayBuffer();

  // 2. SHA-256 hash for cache key.
  const audioHash = createHash("sha256").update(new Uint8Array(audioBuffer)).digest("hex");

  // 3. Cache lookup (authenticated SELECT, RLS allows all).
  const { data: cached, error: lookupErr } = await userClient
    .from("transcriptions")
    .select("text")
    .eq("audio_hash", audioHash)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`transcription_cache_lookup_failed: ${lookupErr.message}`);
  }
  if (cached) {
    return { text: cached.text as string, cacheHit: true, audioHash };
  }

  // 4. Cache miss → cap check + Whisper call.
  await assertWithinCap(userClient, userId, "whisper_seconds");

  const ext = audioPath.endsWith(".m4a") ? "m4a" : "opus";
  const language = locale.split("-")[0]; // "pt-BR" → "pt"
  const result = await transcribe({
    audioBuffer,
    ext,
    durationS,
    language,
  });

  // 5. Persist cache + usage. Use service_role for the INSERT (writes go
  //    to a table without an INSERT policy for authenticated users).
  const { error: insertErr } = await svc.from("transcriptions").insert({
    audio_hash: audioHash,
    text: result.text,
    language,
    duration_s: durationS,
    model: result.model,
    cost_cents: result.costCents,
  });
  // Race: another concurrent request may have inserted same hash. Treat
  // unique violation as success.
  if (insertErr && insertErr.code !== "23505") {
    throw new Error(`transcription_cache_insert_failed: ${insertErr.message}`);
  }

  await recordUsage(userId, {
    transcriptionSeconds: durationS,
    transcriptionCostCents: result.costCents,
  });

  return { text: result.text, cacheHit: false, audioHash };
}
