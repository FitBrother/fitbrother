/**
 * Bump this to invalidate every entry in the `ai_extractions` cache.
 * The hash key in that table is `sha256(text + LLM_PROMPT_VERSION + locale)`,
 * so any prompt or schema change requires bumping this constant.
 */
// v2 (M8.1): extração passa a retornar `feedback` (frase curta da IA).
export const LLM_PROMPT_VERSION = "v2";
