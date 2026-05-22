import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealItemExtraction, MealExtraction } from "@fitbrother/shared";
import { matchFood, type FoodMatch } from "./foods.js";

/**
 * Apply the canonical foods catalog over LLM-extracted items.
 *
 * Strategy
 * ────────
 * Each extracted item is matched against the foods catalog by hint or
 * description. On hit, we OVERWRITE the LLM's macros with proportional
 * values from the catalog — TACO/USDA is more accurate than any model
 * guess. On miss, we keep the LLM macros and food_id stays null.
 *
 * Unit conversion
 * ───────────────
 *   g          → quantity grams.
 *   ml         → quantity grams, density=1 assumption (water/coffee/milk/
 *                juice ≈ 1.0; oil ≈ 0.92, honey ≈ 1.4 — flagged via
 *                density_assumed=true for future curation).
 *   unit       → quantity × food.serving_grams (e.g. 2 ovos × 50g = 100g).
 *                Missing serving_grams falls back to LLM macros.
 *   slice/cup/tbsp/tsp → catalog doesn't model these reliably; we trust
 *                the LLM here. Implementation note: these units fall
 *                through `applyCatalogToItem` returning the original item.
 */

export type ApplyCatalogResult = {
  applied: AppliedMealItem[];
  matched_count: number;
};

export type AppliedMealItem = MealItemExtraction & {
  food_id: string | null;
  density_assumed: boolean;
};

export async function applyCatalogToItems(
  client: SupabaseClient,
  extraction: MealExtraction,
): Promise<ApplyCatalogResult> {
  const applied: AppliedMealItem[] = [];
  let matched = 0;

  for (const item of extraction.items) {
    const result = await applyCatalogToItem(client, item);
    if (result.food_id) matched++;
    applied.push(result);
  }

  return { applied, matched_count: matched };
}

async function applyCatalogToItem(
  client: SupabaseClient,
  item: MealItemExtraction,
): Promise<AppliedMealItem> {
  const food = await matchFood(client, item.food_match_hint, item.description);
  if (!food) {
    return { ...item, food_id: null, density_assumed: false };
  }

  const grams = quantityInGrams(item, food);
  if (grams === null) {
    // Catalog matched but we can't safely convert this unit; keep LLM
    // macros but still tag the food_id for analytics.
    return { ...item, food_id: food.id, density_assumed: false };
  }

  const factor = grams / 100;
  return {
    ...item,
    food_id: food.id,
    density_assumed: item.unit === "ml",
    kcal: round(food.kcal_per_100g * factor),
    protein_g: round(food.protein_per_100g * factor),
    carbs_g: round(food.carbs_per_100g * factor),
    fat_g: round(food.fat_per_100g * factor),
  };
}

function quantityInGrams(item: MealItemExtraction, food: FoodMatch): number | null {
  switch (item.unit) {
    case "g":
      return item.quantity;
    case "ml":
      // density = 1 (CLAUDE.md M2.2 simplification — flagged via density_assumed).
      return item.quantity;
    case "unit":
      if (food.serving_grams == null) return null;
      return item.quantity * food.serving_grams;
    case "slice":
    case "cup":
    case "tbsp":
    case "tsp":
      return null;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
