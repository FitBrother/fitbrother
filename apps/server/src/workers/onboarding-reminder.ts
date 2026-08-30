import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { supabaseService } from "../lib/supabase.js";

export const ONBOARDING_REMINDER_QUEUE = "onboarding-reminder";

/**
 * Cron horário; a função SQL fitbrother_onboarding_reminder() escolhe quem
 * já virou conta real (e-mail+senha aplicados) mas não completou o
 * onboarding há mais de 24h e ainda não recebeu lembrete, e insere
 * notifications(channel='email'). O worker dispatch-notification (já
 * existente) faz o envio de verdade via Resend.
 */
export async function runOnboardingReminder(log: FastifyBaseLogger): Promise<void> {
  const { data, error } = await supabaseService().rpc("fitbrother_onboarding_reminder");
  if (error) {
    log.error({ error }, "onboarding_reminder_failed");
    throw new Error(error.message);
  }
  log.info({ queued: data }, "onboarding_reminder_done");
}

export async function registerOnboardingReminder(
  boss: PgBoss,
  log: FastifyBaseLogger,
): Promise<void> {
  await boss.createQueue(ONBOARDING_REMINDER_QUEUE);
  await boss.work(ONBOARDING_REMINDER_QUEUE, async () => runOnboardingReminder(log));
  await boss.schedule(ONBOARDING_REMINDER_QUEUE, "0 * * * *", undefined, { tz: "UTC" });
  log.info("onboarding_reminder_scheduled");
}
