import * as SentryServerless from "@sentry/aws-serverless";
import { initSentry } from "../../lib/sentry.js";
import { generateInsightsForPeriod } from "../../services/insights.js";
import { logger } from "../logger.js";

initSentry();

const LOCALE = "pt-BR";

type InsightsEvent = { period: "day" | "week" | "month" };

// Um EventBridge Scheduler diferente por período, cada um passando
// {"period": "day" | "week" | "month"} como input constante da regra.
export const handler = SentryServerless.wrapHandler(async (event: InsightsEvent) => {
  await generateInsightsForPeriod(event.period, LOCALE, logger);
});
