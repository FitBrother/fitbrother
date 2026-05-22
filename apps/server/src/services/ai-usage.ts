import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../lib/env.js";
import { supabaseService } from "../lib/supabase.js";

/**
 * Thin wrappers over the SQL functions defined in migration 0015_ai_usage.sql.
 *
 * Cap policy (CLAUDE.md backend rule #4):
 *   * Check BEFORE the real provider call (Whisper or LLM).
 *   * Record AFTER a real provider call succeeds. Cache hits do NOT record —
 *     otherwise a user with only cached inputs could lock themselves out.
 *
 * The RPCs run as SECURITY DEFINER and key the day off the nutritional
 * boundary (timezone + day_start_hour), not current_date.
 */

export type AiCapKind = "llm_tokens" | "whisper_seconds" | "cost_cents";

export class AiQuotaExceededError extends Error {
  readonly code = "AI_QUOTA_EXCEEDED";
  readonly kind: AiCapKind;
  constructor(kind: AiCapKind, detail?: string) {
    super(detail ?? "AI_QUOTA_EXCEEDED");
    this.kind = kind;
  }
}

const CAP_VALUES: Record<AiCapKind, number> = {
  llm_tokens: env.AI_CAP_LLM_TOKENS,
  whisper_seconds: env.AI_CAP_TRANSCRIPTION_SECONDS,
  cost_cents: env.AI_CAP_COST_CENTS,
};

export async function assertWithinCap(
  client: SupabaseClient,
  userId: string,
  kind: AiCapKind,
): Promise<void> {
  const { error } = await client.rpc("fitbrother_assert_ai_cap", {
    p_user_id: userId,
    p_kind: kind,
    p_cap: CAP_VALUES[kind],
  });

  if (!error) return;

  // The function RAISEs with MESSAGE = 'AI_QUOTA_EXCEEDED'. Postgres surfaces
  // it on error.message; DETAIL ends up in error.details.
  if (error.message?.includes("AI_QUOTA_EXCEEDED")) {
    throw new AiQuotaExceededError(kind, error.details ?? error.message);
  }
  throw new Error(`assert_ai_cap_failed: ${error.message}`);
}

export async function recordUsage(
  userId: string,
  delta: {
    transcriptionSeconds?: number;
    llmInputTokens?: number;
    llmOutputTokens?: number;
    llmCostCents?: number;
    transcriptionCostCents?: number;
  },
): Promise<void> {
  // recordUsage always runs as service_role so cron / worker jobs (e.g. the
  // future WA pipeline) can write usage even outside an authenticated
  // session. The SECURITY DEFINER on the SQL function would also accept
  // a user-scoped client; we use service for consistency.
  const { error } = await supabaseService().rpc("fitbrother_record_ai_usage", {
    p_user_id: userId,
    p_transcription_seconds: delta.transcriptionSeconds ?? 0,
    p_llm_input_tokens: delta.llmInputTokens ?? 0,
    p_llm_output_tokens: delta.llmOutputTokens ?? 0,
    p_llm_cost_cents: delta.llmCostCents ?? 0,
    p_transcription_cost_cents: delta.transcriptionCostCents ?? 0,
  });
  if (error) throw new Error(`record_ai_usage_failed: ${error.message}`);
}
