import type { FastifyBaseLogger } from "fastify";
import PgBoss from "pg-boss";
import { env } from "./env.js";

let _boss: PgBoss | null = null;

/**
 * Start the pg-boss job runner — a Postgres-backed queue + cron scheduler that
 * underpins all M5 background work (streaks, achievements, notifications).
 *
 * pg-boss keeps its bookkeeping in a dedicated `pgboss` schema, so it never
 * touches our migration-managed `public` tables.
 *
 * Returns null (and logs) if it can't start: background jobs are additive, so
 * a missing/unreachable DATABASE_URL must not block the API from serving.
 */
export async function startJobs(log: FastifyBaseLogger): Promise<PgBoss | null> {
  if (_boss) return _boss;
  try {
    const boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: "pgboss",
    });
    boss.on("error", (err) => log.error({ err }, "pgboss_error"));
    await boss.start();
    _boss = boss;
    log.info("pgboss_started");
    return boss;
  } catch (err) {
    log.error({ err }, "pgboss_start_failed");
    return null;
  }
}

export async function stopJobs(): Promise<void> {
  if (_boss) {
    await _boss.stop();
    _boss = null;
  }
}
