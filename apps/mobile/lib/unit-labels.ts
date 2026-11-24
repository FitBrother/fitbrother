import type { Unit } from "@fitbrother/shared";

export const UNIT_OPTIONS: Unit[] = ["g", "ml", "unit", "slice", "cup", "tbsp", "tsp"];

export const UNIT_LABEL: Record<Unit, string> = {
  g: "g",
  ml: "ml",
  unit: "un",
  slice: "fatia",
  cup: "xíc",
  tbsp: "c. sopa",
  tsp: "c. chá",
};
