import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fuzzy match a hint or description against the canonical foods catalog.
 *
 * Strategy (PLAN.md §M2.2):
 *   1. Normalize the hint the same way the catalog was seeded (lowercase +
 *      strip diacritics + strip commas). Without this, "Ovo Cozido" misses
 *      "ovo cozido" because the GIN index is on the normalized column.
 *   2. Trigram lookup via the `%` operator (uses foods_name_normalized_trgm
 *      GIN index), filter to verified rows, similarity threshold ≥ 0.6.
 *   3. Tie-break by shorter canonical name — "ovo" beats "ovo de codorna
 *      cozido" when the user just says "ovo".
 *   4. If hint misses and a different `fallback` was provided, retry against
 *      the fallback (typically food_match_hint then description).
 */

// 0.4 lets short user input ("ovo cozido", sim=0.50) hit the longer canonical
// TACO name ("Ovo, de galinha, cozido") while still rejecting plausible noise
// like "macarrão cozido" → "ovo cozido" (sim=0.35). word_similarity would be
// a more principled fit; revisit if false positives surface in dev.
const SIMILARITY_THRESHOLD = 0.4;

export type FoodMatch = {
  id: string;
  name: string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_grams: number | null;
  similarity: number;
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function lookupOnce(client: SupabaseClient, needle: string): Promise<FoodMatch | null> {
  if (!needle) return null;
  const normalized = normalize(needle);
  if (normalized.length < 2) return null;

  // RPC would be cleaner but adds round-trip complexity; PostgREST handles
  // the trigram operator + filter just fine with a stored SQL view OR with
  // .rpc on a SECURITY DEFINER fn. We use a plain SELECT with the operator
  // exposed via PostgREST's `ilike` won't work for trgm, so we lean on a
  // small helper SQL via .rpc — defined inline below as a one-shot.
  //
  // Easiest path that keeps trigram performance: SQL function returning rows.
  const { data, error } = await client.rpc("fitbrother_foods_fuzzy_match", {
    p_needle: normalized,
    p_threshold: SIMILARITY_THRESHOLD,
  });

  if (error) {
    throw new Error(`foods_fuzzy_match_failed: ${error.message}`);
  }
  const rows = (data as FoodMatch[]) ?? [];
  return rows[0] ?? null;
}

export async function matchFood(
  client: SupabaseClient,
  hint: string | undefined,
  fallback: string,
): Promise<FoodMatch | null> {
  const primary = hint?.trim();
  if (primary) {
    const hit = await lookupOnce(client, primary);
    if (hit) return hit;
  }
  return lookupOnce(client, fallback);
}
