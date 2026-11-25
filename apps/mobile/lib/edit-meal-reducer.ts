import type { FoodSuggestion, Macros, Unit } from "@fitbrother/shared";
import {
  applySuggestion,
  changeDescription,
  changeMacro,
  changeQuantity,
  changeUnit,
  resetToCatalog,
  type ItemDraft,
} from "@/lib/meal-item-draft";

export type EditMealState = { items: ItemDraft[]; dirty: boolean };

export type EditMealAction =
  | { type: "init"; items: ItemDraft[] }
  | { type: "select_suggestion"; index: number; suggestion: FoodSuggestion }
  | { type: "change_quantity"; index: number; quantity: number }
  | { type: "change_unit"; index: number; unit: Unit }
  | { type: "change_macro"; index: number; patch: Partial<Macros> }
  | { type: "change_description"; index: number; description: string }
  | { type: "reset_catalog"; index: number }
  | { type: "add_item" }
  | { type: "remove_item"; index: number };

function mapItem(
  state: EditMealState,
  index: number,
  fn: (d: ItemDraft) => ItemDraft,
): EditMealState {
  return { items: state.items.map((it, i) => (i === index ? fn(it) : it)), dirty: true };
}

export function editMealReducer(state: EditMealState, action: EditMealAction): EditMealState {
  switch (action.type) {
    case "init":
      return { items: action.items, dirty: false };
    case "select_suggestion":
      return mapItem(state, action.index, (d) => applySuggestion(d, action.suggestion));
    case "change_quantity":
      return mapItem(state, action.index, (d) => changeQuantity(d, action.quantity));
    case "change_unit":
      return mapItem(state, action.index, (d) => changeUnit(d, action.unit));
    case "change_macro":
      return mapItem(state, action.index, (d) => changeMacro(d, action.patch));
    case "change_description":
      return mapItem(state, action.index, (d) => changeDescription(d, action.description));
    case "reset_catalog":
      return mapItem(state, action.index, resetToCatalog);
    case "add_item":
      return {
        items: [
          ...state.items,
          {
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
          },
        ],
        dirty: true,
      };
    case "remove_item":
      return {
        items: state.items.filter((_, i) => i !== action.index),
        dirty: true,
      };
  }
}
