import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { Sentry } from "../lib/sentry.js";
import { supabaseService } from "../lib/supabase.js";

export const METRICS_DAILY_QUEUE = "metrics-daily";

type MetricsJob = { day?: string };

export async function runMetricsDaily(log: FastifyBaseLogger, day?: string): Promise<void> {
  const resolvedDay = day ?? previousUtcDay();
  const startedAt = Date.now();
  const { data, error } = await supabaseService().rpc("fitbrother_compute_metrics_daily", {
    p_day: resolvedDay,
  });
  if (error) {
    log.error({ err: error, day: resolvedDay }, "metrics_daily_failed");
    Sentry.captureException(new Error(`metrics_daily_failed: ${error.message}`), {
      tags: { worker: METRICS_DAILY_QUEUE, day: resolvedDay },
    });
    throw new Error(error.message);
  }
  log.info(
    { day: resolvedDay, rows: data, duration_ms: Date.now() - startedAt },
    "metrics_daily_done",
  );
}

export async function registerMetricsDaily(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(METRICS_DAILY_QUEUE);
  await boss.work<MetricsJob>(METRICS_DAILY_QUEUE, async ([job]) => {
    await runMetricsDaily(log, job?.data.day);
  });
  await boss.schedule(METRICS_DAILY_QUEUE, "0 4 * * *", undefined, { tz: "UTC" });
  log.info({ queue: METRICS_DAILY_QUEUE }, "metrics_daily_scheduled");
}

function previousUtcDay(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10);
}
