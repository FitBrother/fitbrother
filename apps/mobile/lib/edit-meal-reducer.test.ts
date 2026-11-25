import { describe, expect, test } from "@jest/globals";
import { editMealReducer, type EditMealState } from "./edit-meal-reducer";
import type { ItemDraft } from "./meal-item-draft";

const saved: ItemDraft = {
  id: "item-1",
  description: "Arroz",
  quantity: 100,
  unit: "g",
  kcal: 128,
  protein_g: 2.5,
  carbs_g: 28,
  fat_g: 0.2,
  food_id: null,
  link: {
    mode: "anchor",
    quantity: 100,
    unit: "g",
    macros: { kcal: 128, protein_g: 2.5, carbs_g: 28, fat_g: 0.2 },
  },
  adjusted: false,
};

const initial: EditMealState = { items: [saved], dirty: false };

describe("editMealReducer", () => {
  test("change_quantity scales a saved item and marks dirty", () => {
    const next = editMealReducer(initial, { type: "change_quantity", index: 0, quantity: 110 });
    expect(next.dirty).toBe(true);
    expect(next.items[0]).toMatchObject({ quantity: 110, kcal: 140.8 });
  });

  test("add_item appends an empty unlinked draft", () => {
    const next = editMealReducer(initial, { type: "add_item" });
    expect(next.items).toHaveLength(2);
    expect(next.items[1]).toMatchObject({ description: "", food_id: null, link: { mode: "none" } });
    expect(next.items[1]?.id).toBeUndefined();
  });

  test("remove_item drops the item at the index", () => {
    const next = editMealReducer(initial, { type: "remove_item", index: 0 });
    expect(next).toEqual({ items: [], dirty: true });
  });

  test("init resets dirty", () => {
    const dirty = editMealReducer(initial, { type: "remove_item", index: 0 });
    expect(editMealReducer(dirty, { type: "init", items: [saved] })).toEqual(initial);
  });
});
