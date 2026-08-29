import pino from "pino";
import { env } from "../lib/env.js";

/**
 * Logger standalone (sem instância Fastify) pros handlers Lambda de job —
 * mesma interface (`.info`/`.error`/...) que os workers já esperam
 * (`FastifyBaseLogger`), só que utilizável fora de uma request HTTP.
 */
export const logger = pino({ level: env.LOG_LEVEL });
