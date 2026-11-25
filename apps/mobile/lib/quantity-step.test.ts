import { describe, expect, test } from "@jest/globals";
import { canDecreaseQuantity, quantityStep, quickAmounts, stepQuantity } from "./quantity-step";

describe("quantityStep", () => {
  test("uses the unit-specific step", () => {
    expect(quantityStep("g")).toBe(10);
    expect(quantityStep("ml")).toBe(10);
    expect(quantityStep("cup")).toBe(0.5);
    expect(quantityStep("unit")).toBe(1);
    expect(quantityStep("slice")).toBe(1);
    expect(quantityStep("tbsp")).toBe(1);
    expect(quantityStep("tsp")).toBe(1);
  });
});

describe("stepQuantity", () => {
  test("increments by the unit step", () => {
    expect(stepQuantity(150, "g", 1)).toBe(160);
    expect(stepQuantity(1, "cup", 1)).toBe(1.5);
  });

  test("decrements by the unit step", () => {
    expect(stepQuantity(150, "g", -1)).toBe(140);
    expect(stepQuantity(2, "unit", -1)).toBe(1);
  });

  test("never reaches zero", () => {
    expect(stepQuantity(10, "g", -1)).toBe(10);
    expect(stepQuantity(0.5, "cup", -1)).toBe(0.5);
    expect(stepQuantity(1, "unit", -1)).toBe(1);
  });

  test("rounds to two decimals", () => {
    expect(stepQuantity(0.1, "cup", 1)).toBe(0.6);
    expect(stepQuantity(0.15, "g", 1)).toBe(10.15);
  });
});

describe("canDecreaseQuantity", () => {
  test("is false when the step would reach zero or less", () => {
    expect(canDecreaseQuantity(10, "g")).toBe(false);
    expect(canDecreaseQuantity(0.5, "cup")).toBe(false);
  });

  test("is true when a positive quantity remains", () => {
    expect(canDecreaseQuantity(20, "g")).toBe(true);
    expect(canDecreaseQuantity(2, "unit")).toBe(true);
  });
});

describe("quickAmounts", () => {
  test("adds the current quantity when missing", () => {
    expect(quickAmounts("g", 120)).toEqual([50, 100, 120, 150, 200]);
  });

  test("does not duplicate the current quantity", () => {
    expect(quickAmounts("g", 100)).toEqual([50, 100, 150, 200]);
    expect(quickAmounts("cup", 1)).toEqual([0.5, 1, 1.5, 2]);
    expect(quickAmounts("unit", 2)).toEqual([1, 2, 3, 4]);
  });

  test("uses unit-specific bases", () => {
    expect(quickAmounts("ml", 100)).toEqual([50, 100, 150, 200]);
    expect(quickAmounts("slice", 1)).toEqual([1, 2, 3, 4]);
  });

  test("sorts a current quantity outside the base range", () => {
    expect(quickAmounts("g", 30)).toEqual([30, 50, 100, 150, 200]);
    expect(quickAmounts("unit", 7)).toEqual([1, 2, 3, 4, 7]);
  });
});
