/**
 * Bump this to invalidate every entry in the `ai_extractions` cache.
 * The hash key in that table is `sha256(text + LLM_PROMPT_VERSION + locale)`,
 * so any prompt or schema change requires bumping this constant.
 */
export const LLM_PROMPT_VERSION = "v1";
