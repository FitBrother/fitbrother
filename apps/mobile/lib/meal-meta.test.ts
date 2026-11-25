import { describe, expect, test } from "@jest/globals";
import { MEAL_TYPE_OPTIONS, withTime } from "./meal-meta";

describe("withTime", () => {
  test("swaps hour and minute keeping the local day", () => {
    const original = new Date(2026, 10, 25, 8, 15, 30, 500).toISOString();
    const result = withTime(original, 12, 40);
    expect(result).toBe(new Date(2026, 10, 25, 12, 40, 0, 0).toISOString());
  });

  test("zeroes seconds and milliseconds", () => {
    const original = new Date(2026, 0, 5, 23, 59, 59, 999).toISOString();
    const d = new Date(withTime(original, 23, 59));
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  test("allows moving to just after midnight on the same local day", () => {
    const original = new Date(2026, 5, 10, 18, 0).toISOString();
    expect(withTime(original, 0, 5)).toBe(new Date(2026, 5, 10, 0, 5).toISOString());
  });
});

describe("MEAL_TYPE_OPTIONS", () => {
  test("lists the five types in display order", () => {
    expect(MEAL_TYPE_OPTIONS).toEqual(["breakfast", "lunch", "snack", "dinner", "other"]);
  });
});
