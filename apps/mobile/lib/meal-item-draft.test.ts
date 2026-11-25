import { describe, expect, test } from "@jest/globals";
import type { FoodSuggestion, MealResponse } from "@fitbrother/shared";
import {
  applySuggestion,
  changeDescription,
  changeMacro,
  changeQuantity,
  changeUnit,
  draftFromSavedItem,
  resetToCatalog,
  toPatchItem,
  unitConverts,
  type ItemDraft,
} from "./meal-item-draft";

const FOOD_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

const blank: ItemDraft = {
  description: "",
  quantity: 1,
  unit: "unit",
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  food_id: null,
  link: { mode: "none" },
  adjusted: false,
};

const emptySuggestion: FoodSuggestion = {
  kind: "catalog",
  food_id: null,
  name: "",
  serving_label: null,
  serving_grams: null,
  kcal_per_100g: null,
  protein_per_100g: null,
  carbs_per_100g: null,
  fat_per_100g: null,
  quantity: null,
  unit: null,
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
};

const rice = (servingGrams: number | null): FoodSuggestion => ({
  ...emptySuggestion,
  food_id: FOOD_ID,
  name: "Arroz",
  serving_label: servingGrams ? "1 colher" : null,
  serving_grams: servingGrams,
  kcal_per_100g: 128,
  protein_per_100g: 2.5,
  carbs_per_100g: 28,
  fat_per_100g: 0.2,
});

const recentFree: FoodSuggestion = {
  ...emptySuggestion,
  kind: "recent",
  name: "Marmita da casa",
  quantity: 2,
  unit: "unit",
  kcal: 300,
  protein_g: 20,
  carbs_g: 30,
  fat_g: 10,
};

const saved: MealResponse["items"][number] = {
  id: ITEM_ID,
  food_id: FOOD_ID,
  description: "Arroz",
  quantity: 2,
  unit: "unit",
  kcal: 64,
  protein_g: 1.25,
  carbs_g: 14,
  fat_g: 0.1,
  density_assumed: false,
};

describe("draftFromSavedItem / toPatchItem", () => {
  test("keeps food_id and anchors on the saved quantity and macros", () => {
    const d = draftFromSavedItem(saved);
    expect(d.link).toEqual({
      mode: "anchor",
      quantity: 2,
      unit: "unit",
      macros: { kcal: 64, protein_g: 1.25, carbs_g: 14, fat_g: 0.1 },
    });
    expect(d.food_id).toBe(FOOD_ID);
    expect(d.adjusted).toBe(false);
    expect(d.id).toBe(ITEM_ID);
  });

  test("editing only the quantity of a saved item keeps the link", () => {
    const d = changeQuantity(draftFromSavedItem(saved), 3);
    expect(toPatchItem(d).food_id).toBe(saved.food_id);
    expect(toPatchItem(draftFromSavedItem(saved)).food_id).toBe(saved.food_id);
  });

  test("omits client-only fields", () => {
    const p = toPatchItem(draftFromSavedItem(saved));
    expect(p).toEqual({
      id: ITEM_ID,
      food_id: FOOD_ID,
      description: "Arroz",
      quantity: 2,
      unit: "unit",
      kcal: 64,
      protein_g: 1.25,
      carbs_g: 14,
      fat_g: 0.1,
    });
    expect("link" in p).toBe(false);
    expect("adjusted" in p).toBe(false);
  });

  test("new item has no id key", () => {
    expect("id" in toPatchItem(blank)).toBe(false);
  });
});

describe("applySuggestion", () => {
  test("catalog with serving uses 1 unit", () => {
    const d = applySuggestion(blank, rice(25));
    expect(d).toMatchObject({
      description: "Arroz",
      quantity: 1,
      unit: "unit",
      kcal: 32,
      food_id: FOOD_ID,
      adjusted: false,
    });
    expect(d.link.mode).toBe("food");
  });

  test("catalog without serving uses 100 g", () => {
    const d = applySuggestion(blank, rice(null));
    expect(d).toMatchObject({ quantity: 100, unit: "g", kcal: 128 });
  });

  test("recent with food_id keeps last-use quantity and unit in food mode", () => {
    const s: FoodSuggestion = {
      ...rice(25),
      kind: "recent",
      quantity: 4,
      unit: "unit",
      kcal: 999,
      protein_g: 1,
      carbs_g: 1,
      fat_g: 1,
    };
    const d = applySuggestion(blank, s);
    expect(d.link.mode).toBe("food");
    expect(d).toMatchObject({ quantity: 4, unit: "unit", kcal: 128, food_id: FOOD_ID });
  });

  test("recent with food_id on a non-convertible unit keeps last-use macros", () => {
    const s: FoodSuggestion = {
      ...rice(null),
      kind: "recent",
      quantity: 1,
      unit: "cup",
      kcal: 200,
      protein_g: 4,
      carbs_g: 40,
      fat_g: 1,
    };
    const d = applySuggestion(blank, s);
    expect(d.link.mode).toBe("food");
    expect(d).toMatchObject({ quantity: 1, unit: "cup", kcal: 200, protein_g: 4 });
  });

  test("recent without food_id becomes an anchor", () => {
    const d = applySuggestion(blank, recentFree);
    expect(d.food_id).toBeNull();
    expect(d.link).toEqual({
      mode: "anchor",
      quantity: 2,
      unit: "unit",
      macros: { kcal: 300, protein_g: 20, carbs_g: 30, fat_g: 10 },
    });
    expect(d).toMatchObject({ quantity: 2, unit: "unit", kcal: 300 });
  });

  test("preserves the item id", () => {
    expect(applySuggestion({ ...blank, id: ITEM_ID }, rice(25)).id).toBe(ITEM_ID);
  });
});

describe("food mode", () => {
  test("changeQuantity recomputes macros", () => {
    const d = changeQuantity(applySuggestion(blank, rice(25)), 4);
    expect(d.quantity).toBe(4);
    expect(d.kcal).toBe(128);
  });

  test("typed macro survives a later quantity change", () => {
    let d = applySuggestion(blank, rice(25));
    d = changeMacro(d, { kcal: 50 });
    expect(d.adjusted).toBe(true);
    d = changeQuantity(d, 4);
    expect(d.kcal).toBe(50);
    expect(d.quantity).toBe(4);
  });

  test("resetToCatalog recomputes and clears adjusted", () => {
    let d = changeMacro(applySuggestion(blank, rice(25)), { kcal: 50 });
    d = changeQuantity(d, 4);
    d = resetToCatalog(d);
    expect(d.adjusted).toBe(false);
    expect(d.kcal).toBe(128);
    expect(changeQuantity(d, 2).kcal).toBe(64);
  });

  test("changeUnit recomputes when the unit converts", () => {
    const d = changeUnit(applySuggestion(blank, rice(25)), "g");
    expect(d).toMatchObject({ unit: "g", quantity: 1, kcal: 1.28 });
  });

  test("unit without conversion keeps macros", () => {
    const base = applySuggestion(blank, rice(25));
    const d = changeUnit(base, "cup");
    expect(d).toMatchObject({ unit: "cup", kcal: 32 });
    expect(changeQuantity(d, 3).kcal).toBe(32);
  });

  test("changeUnit does not override typed macros", () => {
    const d = changeUnit(changeMacro(applySuggestion(blank, rice(25)), { kcal: 50 }), "g");
    expect(d.kcal).toBe(50);
  });

  test("resetToCatalog is a no-op outside food mode", () => {
    const d = applySuggestion(blank, recentFree);
    expect(resetToCatalog(d)).toEqual(d);
  });
});

describe("anchor mode", () => {
  test("changeQuantity scales from the anchor in the same unit", () => {
    const d = changeQuantity(applySuggestion(blank, recentFree), 4);
    expect(d.kcal).toBe(600);
    expect(d.protein_g).toBe(40);
  });

  test("changeUnit keeps macros", () => {
    const d = changeUnit(applySuggestion(blank, recentFree), "g");
    expect(d.kcal).toBe(300);
    expect(d.unit).toBe("g");
  });

  test("quantity change in another unit keeps macros", () => {
    const d = changeQuantity(changeUnit(applySuggestion(blank, recentFree), "g"), 500);
    expect(d.kcal).toBe(300);
  });

  test("typed macro survives a later quantity change", () => {
    const d = changeQuantity(changeMacro(applySuggestion(blank, recentFree), { kcal: 111 }), 4);
    expect(d.kcal).toBe(111);
  });
});

describe("saved item scaling", () => {
  const rice100: MealResponse["items"][number] = {
    ...saved,
    quantity: 100,
    unit: "g",
    kcal: 128,
    protein_g: 2.5,
    carbs_g: 28,
    fat_g: 0.2,
  };

  test("quantity change scales macros proportionally", () => {
    const d = changeQuantity(draftFromSavedItem(rice100), 150);
    expect(d.kcal).toBe(192);
    expect(d.protein_g).toBe(3.75);
  });

  test("unit change keeps macros", () => {
    const d = changeUnit(draftFromSavedItem(rice100), "cup");
    expect(d.unit).toBe("cup");
    expect(d.kcal).toBe(128);
  });

  test("a typed macro stops the scaling", () => {
    const d = changeQuantity(changeMacro(draftFromSavedItem(rice100), { kcal: 200 }), 150);
    expect(d.kcal).toBe(200);
  });
});

describe("changeDescription / free text", () => {
  test("clears food_id and link, keeps macros", () => {
    const d = changeDescription(applySuggestion(blank, rice(25)), "Arroz integral");
    expect(d.description).toBe("Arroz integral");
    expect(d.food_id).toBeNull();
    expect(d.link).toEqual({ mode: "none" });
    expect(d.kcal).toBe(32);
    expect(changeQuantity(d, 4).kcal).toBe(32);
  });

  test("editing the description of a saved item unlinks it", () => {
    const d = changeDescription(draftFromSavedItem(saved), "Outro");
    expect(toPatchItem(d).food_id).toBeNull();
  });

  test("free text saves with null food_id and typed macros intact", () => {
    let d = changeDescription(blank, "Bolo da vovó");
    d = changeMacro(d, { kcal: 350, protein_g: 5 });
    d = changeQuantity(d, 2);
    expect(toPatchItem(d)).toMatchObject({
      food_id: null,
      description: "Bolo da vovó",
      quantity: 2,
      kcal: 350,
      protein_g: 5,
    });
  });
});

describe("unitConverts", () => {
  test("is true without a link", () => {
    expect(unitConverts(blank)).toBe(true);
  });

  test("food link converts g but not cup without a serving match", () => {
    const d = applySuggestion(blank, rice(null));
    expect(unitConverts(d)).toBe(true);
    expect(unitConverts({ ...d, unit: "cup" })).toBe(false);
  });

  test("anchor link converts only in the anchor unit", () => {
    const d = draftFromSavedItem(saved);
    expect(unitConverts(d)).toBe(true);
    expect(unitConverts({ ...d, unit: "g" })).toBe(false);
  });
});
