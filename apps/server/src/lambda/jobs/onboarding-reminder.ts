import * as SentryServerless from "@sentry/aws-serverless";
import { initSentry } from "../../lib/sentry.js";
import { runOnboardingReminder } from "../../workers/onboarding-reminder.js";
import { logger } from "../logger.js";

initSentry();

export const handler = SentryServerless.wrapHandler(async () => {
  await runOnboardingReminder(logger);
});
