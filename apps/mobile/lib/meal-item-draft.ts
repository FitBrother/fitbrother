import {
  macrosForQuantity,
  scaleMacros,
  type FoodPer100g,
  type FoodSuggestion,
  type Macros,
  type MealResponse,
  type PatchMealRequest,
  type Unit,
} from "@fitbrother/shared";

export type ItemLink =
  | { mode: "none" }
  | { mode: "food"; food: FoodPer100g }
  | { mode: "anchor"; quantity: number; unit: Unit; macros: Macros };

export type ItemDraft = {
  id?: string;
  description: string;
  quantity: number;
  unit: Unit;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  food_id: string | null;
  link: ItemLink;
  adjusted: boolean;
};

type PatchItem = NonNullable<PatchMealRequest["items"]>[number];

function macrosOf(d: Macros): Macros {
  return { kcal: d.kcal, protein_g: d.protein_g, carbs_g: d.carbs_g, fat_g: d.fat_g };
}

function foodOf(s: FoodSuggestion): FoodPer100g | null {
  if (
    s.food_id === null ||
    s.kcal_per_100g === null ||
    s.protein_per_100g === null ||
    s.carbs_per_100g === null ||
    s.fat_per_100g === null
  ) {
    return null;
  }
  return {
    kcal_per_100g: s.kcal_per_100g,
    protein_per_100g: s.protein_per_100g,
    carbs_per_100g: s.carbs_per_100g,
    fat_per_100g: s.fat_per_100g,
    serving_grams: s.serving_grams,
  };
}

function lastUse(s: FoodSuggestion): Macros {
  return {
    kcal: s.kcal ?? 0,
    protein_g: s.protein_g ?? 0,
    carbs_g: s.carbs_g ?? 0,
    fat_g: s.fat_g ?? 0,
  };
}

export function applySuggestion(draft: ItemDraft, s: FoodSuggestion): ItemDraft {
  const base = { id: draft.id, description: s.name, adjusted: false };
  const food = foodOf(s);

  if (food) {
    const fromCatalog = s.kind === "catalog";
    const quantity = fromCatalog ? (food.serving_grams ? 1 : 100) : (s.quantity ?? 1);
    const unit: Unit = fromCatalog ? (food.serving_grams ? "unit" : "g") : (s.unit ?? "unit");
    const macros = macrosForQuantity(food, quantity, unit) ?? lastUse(s);
    return {
      ...base,
      quantity,
      unit,
      ...macros,
      food_id: s.food_id,
      link: { mode: "food", food },
    };
  }

  const quantity = s.quantity ?? 1;
  const unit: Unit = s.unit ?? "unit";
  const macros = lastUse(s);
  return {
    ...base,
    quantity,
    unit,
    ...macros,
    food_id: null,
    link: { mode: "anchor", quantity, unit, macros: macrosOf(macros) },
  };
}

export function changeQuantity(draft: ItemDraft, quantity: number): ItemDraft {
  const { link } = draft;
  if (!draft.adjusted && link.mode === "food") {
    const macros = macrosForQuantity(link.food, quantity, draft.unit);
    return { ...draft, quantity, ...(macros ?? {}) };
  }
  if (!draft.adjusted && link.mode === "anchor" && draft.unit === link.unit) {
    return { ...draft, quantity, ...scaleMacros(link.macros, link.quantity, quantity) };
  }
  return { ...draft, quantity };
}

export function changeUnit(draft: ItemDraft, unit: Unit): ItemDraft {
  const { link } = draft;
  if (!draft.adjusted && link.mode === "food") {
    const macros = macrosForQuantity(link.food, draft.quantity, unit);
    return { ...draft, unit, ...(macros ?? {}) };
  }
  return { ...draft, unit };
}

export function changeMacro(draft: ItemDraft, patch: Partial<Macros>): ItemDraft {
  return { ...draft, ...patch, adjusted: true };
}

export function changeDescription(draft: ItemDraft, description: string): ItemDraft {
  return { ...draft, description, food_id: null, link: { mode: "none" } };
}

export function resetToCatalog(draft: ItemDraft): ItemDraft {
  if (draft.link.mode !== "food") return draft;
  const macros = macrosForQuantity(draft.link.food, draft.quantity, draft.unit);
  return { ...draft, ...(macros ?? {}), adjusted: false };
}

export function draftFromSavedItem(it: MealResponse["items"][number]): ItemDraft {
  return {
    id: it.id,
    description: it.description,
    quantity: it.quantity,
    unit: it.unit,
    kcal: it.kcal,
    protein_g: it.protein_g,
    carbs_g: it.carbs_g,
    fat_g: it.fat_g,
    food_id: it.food_id,
    link: { mode: "none" },
    adjusted: false,
  };
}

export function toPatchItem(d: ItemDraft): PatchItem {
  return {
    ...(d.id ? { id: d.id } : {}),
    food_id: d.food_id,
    description: d.description,
    quantity: d.quantity,
    unit: d.unit,
    kcal: d.kcal,
    protein_g: d.protein_g,
    carbs_g: d.carbs_g,
    fat_g: d.fat_g,
  };
}
