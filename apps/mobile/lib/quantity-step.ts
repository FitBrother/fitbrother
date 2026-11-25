import type { Unit } from "@fitbrother/shared";

const STEP: Record<Unit, number> = {
  g: 10,
  ml: 10,
  cup: 0.5,
  unit: 1,
  slice: 1,
  tbsp: 1,
  tsp: 1,
};

const BASE_AMOUNTS: Record<Unit, number[]> = {
  g: [50, 100, 150, 200],
  ml: [50, 100, 150, 200],
  cup: [0.5, 1, 1.5, 2],
  unit: [1, 2, 3, 4],
  slice: [1, 2, 3, 4],
  tbsp: [1, 2, 3, 4],
  tsp: [1, 2, 3, 4],
};

const MAX_AMOUNTS = 5;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quantityStep(unit: Unit): number {
  return STEP[unit];
}

export function canDecreaseQuantity(quantity: number, unit: Unit): boolean {
  return quantity - STEP[unit] > 0;
}

export function stepQuantity(quantity: number, unit: Unit, direction: 1 | -1): number {
  if (direction === -1 && !canDecreaseQuantity(quantity, unit)) return quantity;
  return round2(quantity + direction * STEP[unit]);
}

export function quickAmounts(unit: Unit, current: number): number[] {
  const base = BASE_AMOUNTS[unit];
  const all = base.includes(current) ? base : [...base, current];
  return [...all].sort((a, b) => a - b).slice(0, MAX_AMOUNTS);
}
