import type { MealResponse } from "@fitbrother/shared";

export const MEAL_TYPE_OPTIONS: MealResponse["meal_type"][] = [
  "breakfast",
  "lunch",
  "snack",
  "dinner",
  "other",
];

export function withTime(consumedAtIso: string, hour: number, minute: number): string {
  const d = new Date(consumedAtIso);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
