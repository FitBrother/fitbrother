import { config as loadDotenv } from "dotenv";
import { cleanEnv, num, port, str } from "envalid";

// The repo root .env / .envrc may export keys pointing at a remote Supabase
// project. In dev we want apps/server/.env to win so local services hit the
// local Supabase stack.
if (process.env.NODE_ENV !== "production") {
  loadDotenv({ path: ".env", override: true });
}

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "staging", "production"],
    default: "development",
  }),
  PORT: port({ default: 3000 }),
  LOG_LEVEL: str({ default: "info" }),

  SUPABASE_URL: str({ default: "" }),
  SUPABASE_ANON_KEY: str({ default: "" }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: "" }),

  // Origens do PWA web que podem chamar a API via CORS (separadas por
  // vírgula). Vazio em prod = nenhuma origem liberada (CORS continua
  // desligado por padrão, só passa a valer se isso for setado).
  CORS_ORIGIN: str({ default: "" }),

  // Direct Postgres connection for pg-boss (background jobs). Defaults to the
  // local Supabase DB so dev works out of the box; prod must override.
  DATABASE_URL: str({
    default: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  }),

  WHATSAPP_APP_SECRET: str({ default: "" }),
  WHATSAPP_VERIFY_TOKEN: str({ default: "" }),
  WHATSAPP_PHONE_NUMBER_ID: str({ default: "" }),
  WHATSAPP_ACCESS_TOKEN: str({ default: "" }),

  OPENAI_API_KEY: str({ default: "" }),
  GEMINI_API_KEY: str({ default: "" }),
  LLM_PROVIDER: str({ choices: ["gemini", "openai"], default: "gemini" }),
  LLM_PROMPT_VERSION: str({ default: "v1" }),

  AI_CAP_TRANSCRIPTION_SECONDS: num({ default: 600 }),
  AI_CAP_LLM_TOKENS: num({ default: 50_000 }),
  AI_CAP_COST_CENTS: num({ default: 200 }),

  SENTRY_DSN: str({ default: "" }),

  // Lembrete de cadastro abandonado (M17) — Resend.
  RESEND_API_KEY: str({ default: "" }),
  EMAIL_FROM: str({ default: "Fitbrother <onboarding@fitbrother.app>" }),
  APP_URL: str({ default: "https://www.fitbrother.app" }),
});
