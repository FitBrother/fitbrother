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

// % de gordura corporal mínimo saudável por sexo — piso do peso-alvo em
// "perder gordura". Abaixo do bucket mais magro das ilustrações de
// onboarding, deliberadamente: o corte das ilustrações é conservador demais
// pra servir de limite duro, e o gate de IMC <= 18,5 continua sendo a trava
// de segurança de verdade.
const MIN_HEALTHY_BODY_FAT_PCT: Record<Sex, number> = { male: 8, female: 14, other: 11 };
// Teto de IMC pro peso-alvo em "ganhar massa". Acima do corte de obesidade
// da OMS (30) porque o peso-alvo aqui é uma meta declarada, não um
// diagnóstico — 33 dá espaço pra builds atléticos sem virar terra de
// ninguém.
const MAX_BMI_FOR_TARGET_WEIGHT = 33;
// Piso de IMC pro peso-alvo em "perder gordura". 18,6 e não 18,5 porque o
// gate `target_weight_underweight` compara com `bmiRounded1`: um alvo em
// IMC 18,54 arredondaria pra 18,5 e bloquearia. Sem esse piso, o slider
// oferece valores que o próprio sistema recusa depois, no RevealBlock.
const MIN_BMI_FOR_TARGET_WEIGHT = 18.6;

/** Teto de ritmo como % do peso corporal por semana, por direção. Exportado
 * porque o slider de ritmo do onboarding precisa do mesmo número que
 * `computeTargets` aplica — se divergirem, o slider promete o que o cálculo
 * não entrega. */
export const RATE_CAP_PCT: Record<"lose" | "gain", number> = { lose: 1.0, gain: 0.5 };
/** Teto de déficit/superávit como % do GET, por direção. Na prática é este
 * que trava, não o RATE_CAP_PCT — ver computeRateBounds. */
export const DEFICIT_CAP_PCT: Record<"lose" | "gain", number> = { lose: 25, gain: 15 };

export type TargetWeightBounds = { min: number; max: number };

/**
 * Limites do slider de peso-alvo no onboarding, por objetivo.
 *
 * "Perder gordura": teto = peso atual (não faz sentido mirar um peso maior
 * perdendo gordura); piso = o maior entre (a) o peso mínimo em que a massa
 * magra atual ainda corresponde a um % de gordura saudável — abaixo disso o
 * alvo só é alcançável perdendo massa magra — e (b) o peso de IMC 18,6, que
 * mantém o slider fora da faixa que o gate `target_weight_underweight`
 * bloqueia.
 *
 * "Ganhar massa": piso = peso atual (espelha o teto de "perder"); teto =
 * peso que resulta em IMC 33 pra altura do usuário — barra pedidos como
 * 110kg a 1,60m sem travar builds atléticos legítimos.
 */
export function computeTargetWeightBounds(input: {
  goal: "lose" | "gain";
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number;
  sex: Sex;
}): TargetWeightBounds {
  // Arredondamento pra DENTRO do intervalo: `Math.round` empurraria um
  // limite pra fora do valor real por até 0,05kg, que reaparece como um
  // clamp logo depois de o usuário arrastar até a ponta.
  const ceil1 = (n: number) => Math.ceil(n * 10) / 10;
  const floor1 = (n: number) => Math.floor(n * 10) / 10;
  const heightM = input.height_cm / 100;

  if (input.goal === "lose") {
    const leanMass_kg = input.weight_kg * (1 - input.body_fat_pct / 100);
    const minHealthyFatPct = MIN_HEALTHY_BODY_FAT_PCT[input.sex];
    const minByLeanMass = leanMass_kg / (1 - minHealthyFatPct / 100);
    const minByBmi = MIN_BMI_FOR_TARGET_WEIGHT * heightM * heightM;
    // O maior dos dois pisos manda. O `Math.min` com peso-0.5 depois é o
    // guard que mantém min < max pra quem já está no limite — esse usuário
    // é barrado pelo gate `current_bmi_underweight` de qualquer jeito.
    const floor = Math.max(minByLeanMass, minByBmi);
    const min = Math.min(floor, input.weight_kg - 0.5);
    return { min: ceil1(Math.max(min, 1)), max: floor1(input.weight_kg) };
  }

  const maxByBmi = MAX_BMI_FOR_TARGET_WEIGHT * heightM * heightM;
  const max = Math.max(maxByBmi, input.weight_kg + 0.5);
  return { min: ceil1(input.weight_kg), max: floor1(max) };
}
