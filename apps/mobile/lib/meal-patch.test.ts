import { describe, expect, test } from "@jest/globals";
import type { ItemDraft } from "@/lib/meal-item-draft";
import { buildMealPatch, invalidItemIndexes } from "@/lib/meal-patch";

const draft: ItemDraft = {
  id: "22222222-2222-4222-8222-222222222222",
  description: "  Arroz  ",
  quantity: 100,
  unit: "g",
  kcal: 128,
  protein_g: 2.5,
  carbs_g: 28,
  fat_g: 0.2,
  food_id: null,
  link: { mode: "none" },
  adjusted: false,
};

describe("buildMealPatch", () => {
  test("is empty when nothing changed", () => {
    expect(buildMealPatch({})).toEqual({});
  });

  test("sends only confirm when nothing else changed", () => {
    expect(buildMealPatch({ confirm: true })).toEqual({ confirm: true });
  });

  test("trims item descriptions and keeps the changed meta", () => {
    const iso = new Date(2026, 10, 24, 20, 0).toISOString();
    const patch = buildMealPatch({
      items: [draft],
      mealType: "dinner",
      consumedAt: iso,
      confirm: true,
    });
    expect(patch).toMatchObject({ meal_type: "dinner", consumed_at: iso, confirm: true });
    expect(patch.items?.[0]).toMatchObject({ id: draft.id, description: "Arroz", quantity: 100 });
  });
});

describe("invalidItemIndexes", () => {
  test("flags items outside the bounds", () => {
    const bad = { ...draft, quantity: 100000 };
    expect(Array.from(invalidItemIndexes([draft, bad]))).toEqual([1]);
  });
});
