import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { supabaseService } from "../lib/supabase.js";

export const PURGE_ACCOUNTS_QUEUE = "purge-accounts";

type AccountDeletionRow = {
  user_id: string;
  scheduled_purge_at: string;
};

export async function registerPurgeAccounts(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(PURGE_ACCOUNTS_QUEUE);

  await boss.work(PURGE_ACCOUNTS_QUEUE, async () => {
    const admin = supabaseService();
    const { data, error } = await admin
      .from("account_deletions")
      .select("user_id, scheduled_purge_at")
      .lte("scheduled_purge_at", new Date().toISOString())
      .is("purged_at", null)
      .limit(100);

    if (error) {
      log.error({ error }, "purge_accounts_lookup_failed");
      throw new Error(error.message);
    }

    let purged = 0;
    for (const row of (data ?? []) as AccountDeletionRow[]) {
      await purgeAccount(row, log);
      purged++;
    }

    log.info({ purged }, "purge_accounts_done");
  });

  await boss.schedule(PURGE_ACCOUNTS_QUEUE, "15 3 * * *", undefined, { tz: "UTC" });
  log.info("purge_accounts_scheduled");
}

async function purgeAccount(row: AccountDeletionRow, log: FastifyBaseLogger): Promise<void> {
  const admin = supabaseService();
  const userId = row.user_id;

  log.info(
    { user_id: userId, scheduled_purge_at: row.scheduled_purge_at },
    "purge_account_started",
  );
  await removeUserStorage("meal-audios", userId);
  await removeUserStorage("post-images", userId);

  await admin.from("account_audit_log").insert({
    user_id: userId,
    action: "account_purge",
    status: "started",
    metadata: { scheduled_purge_at: row.scheduled_purge_at },
  });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    await admin.from("account_audit_log").insert({
      user_id: userId,
      action: "account_purge",
      status: "failed",
      metadata: { error: error.message },
    });
    log.error({ err: error, user_id: userId }, "purge_account_delete_user_failed");
    throw new Error(error.message);
  }

  log.info({ user_id: userId }, "purge_account_done");
}

async function removeUserStorage(bucket: string, userId: string): Promise<void> {
  const storage = supabaseService().storage.from(bucket);
  const { data, error } = await storage.list(userId, { limit: 1000 });
  if (error) throw new Error(`${bucket}: ${error.message}`);
  const paths = (data ?? []).map((object) => `${userId}/${object.name}`);
  if (paths.length === 0) return;
  const { error: removeError } = await storage.remove(paths);
  if (removeError) throw new Error(`${bucket}: ${removeError.message}`);
}
