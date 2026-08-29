import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { supabaseService } from "../lib/supabase.js";

export const STREAK_TICK_QUEUE = "streak-tick";

/**
 * Hourly streak evaluation.
 *
 * The cron fires once an hour (UTC). The SQL function fitbrother_streak_tick()
 * (migration 0025) picks the users whose nutritional day just started in their
 * OWN timezone+day_start_hour and recomputes their streak from daily_summaries.
 *
 * All the logic lives in SQL so it's deterministic and testable via
 * `supabase db reset`; this worker is only the scheduler + invoker.
 */
/** Lógica pura, reutilizada pelo worker local (pg-boss) e pelo handler Lambda. */
export async function runStreakTick(log: FastifyBaseLogger): Promise<void> {
  const { data, error } = await supabaseService().rpc("fitbrother_streak_tick");
  if (error) {
    log.error({ error }, "streak_tick_failed");
    throw new Error(error.message);
  }
  log.info({ evaluated: data }, "streak_tick_done");
}

export async function registerStreakTick(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(STREAK_TICK_QUEUE);

  await boss.work(STREAK_TICK_QUEUE, async () => runStreakTick(log));

  // Top of every hour, UTC. The per-user day boundary is handled in SQL, so a
  // single UTC schedule covers every timezone — each user is only touched in
  // the hour their own day flips.
  await boss.schedule(STREAK_TICK_QUEUE, "0 * * * *", undefined, { tz: "UTC" });
  log.info("streak_tick_scheduled");
}
