import * as SentryServerless from "@sentry/aws-serverless";
import { initSentry } from "../../lib/sentry.js";
import { dispatchPendingPush } from "../../services/notifications.js";
import { logger } from "../logger.js";

initSentry();

export const handler = SentryServerless.wrapHandler(async () => {
  await dispatchPendingPush(logger);
});
