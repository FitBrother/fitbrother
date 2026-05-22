import type { LLMProvider } from "@fitbrother/shared";
import { env } from "../../lib/env.js";
import { geminiProvider } from "./gemini.js";

/**
 * Single source of truth for which LLM the meal extraction uses.
 * Add `openai.ts` and another case here when we ship the v2 provider swap.
 */
export function getLlmProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case "gemini":
      return geminiProvider;
    case "openai":
      throw new Error("openai provider not implemented yet (see services/llm/openai.ts)");
    default:
      throw new Error(`unknown LLM_PROVIDER: ${env.LLM_PROVIDER}`);
  }
}
