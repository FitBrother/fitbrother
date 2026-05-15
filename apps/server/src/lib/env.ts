import { cleanEnv, num, port, str } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ["development", "test", "staging", "production"], default: "development" }),
  PORT: port({ default: 3000 }),
  LOG_LEVEL: str({ default: "info" }),

  SUPABASE_URL: str({ default: "" }),
  SUPABASE_ANON_KEY: str({ default: "" }),
  SUPABASE_SERVICE_ROLE_KEY: str({ default: "" }),

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
});
