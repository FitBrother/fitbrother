import type { Macros, MealResponse } from "@fitbrother/shared";

const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + it.kcal,
      protein_g: acc.protein_g + it.protein_g,
      carbs_g: acc.carbs_g + it.carbs_g,
      fat_g: acc.fat_g + it.fat_g,
    }),
    ZERO,
  );
}

export function draftSignature(m: MealResponse): string {
  return JSON.stringify([
    m.meal_type,
    m.consumed_at,
    m.items.map((it) => [
      it.id,
      it.food_id,
      it.description,
      it.quantity,
      it.unit,
      it.kcal,
      it.protein_g,
      it.carbs_g,
      it.fat_g,
    ]),
  ]);
}

export function sameMinute(a: string, b: string): boolean {
  return Math.floor(new Date(a).getTime() / 60000) === Math.floor(new Date(b).getTime() / 60000);
}
