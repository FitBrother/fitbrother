import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from "fastify";
import { env } from "./lib/env.js";
import { Sentry } from "./lib/sentry.js";
import { accountRoutes } from "./routes/account.js";
import { achievementsRoutes } from "./routes/achievements.js";
import { contactsRoutes } from "./routes/contacts.js";
import { healthRoutes } from "./routes/health.js";
import { mealsRoutes } from "./routes/meals.js";
import { meRoutes } from "./routes/me.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { postsRoutes } from "./routes/posts.js";
import { pushTokensRoutes } from "./routes/push-tokens.js";
import { socialRoutes } from "./routes/social.js";
import { supabaseProxyRoute } from "./routes/supabase-proxy.js";
import { usersRoutes } from "./routes/users.js";

/**
 * Monta a instância Fastify com plugins, rotas e error handler — sem chamar
 * `.listen()`. Usado tanto pelo entrypoint local (`server.ts`, que chama
 * `.listen()` em seguida) quanto pelo handler Lambda (`lambda/http.ts`, que
 * entrega a instância pronta pro adapter `@fastify/aws-lambda`).
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "headers.authorization",
          "authorization",
          "access_token",
          "refresh_token",
          "password",
          "req.body.password",
          "authorization_token",
          "challenge_token",
          "phone_e164",
          "email",
          "text",
          "raw_input",
          "payload.text",
        ],
        censor: "[Redacted]",
      },
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
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
  // NOTA (Lambda): esse contador é em memória, por instância. Com várias
  // execuções concorrentes da Lambda, o limite deixa de ser global e passa a
  // valer "por instância quente" — aceitável por ora, revisar se abuso real
  // aparecer (ex.: trocar por um store em DynamoDB).
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (req: FastifyRequest) => req.user?.id ?? req.ip,
  });

  app.addHook("onRequest", async (req) => {
    const scope = Sentry.getIsolationScope();
    scope.setTag("request_id", req.id);
    scope.setTag("route", req.url.split("?")[0] ?? "unknown");
  });

  await app.register(supabaseProxyRoute);
  await app.register(healthRoutes);
  await app.register(accountRoutes);
  await app.register(onboardingRoutes);
  await app.register(meRoutes);
  await app.register(mealsRoutes);
  await app.register(postsRoutes);
  await app.register(achievementsRoutes);
  await app.register(pushTokensRoutes);
  await app.register(contactsRoutes);
  await app.register(socialRoutes);
  await app.register(usersRoutes);

  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err, request_id: req.id, user_id: req.user?.id }, "request_failed");
    if (env.SENTRY_DSN) {
      Sentry.captureException(err, {
        tags: { request_id: req.id },
        extra: { user_id: req.user?.id },
      });
    }
    reply.status(err.statusCode ?? 500).send({ error: err.message });
  });

  return app;
}
