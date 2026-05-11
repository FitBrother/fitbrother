import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { env } from "./lib/env.js";
import { initSentry, Sentry } from "./lib/sentry.js";
import { healthRoutes } from "./routes/health.js";

initSentry();

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

await app.register(sensible);
await app.register(healthRoutes);

app.setErrorHandler((err, _req, reply) => {
  app.log.error({ err }, "request_failed");
  if (env.SENTRY_DSN) Sentry.captureException(err);
  reply.status(err.statusCode ?? 500).send({ error: err.message });
});

const port = env.PORT;
try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`firefit-server listening on :${port}`);
} catch (err) {
  app.log.error({ err }, "boot_failed");
  process.exit(1);
}
