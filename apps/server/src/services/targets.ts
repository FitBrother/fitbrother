import type { OnboardingPayload, TargetsInput } from "@fitbrother/shared";
import { computeTargets, evaluateSafetyGates } from "@fitbrother/shared";

export { computeTargets, evaluateSafetyGates };

/** Idade completa em anos, mesma semântica do EXTRACT(YEAR FROM age(...)) do Postgres. */
function ageYearsFromBirthDate(birth_date: string): number {
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
    target_weight_kg: payload.target_weight_kg,
    rate_kg_per_week: payload.rate_kg_per_week,
    strength_training: payload.strength_training,
    is_pregnant_or_lactating: payload.is_pregnant_or_lactating,
    has_kidney_disease: payload.has_kidney_disease,
    has_type1_diabetes: payload.has_type1_diabetes,
    uses_glp1: payload.uses_glp1,
    tca_screening_positive: payload.tca_screening_positive,
  };
}
