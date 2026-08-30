import { buildApp } from "./app.js";
import { env } from "./lib/env.js";
import { startJobs, stopJobs } from "./lib/jobs.js";
import { initSentry } from "./lib/sentry.js";
import { registerDispatchNotification } from "./workers/dispatch-notification.js";
import { registerGoalReminder } from "./workers/goal-reminder.js";
import { registerOnboardingReminder } from "./workers/onboarding-reminder.js";
import { registerStreakAlert } from "./workers/streak-alert.js";
import { registerStreakTick } from "./workers/streak-tick.js";
import { registerInsightWorkers } from "./workers/insights.js";
import { registerPurgeAbandonedSignups } from "./workers/purge-abandoned-signups.js";
import { registerPurgeAccounts } from "./workers/purge-accounts.js";
import { registerPurgeAudios } from "./workers/purge-audios.js";
import { registerMetricsDaily } from "./workers/metrics-daily.js";

initSentry();

const app = await buildApp();

const port = env.PORT;
try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`fitbrother-server listening on :${port}`);
} catch (err) {
  app.log.error({ err }, "boot_failed");
  process.exit(1);
}

// Background jobs start after the API is listening — they're additive and must
// never block (or crash) the HTTP server. Local/dev-only: production runs
// these as separate scheduled Lambda functions (see src/lambda/jobs/).
const boss = await startJobs(app.log);
if (boss) {
  await registerStreakTick(boss, app.log);
  await registerDispatchNotification(boss, app.log);
  await registerStreakAlert(boss, app.log);
  await registerGoalReminder(boss, app.log);
  await registerInsightWorkers(boss, app.log);
  await registerPurgeAccounts(boss, app.log);
  await registerPurgeAudios(boss, app.log);
  await registerMetricsDaily(boss, app.log);
  await registerOnboardingReminder(boss, app.log);
  await registerPurgeAbandonedSignups(boss, app.log);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, "shutting_down");
    await stopJobs();
    await app.close();
    process.exit(0);
  });
}
