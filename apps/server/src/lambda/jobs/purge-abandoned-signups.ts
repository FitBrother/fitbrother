import * as SentryServerless from "@sentry/aws-serverless";
import { initSentry } from "../../lib/sentry.js";
import { runPurgeAbandonedSignups } from "../../workers/purge-abandoned-signups.js";
import { logger } from "../logger.js";

initSentry();

export const handler = SentryServerless.wrapHandler(async () => {
  await runPurgeAbandonedSignups(logger);
});
