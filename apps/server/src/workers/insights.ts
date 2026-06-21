import type { FastifyBaseLogger } from "fastify";
import type PgBoss from "pg-boss";
import { generateInsightsForPeriod } from "../services/insights.js";

const LOCALE = "pt-BR";
const QUEUES = {
  day: "insights-day",
  week: "insights-week",
  month: "insights-month",
} as const;

/**
 * Crons de geração de insight. A função SQL fitbrother_insight_targets só
 * retorna alvos quando o período está fechado (dia → ontem; semana → quando
 * hoje é segunda; mês → quando hoje é dia 1), e o serviço é idempotente por
 * source_hash, então rodar com folga não duplica nem repaga IA.
 */
export async function registerInsightWorkers(boss: PgBoss, log: FastifyBaseLogger): Promise<void> {
  for (const [period, queue] of Object.entries(QUEUES)) {
    await boss.createQueue(queue);
    await boss.work(queue, async () => {
      await generateInsightsForPeriod(period as "day" | "week" | "month", LOCALE, log);
    });
  }
  await boss.schedule(QUEUES.day, "0 * * * *", undefined, { tz: "UTC" });
  await boss.schedule(QUEUES.week, "30 0 * * *", undefined, { tz: "UTC" });
  await boss.schedule(QUEUES.month, "45 0 * * *", undefined, { tz: "UTC" });
  log.info("insight_workers_scheduled");
}
