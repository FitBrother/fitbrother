import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { supabaseService } from "../lib/supabase.js";

export const STREAK_ALERT_QUEUE = "streak-alert";

/**
 * Alerta de risco de streak. Cron horário UTC; a função SQL
 * fitbrother_streak_alert() escolhe quem está às 21h LOCAIS, com streak vivo e
 * sem goal_hit hoje, e insere notifications(channel='push'). O worker
 * dispatch-notification faz o envio.
 */
export async function registerStreakAlert(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(STREAK_ALERT_QUEUE);
  await boss.work(STREAK_ALERT_QUEUE, async () => {
    const { data, error } = await supabaseService().rpc("fitbrother_streak_alert");
    if (error) {
      log.error({ error }, "streak_alert_failed");
      throw new Error(error.message);
    }
    log.info({ queued: data }, "streak_alert_done");
  });
  await boss.schedule(STREAK_ALERT_QUEUE, "0 * * * *", undefined, { tz: "UTC" });
  log.info("streak_alert_scheduled");
}
