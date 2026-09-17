import type { ActivityLevel, Goal, OnboardingPayload, Sex, TargetsInput } from "@fitbrother/shared";
import { computeTargets, evaluateSafetyGates } from "@fitbrother/shared";

export { computeTargets, evaluateSafetyGates };

/** Idade completa em anos, mesma semântica do EXTRACT(YEAR FROM age(...)) do Postgres. */
export function ageYearsFromBirthDate(birth_date: string): number {
  const birth = new Date(birth_date);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Deriva o input do motor de cálculo a partir do payload de onboarding —
 * os campos opcionais (peso-alvo, ritmo, condições de saúde) vêm dos blocos
 * novos do M16; ficam undefined só se o usuário pulou o bloco. */
export function buildTargetsInput(payload: OnboardingPayload): TargetsInput {
  return {
    sex: payload.sex,
    age_years: ageYearsFromBirthDate(payload.birth_date),
    weight_kg: payload.weight_kg,
    height_cm: payload.height_cm,
    activity_level: payload.activity_level,
    goal: payload.goal,
    body_fat_pct: payload.body_fat_pct,
    target_weight_kg: payload.target_weight_kg,
    rate_kg_per_week: payload.rate_kg_per_week,
    protein_g_override: payload.protein_g_override,
    strength_training: payload.strength_training,
    is_pregnant_or_lactating: payload.is_pregnant_or_lactating,
    has_kidney_disease: payload.has_kidney_disease,
    has_type1_diabetes: payload.has_type1_diabetes,
    uses_glp1: payload.uses_glp1,
  };
}

/** Estado mínimo já persistido (profiles + última anthropometrics) usado
 * pra sugerir uma nova meta quando peso/atividade/objetivo mudam depois do
 * onboarding — ver `GET /account/nutrition-goals/suggested`. */
export type AccountTargetsState = {
  birth_date: string;
  sex: Sex;
  activity_level: ActivityLevel;
  goal: Goal;
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number | null;
  target_weight_kg: number | null;
  rate_kg_per_week: number | null;
  strength_training: boolean | null;
  is_pregnant_or_lactating: boolean | null;
  has_kidney_disease: boolean | null;
  has_type1_diabetes: boolean | null;
  uses_glp1: boolean | null;
};

/** Contas criadas antes do M19 (body_fat_pct virar obrigatório no onboarding)
 * não têm esse valor salvo — 20% é o mesmo fallback neutro já usado no preview
 * local do onboarding (`GoalBlock.tsx`, `body_fat_pct ?? 20`). */
const FALLBACK_BODY_FAT_PCT = 20;

export function buildTargetsInputFromAccountState(state: AccountTargetsState): TargetsInput {
  return {
    sex: state.sex,
    age_years: ageYearsFromBirthDate(state.birth_date),
    weight_kg: state.weight_kg,
    height_cm: state.height_cm,
    activity_level: state.activity_level,
    goal: state.goal,
    body_fat_pct: state.body_fat_pct ?? FALLBACK_BODY_FAT_PCT,
    target_weight_kg: state.target_weight_kg ?? undefined,
    rate_kg_per_week: state.rate_kg_per_week ?? undefined,
    strength_training: state.strength_training ?? undefined,
    is_pregnant_or_lactating: state.is_pregnant_or_lactating ?? undefined,
    has_kidney_disease: state.has_kidney_disease ?? undefined,
    has_type1_diabetes: state.has_type1_diabetes ?? undefined,
    uses_glp1: state.uses_glp1 ?? undefined,
  };
}
