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

// % de gordura corporal mínimo saudável por sexo — mesmos valores do bucket
// 1 (mais magro) das ilustrações de onboarding, reaproveitados como piso em
// vez de inventar um novo corte clínico.
const MIN_HEALTHY_BODY_FAT_PCT: Record<Sex, number> = { male: 10, female: 17, other: 13 };
// Teto de IMC pro peso-alvo em "ganhar massa" — usa o corte de obesidade da
// OMS (mesmo padrão do BMI_UNDERWEIGHT_THRESHOLD em gates.ts), alto o
// suficiente pra não travar builds atléticos legítimos.
const MAX_BMI_FOR_TARGET_WEIGHT = 30;

export type TargetWeightBounds = { min: number; max: number };

/**
 * Limites do slider de peso-alvo no onboarding, por objetivo.
 *
 * "Perder gordura": teto = peso atual (não faz sentido mirar um peso maior
 * perdendo gordura); piso = peso mínimo em que a massa magra atual ainda
 * corresponde a um % de gordura saudável — abaixo disso, o peso-alvo só é
 * alcançável perdendo massa magra, não só gordura.
 *
 * "Ganhar massa": piso = peso atual (espelha o teto de "perder"); teto =
 * peso que resulta num IMC de obesidade pra altura do usuário — barra
 * pedidos como 110kg a 1,60m sem travar fisiculturistas legítimos.
 */
export function computeTargetWeightBounds(input: {
  goal: "lose" | "gain";
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number;
  sex: Sex;
}): TargetWeightBounds {
  const round1 = (n: number) => Math.round(n * 10) / 10;

  if (input.goal === "lose") {
    const leanMass_kg = input.weight_kg * (1 - input.body_fat_pct / 100);
    const minHealthyFatPct = MIN_HEALTHY_BODY_FAT_PCT[input.sex];
    const minByLeanMass = leanMass_kg / (1 - minHealthyFatPct / 100);
    const min = Math.min(minByLeanMass, input.weight_kg - 0.5);
    return { min: round1(Math.max(min, 1)), max: round1(input.weight_kg) };
  }

  const heightM = input.height_cm / 100;
  const maxByBmi = MAX_BMI_FOR_TARGET_WEIGHT * heightM * heightM;
  const max = Math.max(maxByBmi, input.weight_kg + 0.5);
  return { min: round1(input.weight_kg), max: round1(max) };
}
