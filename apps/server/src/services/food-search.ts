import type { SupabaseClient } from "@supabase/supabase-js";
import { FoodSuggestionSchema, type FoodSuggestion } from "@fitbrother/shared";

const SUGGESTION_LIMIT = 8;

export function normalizeFoodQuery(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchFoods(
  client: SupabaseClient,
  rawQuery: string,
  limit: number = SUGGESTION_LIMIT,
): Promise<FoodSuggestion[]> {
  const { data, error } = await client.rpc("fitbrother_foods_autocomplete", {
    p_query: normalizeFoodQuery(rawQuery),
    p_limit: limit,
  });
  if (error) {
    throw new Error(`foods_autocomplete_failed: ${error.message}`);
  }
  return ((data as unknown[] | null) ?? []).map((row) => FoodSuggestionSchema.parse(row));
}
