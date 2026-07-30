import type { ActivityLevel, Sex } from "./types.js";

const SEX_BMR_CONSTANT: Record<Sex, number> = {
  male: 5,
  female: -161,
  other: -78,
};

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const KCAL_PER_KG = 7700;
const DAYS_PER_WEEK = 7;

/** TMB (Mifflin-St Jeor). Sem arredondamento — precisão total pra composição posterior. */
export function calculateBmr(input: {
  sex: Sex;
  age_years: number;
  weight_kg: number;
  height_cm: number;
}): number {
  return (
    10 * input.weight_kg +
    6.25 * input.height_cm -
    5 * input.age_years +
    SEX_BMR_CONSTANT[input.sex]
  );
}

/** GET = TMB x fator de atividade. */
export function calculateTdee(bmr_kcal: number, activity_level: ActivityLevel): number {
  return bmr_kcal * ACTIVITY_FACTOR[activity_level];
}

/** Ritmo absoluto (kg/semana) -> déficit/superávit diário (kcal/dia). */
export function rateToDeficitKcalPerDay(rate_kg_per_week: number): number {
  return (rate_kg_per_week * KCAL_PER_KG) / DAYS_PER_WEEK;
}

/** Inverso: déficit/superávit diário (kcal/dia) -> ritmo absoluto (kg/semana). */
export function deficitKcalPerDayToRateKgPerWeek(deficit_kcal_per_day: number): number {
  return (deficit_kcal_per_day * DAYS_PER_WEEK) / KCAL_PER_KG;
}

/** Percentual do peso corporal por semana (ex. tetos/defaults do spec) -> kg/semana absoluto. */
export function percentOfWeightPerWeekToRateKgPerWeek(pct: number, weight_kg: number): number {
  return (pct / 100) * weight_kg;
}

/** 14g de fibra por 1000kcal, teto de 40g. */
export function fiberTargetG(kcal: number): number {
  return Math.min(40, (14 * kcal) / 1000);
}
