import type { FastifyBaseLogger, FastifyRequest } from "fastify";
import { Sentry } from "../lib/sentry.js";
import { supabaseService } from "../lib/supabase.js";

export type PipelineSource = "text" | "audio" | "photo" | "barcode" | "system";
export type PipelineStage = "transcription" | "extraction" | "catalog" | "persistence" | "total";

export type PipelineEvent = {
  requestId: string;
  mealId?: string;
  source: PipelineSource;
  stage: PipelineStage;
  provider?: string;
  model?: string;
  durationMs: number;
  success: boolean;
  cacheHit?: boolean;
  confidence?: number;
  errorCode?: string;
};

export async function recordPipelineEvent(
  event: PipelineEvent,
  log: FastifyBaseLogger,
): Promise<void> {
  const row = {
    request_id: event.requestId,
    meal_id: event.mealId ?? null,
    source: event.source,
    stage: event.stage,
    provider: event.provider ?? "none",
    model: event.model ?? "none",
    duration_ms: Math.max(0, Math.round(event.durationMs)),
    success: event.success,
    cache_hit: event.cacheHit ?? null,
    confidence: event.confidence ?? null,
    error_code: event.errorCode ?? null,
  };
  const { error } = await supabaseService().from("pipeline_events").insert(row);
  if (error) {
    log.warn(
      {
        err: error,
        request_id: event.requestId,
        meal_id: event.mealId,
        source: event.source,
        stage: event.stage,
      },
      "pipeline_event_write_failed",
    );
  }
}

export function elapsedMs(startedAt: number): number {
  return Number(process.hrtime.bigint() - BigInt(startedAt)) / 1_000_000;
}

export function startTimer(): number {
  return Number(process.hrtime.bigint());
}

export async function runPipelineStage<T>(
  req: FastifyRequest,
  event: Omit<PipelineEvent, "requestId" | "durationMs" | "success">,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = startTimer();
  Sentry.addBreadcrumb({
    category: "meal_pipeline",
    message: `${event.source}.${event.stage}.started`,
    data: { meal_id: event.mealId },
  });
  try {
    const result = await operation();
    const durationMs = elapsedMs(startedAt);
    req.log.info(
      {
        request_id: req.id,
        user_id: req.user?.id,
        meal_id: event.mealId,
        source: event.source,
        stage: event.stage,
        provider: event.provider,
        model: event.model,
        duration_ms: Math.round(durationMs),
        success: true,
      },
      "pipeline_stage",
    );
    await recordPipelineEvent({ ...event, requestId: req.id, durationMs, success: true }, req.log);
    Sentry.addBreadcrumb({
      category: "meal_pipeline",
      message: `${event.source}.${event.stage}.completed`,
      data: { duration_ms: Math.round(durationMs), meal_id: event.mealId },
    });
    return result;
  } catch (error) {
    const durationMs = elapsedMs(startedAt);
    const errorCode = error instanceof Error ? error.message.split(":")[0] : "unknown_error";
    req.log.error(
      {
        err: error,
        request_id: req.id,
        user_id: req.user?.id,
        meal_id: event.mealId,
        source: event.source,
        stage: event.stage,
        provider: event.provider,
        model: event.model,
        duration_ms: Math.round(durationMs),
        success: false,
        error_code: errorCode,
      },
      "pipeline_stage_failed",
    );
    await recordPipelineEvent(
      { ...event, requestId: req.id, durationMs, success: false, errorCode },
      req.log,
    );
    Sentry.captureException(error, {
      tags: {
        request_id: req.id,
        source: event.source,
        stage: event.stage,
      },
      extra: { user_id: req.user?.id, meal_id: event.mealId },
    });
    throw error;
  }
}

export async function recordPipelineStageResult(
  req: FastifyRequest,
  event: Omit<PipelineEvent, "requestId" | "durationMs" | "success">,
  startedAt: number,
  error: { message?: string } | null,
): Promise<void> {
  const durationMs = elapsedMs(startedAt);
  const success = error == null;
  const errorCode = error?.message?.split(":")[0];
  req.log[success ? "info" : "error"](
    {
      ...(error ? { err: error } : {}),
      request_id: req.id,
      user_id: req.user?.id,
      meal_id: event.mealId,
      source: event.source,
      stage: event.stage,
      duration_ms: Math.round(durationMs),
      success,
      error_code: errorCode,
    },
    success ? "pipeline_stage" : "pipeline_stage_failed",
  );
  await recordPipelineEvent(
    {
      ...event,
      requestId: req.id,
      durationMs,
      success,
      errorCode,
    },
    req.log,
  );
}
