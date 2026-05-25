import type { MealExtraction } from "../schemas";

/**
 * Single interface for any meal-extraction LLM (Gemini, OpenAI, ...).
 * Implementations live in sibling files (`gemini.ts`, `openai.ts`) and are
 * selected by the `LLM_PROVIDER` env at boot. The schema returned must match
 * `MealExtractionSchema` exactly — providers normalize their tool-call shape
 * to this contract.
 */
export interface LLMProvider {
  readonly name: "gemini" | "openai";
  extractMeal(input: { text: string; locale: string }): Promise<{
    output: MealExtraction;
    usage: { inputTokens: number; outputTokens: number; costCents: number };
  }>;
}
