import { describe, expect, test } from "@jest/globals";
import { hasConfirmedMeal } from "@/lib/has-confirmed-meal";

type Item = { review_required: boolean; __status?: "processing" };

describe("hasConfirmedMeal", () => {
  test("is false with no meals", () => {
    expect(hasConfirmedMeal([])).toBe(false);
  });

  test("ignores optimistic processing cards", () => {
    const items: Item[] = [{ review_required: false, __status: "processing" }];
    expect(hasConfirmedMeal(items)).toBe(false);
  });

  test("ignores pending meals awaiting confirmation", () => {
    const items: Item[] = [{ review_required: true }];
    expect(hasConfirmedMeal(items)).toBe(false);
  });

  test("is true once a confirmed meal exists", () => {
    const items: Item[] = [{ review_required: true }, { review_required: false }];
    expect(hasConfirmedMeal(items)).toBe(true);
  });
});
