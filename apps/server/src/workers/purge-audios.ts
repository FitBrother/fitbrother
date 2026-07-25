import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { Sentry } from "../lib/sentry.js";
import { supabaseService } from "../lib/supabase.js";

export const PURGE_AUDIOS_QUEUE = "purge-audios";

type MealAudioRow = {
  id: string;
  user_id: string;
  audio_path: string;
  created_at: string;
};

export async function registerPurgeAudios(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(PURGE_AUDIOS_QUEUE);

  await boss.work(PURGE_AUDIOS_QUEUE, async () => {
    const admin = supabaseService();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("meals")
      .select("id, user_id, audio_path, created_at")
      .not("audio_path", "is", null)
      .is("audio_deleted_at", null)
      .lt("created_at", cutoff)
      .limit(500);

    if (error) {
      log.error({ error }, "purge_audios_lookup_failed");
      throw new Error(error.message);
    }

    const rows = (data ?? []) as MealAudioRow[];
    if (rows.length === 0) {
      log.info({ purged: 0 }, "purge_audios_done");
      return;
    }

    const paths = rows.map((row) => row.audio_path);
    const { error: removeError } = await admin.storage.from("meal-audios").remove(paths);
    if (removeError) {
      log.error({ err: removeError, count: paths.length }, "purge_audios_storage_failed");
      Sentry.captureException(new Error(`purge_audios_storage_failed: ${removeError.message}`), {
        tags: { worker: PURGE_AUDIOS_QUEUE },
      });
      throw new Error(removeError.message);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("meals")
      .update({ audio_deleted_at: now })
      .in(
        "id",
        rows.map((row) => row.id),
      );
    if (updateError) {
      log.error({ err: updateError }, "purge_audios_mark_failed");
      Sentry.captureException(new Error(`purge_audios_mark_failed: ${updateError.message}`), {
        tags: { worker: PURGE_AUDIOS_QUEUE },
      });
      throw new Error(updateError.message);
    }

    log.info({ purged: rows.length, cutoff }, "purge_audios_done");
  });

  await boss.schedule(PURGE_AUDIOS_QUEUE, "30 3 * * *", undefined, { tz: "UTC" });
  log.info("purge_audios_scheduled");
}
