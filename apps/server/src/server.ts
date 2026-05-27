import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyError, type FastifyRequest } from "fastify";
import { env } from "./lib/env.js";
import { startJobs, stopJobs } from "./lib/jobs.js";
import { initSentry, Sentry } from "./lib/sentry.js";
import { healthRoutes } from "./routes/health.js";
import { mealsRoutes } from "./routes/meals.js";
import { meRoutes } from "./routes/me.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { supabaseProxyRoute } from "./routes/supabase-proxy.js";
import { registerStreakTick } from "./workers/streak-tick.js";

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

// Rate limit: 30 req/min per authenticated user (falls back to IP for
// pre-auth routes — sign-in / sign-up are handled by Supabase directly,
// not this server, so the IP fallback only matters for /health probes).
// AI_QUOTA_EXCEEDED is the per-day cost gate; this is the per-minute
// abuse gate.
// 120 req/min/user. Sessões com Realtime + dashboard fazem facilmente 20-30
// reads pacíficos em poucos segundos (cada mutation invalida 3-4 queries),
// então um limite agressivo demais derruba ações legítimas. 2 req/s ainda
// rejeita spam de scripts.
await app.register(rateLimit, {
  max: 120,
  timeWindow: "1 minute",
  keyGenerator: (req: FastifyRequest) => req.user?.id ?? req.ip,
});

await app.register(supabaseProxyRoute);
await app.register(healthRoutes);
await app.register(onboardingRoutes);
await app.register(meRoutes);
await app.register(mealsRoutes);

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

// Background jobs start after the API is listening — they're additive and must
// never block (or crash) the HTTP server.
const boss = await startJobs(app.log);
if (boss) {
  await registerStreakTick(boss, app.log);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, "shutting_down");
    await stopJobs();
    await app.close();
    process.exit(0);
  });
}
