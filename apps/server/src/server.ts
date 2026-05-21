import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyError } from "fastify";
import { env } from "./lib/env.js";
import { initSentry, Sentry } from "./lib/sentry.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { onboardingRoutes } from "./routes/onboarding.js";

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
// Web/Expo Go bundles served from a different origin (e.g. localhost:8081 →
// localhost:3000) need CORS. In dev we mirror the request origin; lock this
// down to specific origins before shipping.
await app.register(cors, {
  origin: env.NODE_ENV === "production" ? false : true,
  credentials: true,
});
await app.register(healthRoutes);
await app.register(onboardingRoutes);
await app.register(meRoutes);

app.setErrorHandler((err: FastifyError, _req, reply) => {
  app.log.error({ err }, "request_failed");
  if (env.SENTRY_DSN) Sentry.captureException(err);
  reply.status(err.statusCode ?? 500).send({ error: err.message });
});

const port = env.PORT;
try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`fitbrother-server listening on :${port}`);
} catch (err) {
  app.log.error({ err }, "boot_failed");
  process.exit(1);
}
