import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { Sentry } from "../lib/sentry.js";
import { supabaseService } from "../lib/supabase.js";

export const METRICS_DAILY_QUEUE = "metrics-daily";

type MetricsJob = { day?: string };

export async function registerMetricsDaily(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(METRICS_DAILY_QUEUE);
  await boss.work<MetricsJob>(METRICS_DAILY_QUEUE, async ([job]) => {
    const day = job?.data.day ?? previousUtcDay();
    const startedAt = Date.now();
    const { data, error } = await supabaseService().rpc("fitbrother_compute_metrics_daily", {
      p_day: day,
    });
    if (error) {
      log.error({ err: error, day }, "metrics_daily_failed");
      Sentry.captureException(new Error(`metrics_daily_failed: ${error.message}`), {
        tags: { worker: METRICS_DAILY_QUEUE, day },
      });
      throw new Error(error.message);
    }
    log.info({ day, rows: data, duration_ms: Date.now() - startedAt }, "metrics_daily_done");
  });
  await boss.schedule(METRICS_DAILY_QUEUE, "0 4 * * *", undefined, { tz: "UTC" });
  log.info({ queue: METRICS_DAILY_QUEUE }, "metrics_daily_scheduled");
}

function previousUtcDay(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10);
}
