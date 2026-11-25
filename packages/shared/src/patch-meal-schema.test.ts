import { describe, expect, it } from "vitest";
import { PatchMealItemSchema, PatchMealRequestSchema } from "./schemas";

const item = {
  description: "Arroz",
  quantity: 100,
  unit: "g",
  kcal: 128,
  protein_g: 2.5,
  carbs_g: 28,
  fat_g: 0.2,
};

const ok = (patch: Record<string, unknown>) =>
  PatchMealItemSchema.safeParse({ ...item, ...patch }).success;

describe("PatchMealItemSchema bounds", () => {
  it("accepts quantity at both bounds", () => {
    expect(ok({ quantity: 0.01 })).toBe(true);
    expect(ok({ quantity: 99999.99 })).toBe(true);
  });

  it("rejects quantity below 0.01 or above 99999.99", () => {
    expect(ok({ quantity: 0.001 })).toBe(false);
    expect(ok({ quantity: 0 })).toBe(false);
    expect(ok({ quantity: 100000 })).toBe(false);
  });

  it.each(["kcal", "protein_g", "carbs_g", "fat_g"])("bounds %s to numeric(7,2)", (key) => {
    expect(ok({ [key]: 0 })).toBe(true);
    expect(ok({ [key]: 99999.99 })).toBe(true);
    expect(ok({ [key]: 100000 })).toBe(false);
    expect(ok({ [key]: -1 })).toBe(false);
  });
});

describe("PatchMealRequestSchema confirm", () => {
  const parse = (body: unknown) => PatchMealRequestSchema.safeParse(body);

  it("accepts confirm alone", () => {
    const res = parse({ confirm: true });
    expect(res.success).toBe(true);
    expect(res.success && res.data.confirm).toBe(true);
  });

  it("accepts confirm together with items", () => {
    expect(parse({ confirm: true, items: [item] }).success).toBe(true);
    expect(parse({ confirm: false, meal_type: "lunch" }).success).toBe(true);
  });

  it("keeps confirm undefined when omitted", () => {
    const res = parse({ meal_type: "lunch" });
    expect(res.success && res.data.confirm).toBeUndefined();
  });

  it("rejects a non-boolean confirm", () => {
    expect(parse({ confirm: "yes" }).success).toBe(false);
  });

  it("rejects confirm with out-of-bounds items", () => {
    expect(parse({ confirm: true, items: [{ ...item, quantity: 100000 }] }).success).toBe(false);
  });
});
