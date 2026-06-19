import { createHash } from "node:crypto";
import { INSIGHT_PROMPT_VERSION } from "@fitbrother/shared";
import type { FastifyBaseLogger } from "fastify";
import { supabaseService } from "../lib/supabase.js";
import { getLlmProvider } from "./llm/index.js";
import { recordUsage } from "./ai-usage.js";

type PeriodType = "day" | "week" | "month";
type Target = { user_id: string; period_start: string; payload: unknown };

/** uuid determinístico (user:period:start) → upsert estável entre ticks. */
function deterministicId(userId: string, period: PeriodType, periodStart: string): string {
  const h = createHash("sha256").update(`${userId}:${period}:${periodStart}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Gera insights de um período para todos os alvos elegíveis. Idempotente:
 * computa source_hash do payload agregado + INSIGHT_PROMPT_VERSION; se já existe
 * row com o mesmo hash, pula (não paga IA). Caso contrário chama o LLM, faz
 * upsert e enfileira push insight_ready. Falha de um alvo não derruba os demais.
 */
export async function generateInsightsForPeriod(
  periodType: PeriodType,
  locale: string,
  log: FastifyBaseLogger,
): Promise<{ generated: number; skipped: number }> {
  const svc = supabaseService();
  const { data: targets, error } = await svc.rpc("fitbrother_insight_targets", {
    p_period: periodType,
  });
  if (error) throw new Error(error.message);

  let generated = 0;
  let skipped = 0;

  for (const t of (targets ?? []) as Target[]) {
    const sourceHash = createHash("sha256")
      .update(`${JSON.stringify(t.payload)}\x00${INSIGHT_PROMPT_VERSION}\x00${periodType}`)
      .digest("hex");

    const { data: existing } = await svc
      .from("ai_insights")
      .select("source_hash")
      .eq("user_id", t.user_id)
      .eq("period_type", periodType)
      .eq("period_start", t.period_start)
      .maybeSingle();
    if (existing?.source_hash === sourceHash) {
      skipped++;
      continue;
    }

    let result;
    try {
      result = await getLlmProvider().generateInsight({ periodType, locale, data: t.payload });
    } catch (err) {
      log.error({ err, userId: t.user_id, periodType }, "insight_generate_failed");
      continue; // não grava row parcial; tenta no próximo tick
    }

    const { error: upErr } = await svc.from("ai_insights").upsert(
      {
        id: deterministicId(t.user_id, periodType, t.period_start),
        user_id: t.user_id,
        period_type: periodType,
        period_start: t.period_start,
        payload: result.output,
        source_hash: sourceHash,
      },
      { onConflict: "user_id,period_type,period_start" },
    );
    if (upErr) {
      log.error({ err: upErr, userId: t.user_id }, "insight_upsert_failed");
      continue;
    }

    await recordUsage(t.user_id, {
      llmInputTokens: result.usage.inputTokens,
      llmOutputTokens: result.usage.outputTokens,
      llmCostCents: result.usage.costCents,
    });

    await svc.from("notifications").insert({
      user_id: t.user_id,
      channel: "push",
      kind: "insight_ready",
      template: "insight_ready",
      payload: { period_type: periodType, period_start: t.period_start },
    });
    generated++;
  }

  log.info({ periodType, generated, skipped }, "insights_done");
  return { generated, skipped };
}
