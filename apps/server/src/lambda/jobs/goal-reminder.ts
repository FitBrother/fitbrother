import * as SentryServerless from "@sentry/aws-serverless";
import { initSentry } from "../../lib/sentry.js";
import { runGoalReminder } from "../../workers/goal-reminder.js";
import { logger } from "../logger.js";

initSentry();

export const handler = SentryServerless.wrapHandler(async () => {
  await runGoalReminder(logger);
});
