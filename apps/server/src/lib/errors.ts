import type { FastifyBaseLogger, FastifyReply } from "fastify";
import { env } from "./env.js";
import { Sentry } from "./sentry.js";

/**
 * Resposta padrão pra qualquer erro interno inesperado (falha de banco,
 * storage, etc.) — nunca expõe `error.message` pro cliente: pode vazar nome
 * de tabela/coluna/constraint do Postgres ou detalhe de implementação. O
 * texto amigável fica do lado do cliente (mapeado a partir do código estável
 * "internal_error"); o detalhe real vai só pro log + Sentry.
 */
export function internalError(
  reply: FastifyReply,
  log: FastifyBaseLogger,
  err: unknown,
  context?: Record<string, unknown>,
): FastifyReply {
  log.error({ err, ...context }, "internal_error");
  if (env.SENTRY_DSN) {
    Sentry.captureException(err, { extra: context });
  }
  return reply.code(500).send({ error: "internal_error" });
}
