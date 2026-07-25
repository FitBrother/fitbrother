import type { MealExtraction, InsightContent } from "../schemas.js";

/**
 * Single interface for any LLM (Gemini, OpenAI, ...). Implementations live in
 * sibling files (`gemini.ts`, `openai.ts`) and are selected by the
 * `LLM_PROVIDER` env at boot. Outputs must match the canonical zod schemas —
 * providers normalize their tool-call shape to these contracts.
 */
export interface LLMProvider {
  readonly name: "gemini" | "openai";
  extractMeal(input: { text: string; locale: string }): Promise<{
    output: MealExtraction;
    usage: { inputTokens: number; outputTokens: number; costCents: number };
  }>;
  generateInsight(input: {
    periodType: "day" | "week" | "month";
    locale: string;
    data: unknown;
  }): Promise<{
    output: InsightContent;
    usage: { inputTokens: number; outputTokens: number; costCents: number };
  }>;
}
