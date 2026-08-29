import * as SentryServerless from "@sentry/aws-serverless";
import { initSentry } from "../../lib/sentry.js";
import { runPurgeAudios } from "../../workers/purge-audios.js";
import { logger } from "../logger.js";

initSentry();

export const handler = SentryServerless.wrapHandler(async () => {
  await runPurgeAudios(logger);
});
