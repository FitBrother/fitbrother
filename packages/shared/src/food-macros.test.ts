import { describe, expect, it } from "vitest";
import { macrosForQuantity, quantityInGrams, scaleMacros } from "./food-macros.js";

const rice = {
  kcal_per_100g: 128,
  protein_per_100g: 2.5,
  carbs_per_100g: 28.1,
  fat_per_100g: 0.2,
  serving_grams: null,
};

describe("quantityInGrams", () => {
  it("returns quantity for g and ml", () => {
    expect(quantityInGrams(150, "g", null)).toBe(150);
    expect(quantityInGrams(200, "ml", null)).toBe(200);
  });

  it("multiplies units by serving grams", () => {
    expect(quantityInGrams(2, "unit", 50)).toBe(100);
    expect(quantityInGrams(2, "unit", null)).toBeNull();
  });

  it("returns null for unsupported units", () => {
    for (const unit of ["cup", "slice", "tbsp", "tsp"] as const) {
      expect(quantityInGrams(1, unit, 100)).toBeNull();
    }
  });
});

describe("macrosForQuantity", () => {
  it("scales per-100g macros and rounds to 2 places", () => {
    expect(macrosForQuantity(rice, 150, "g")).toEqual({
      kcal: 192,
      protein_g: 3.75,
      carbs_g: 42.15,
      fat_g: 0.3,
    });
  });

  it("returns null when grams are unknown", () => {
    expect(macrosForQuantity(rice, 1, "cup")).toBeNull();
  });
});

describe("scaleMacros", () => {
  const anchor = { kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5 };

  it("scales proportionally", () => {
    expect(scaleMacros(anchor, 1, 2.5)).toEqual({
      kcal: 250,
      protein_g: 25,
      carbs_g: 50,
      fat_g: 12.5,
    });
  });

  it("returns anchor when fromQuantity is not positive", () => {
    expect(scaleMacros(anchor, 0, 3)).toBe(anchor);
  });
});
