import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { dispatchPendingPush } from "../services/notifications.js";

export const DISPATCH_QUEUE = "dispatch-notification";

/**
 * Drains the push notification outbox every minute. Producers (the achievements
 * trigger now; alert crons in M5.3) just INSERT rows with sent_at NULL — this
 * poller does the Expo delivery, decoupled from whatever wrote the row.
 *
 * In-app achievement toasts don't wait on this: the app gets them instantly via
 * Realtime on user_achievements. Push covers the backgrounded case.
 */
export async function registerDispatchNotification(
  boss: PgBoss,
  log: FastifyBaseLogger,
): Promise<void> {
  await boss.createQueue(DISPATCH_QUEUE);

  await boss.work(DISPATCH_QUEUE, async () => {
    await dispatchPendingPush(log);
  });

  await boss.schedule(DISPATCH_QUEUE, "* * * * *", undefined, { tz: "UTC" });
  log.info("dispatch_notification_scheduled");
}
