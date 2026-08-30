import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { deleteAuthUserAndAudit, removeUserStorage } from "../lib/account-purge.js";
import { Sentry } from "../lib/sentry.js";
import { supabaseService } from "../lib/supabase.js";

export const PURGE_ACCOUNTS_QUEUE = "purge-accounts";

type AccountDeletionRow = {
  user_id: string;
  scheduled_purge_at: string;
};

export async function runPurgeAccounts(log: FastifyBaseLogger): Promise<void> {
  const admin = supabaseService();
  const { data, error } = await admin
    .from("account_deletions")
    .select("user_id, scheduled_purge_at")
    .lte("scheduled_purge_at", new Date().toISOString())
    .is("cancelled_at", null)
    .is("purged_at", null)
    .limit(100);

  if (error) {
    log.error({ error }, "purge_accounts_lookup_failed");
    throw new Error(error.message);
  }

  let purged = 0;
  for (const row of (data ?? []) as AccountDeletionRow[]) {
    try {
      await purgeAccount(row, log);
      purged++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      await admin
        .from("account_deletions")
        .update({ last_purge_error: message.slice(0, 500) })
        .eq("user_id", row.user_id);
      Sentry.captureException(error, {
        tags: { worker: PURGE_ACCOUNTS_QUEUE },
        extra: { user_id: row.user_id },
      });
    }
  }

  log.info({ purged }, "purge_accounts_done");
}

export async function registerPurgeAccounts(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(PURGE_ACCOUNTS_QUEUE);
  await boss.work(PURGE_ACCOUNTS_QUEUE, async () => runPurgeAccounts(log));
  await boss.schedule(PURGE_ACCOUNTS_QUEUE, "15 3 * * *", undefined, { tz: "UTC" });
  log.info("purge_accounts_scheduled");
}

async function purgeAccount(row: AccountDeletionRow, log: FastifyBaseLogger): Promise<void> {
  const admin = supabaseService();
  const userId = row.user_id;

  await admin
    .from("account_deletions")
    .update({
      last_purge_attempt_at: new Date().toISOString(),
      last_purge_error: null,
    })
    .eq("user_id", userId);
  const { error: attemptsError } = await admin.rpc("fitbrother_increment_purge_attempt", {
    p_user_id: userId,
  });
  if (attemptsError) throw new Error(attemptsError.message);

  log.info(
    { user_id: userId, scheduled_purge_at: row.scheduled_purge_at },
    "purge_account_started",
  );
  await removeUserStorage("meal-audios", userId);
  await removeUserStorage("post-images", userId);

  await deleteAuthUserAndAudit(
    userId,
    "account_purge",
    { scheduled_purge_at: row.scheduled_purge_at },
    log,
  );
}
