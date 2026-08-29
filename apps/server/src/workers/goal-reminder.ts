import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { supabaseService } from "../lib/supabase.js";

export const GOAL_REMINDER_QUEUE = "goal-reminder";

/**
 * Lembrete de meta (19h locais, kcal < 70%, janela WA aberta). Insere
 * notifications(channel='wa') → DORMENTE enquanto o dispatch ignora WA (M4
 * pausado). Mantido pronto pra quando o WhatsApp voltar.
 */
export async function runGoalReminder(log: FastifyBaseLogger): Promise<void> {
  const { data, error } = await supabaseService().rpc("fitbrother_goal_reminder");
  if (error) {
    log.error({ error }, "goal_reminder_failed");
    throw new Error(error.message);
  }
  log.info({ queued: data }, "goal_reminder_done");
}

export async function registerGoalReminder(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(GOAL_REMINDER_QUEUE);
  await boss.work(GOAL_REMINDER_QUEUE, async () => runGoalReminder(log));
  await boss.schedule(GOAL_REMINDER_QUEUE, "0 * * * *", undefined, { tz: "UTC" });
  log.info("goal_reminder_scheduled");
}
