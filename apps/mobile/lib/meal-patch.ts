import { PatchMealItemSchema, type MealResponse, type PatchMealRequest } from "@fitbrother/shared";
import { toPatchItem, type ItemDraft } from "@/lib/meal-item-draft";

type ChangedFields = {
  items?: ItemDraft[];
  mealType?: MealResponse["meal_type"];
  consumedAt?: string;
  confirm?: boolean;
};

export function buildMealPatch({
  items,
  mealType,
  consumedAt,
  confirm,
}: ChangedFields): PatchMealRequest {
  return {
    ...(items
      ? { items: items.map((it) => ({ ...toPatchItem(it), description: it.description.trim() })) }
      : {}),
    ...(mealType ? { meal_type: mealType } : {}),
    ...(consumedAt ? { consumed_at: consumedAt } : {}),
    ...(confirm ? { confirm: true } : {}),
  };
}

export function invalidItemIndexes(items: ItemDraft[]): Set<number> {
  const errors = new Set<number>();
  items.forEach((it, i) => {
    if (!PatchMealItemSchema.safeParse(toPatchItem(it)).success) errors.add(i);
  });
  return errors;
}
