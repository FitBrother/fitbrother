import type { Unit } from "./schemas.js";

export type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

export type FoodPer100g = {
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_grams: number | null;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function quantityInGrams(
  quantity: number,
  unit: Unit,
  servingGrams: number | null,
): number | null {
  switch (unit) {
    case "g":
      return quantity;
    case "ml":
      // density = 1 simplification; callers flag it via density_assumed
      return quantity;
    case "unit":
      if (servingGrams == null) return null;
      return quantity * servingGrams;
    case "slice":
    case "cup":
    case "tbsp":
    case "tsp":
      return null;
  }
}

export function macrosForQuantity(food: FoodPer100g, quantity: number, unit: Unit): Macros | null {
  const grams = quantityInGrams(quantity, unit, food.serving_grams);
  if (grams === null) return null;
  const factor = grams / 100;
  return {
    kcal: round(food.kcal_per_100g * factor),
    protein_g: round(food.protein_per_100g * factor),
    carbs_g: round(food.carbs_per_100g * factor),
    fat_g: round(food.fat_per_100g * factor),
  };
}

export function scaleMacros(anchor: Macros, fromQuantity: number, toQuantity: number): Macros {
  if (fromQuantity <= 0) return anchor;
  const factor = toQuantity / fromQuantity;
  return {
    kcal: round(anchor.kcal * factor),
    protein_g: round(anchor.protein_g * factor),
    carbs_g: round(anchor.carbs_g * factor),
    fat_g: round(anchor.fat_g * factor),
  };
}
