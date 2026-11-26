import { describe, expect, test } from "@jest/globals";
import type { MealResponse } from "@fitbrother/shared";
import { oldestPending, pendingKcal, pendingMealsOf } from "@/lib/pending-meals";

type Item = MealResponse & { __status?: "processing" };

function meal(over: Partial<Item> & { id: string }): Item {
  return {
    source: "app_text",
    raw_input: null,
    audio_path: null,
    meal_type: "lunch",
    consumed_at: "2026-11-25T12:00:00.000Z",
    total_kcal: 100,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0,
    confidence: 0.9,
    review_required: true,
    ai_feedback: null,
    created_at: "2026-11-25T12:00:00.000Z",
    deleted_at: null,
    items: [],
    ...over,
  };
}

describe("pendingMealsOf", () => {
  test("keeps only review-required meals", () => {
    const items = [meal({ id: "a" }), meal({ id: "b", review_required: false })];
    expect(pendingMealsOf(items).map((m) => m.id)).toEqual(["a"]);
  });

  test("drops optimistic processing cards", () => {
    const items = [meal({ id: "a", __status: "processing" }), meal({ id: "b" })];
    expect(pendingMealsOf(items).map((m) => m.id)).toEqual(["b"]);
  });

  test("is empty when nothing is pending", () => {
    expect(pendingMealsOf([])).toEqual([]);
    expect(pendingMealsOf([meal({ id: "a", review_required: false })])).toEqual([]);
  });
});

describe("pendingKcal", () => {
  test("sums the kcal of the given meals", () => {
    expect(
      pendingKcal([meal({ id: "a", total_kcal: 459.4 }), meal({ id: "b", total_kcal: 200 })]),
    ).toBeCloseTo(659.4);
  });

  test("is zero for no meals", () => {
    expect(pendingKcal([])).toBe(0);
  });
});

describe("oldestPending", () => {
  test("returns undefined for no meals", () => {
    expect(oldestPending([])).toBeUndefined();
  });

  test("picks the smallest consumed_at", () => {
    const meals = [
      meal({ id: "late", consumed_at: "2026-11-25T19:00:00.000Z" }),
      meal({ id: "early", consumed_at: "2026-11-25T08:00:00.000Z" }),
      meal({ id: "mid", consumed_at: "2026-11-25T12:00:00.000Z" }),
    ];
    expect(oldestPending(meals)?.id).toBe("early");
  });

  test("keeps the first one on equal timestamps", () => {
    const meals = [meal({ id: "first" }), meal({ id: "second" })];
    expect(oldestPending(meals)?.id).toBe("first");
  });
});
