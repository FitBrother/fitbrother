import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { deleteAuthUserAndAudit, removeUserStorage } from "../lib/account-purge.js";
import { Sentry } from "../lib/sentry.js";
import { supabaseService } from "../lib/supabase.js";

export const PURGE_ABANDONED_SIGNUPS_QUEUE = "purge-abandoned-signups";

/**
 * Cadastros que viraram conta real (e-mail+senha aplicados) mas nunca
 * terminaram o onboarding, parados há ~14 dias — mesmo critério de
 * fitbrother_onboarding_reminder(), só que numa janela mais longa. O
 * lembrete (fitbrother_onboarding_reminder, cron horário) já teve chance de
 * trazer a pessoa de volta bem antes desse prazo.
 */
export async function runPurgeAbandonedSignups(log: FastifyBaseLogger): Promise<void> {
  const admin = supabaseService();
  const { data, error } = await admin.rpc("fitbrother_abandoned_signups");
  if (error) {
    log.error({ error }, "purge_abandoned_signups_lookup_failed");
    throw new Error(error.message);
  }

  let purged = 0;
  for (const row of (data ?? []) as { user_id: string }[]) {
    try {
      await purgeAbandonedSignup(row.user_id, log);
      purged++;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { worker: PURGE_ABANDONED_SIGNUPS_QUEUE },
        extra: { user_id: row.user_id },
      });
    }
  }

  log.info({ purged }, "purge_abandoned_signups_done");
}

export async function registerPurgeAbandonedSignups(
  boss: PgBoss,
  log: FastifyBaseLogger,
): Promise<void> {
  await boss.createQueue(PURGE_ABANDONED_SIGNUPS_QUEUE);
  await boss.work(PURGE_ABANDONED_SIGNUPS_QUEUE, async () => runPurgeAbandonedSignups(log));
  await boss.schedule(PURGE_ABANDONED_SIGNUPS_QUEUE, "45 3 * * *", undefined, { tz: "UTC" });
  log.info("purge_abandoned_signups_scheduled");
}

async function purgeAbandonedSignup(userId: string, log: FastifyBaseLogger): Promise<void> {
  log.info({ user_id: userId }, "purge_abandoned_signup_started");
  await removeUserStorage("meal-audios", userId);
  await removeUserStorage("post-images", userId);
  await deleteAuthUserAndAudit(
    userId,
    "abandoned_signup_purge",
    { reason: "onboarding_incomplete" },
    log,
  );
}
