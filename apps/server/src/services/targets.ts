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

/** Deriva o input do motor de cálculo a partir do payload de onboarding hoje —
 * campos ainda sem UI (peso-alvo, ritmo, condições de saúde) ficam undefined. */
export function buildTargetsInput(payload: OnboardingPayload): TargetsInput {
  return {
    sex: payload.sex,
    age_years: ageYearsFromBirthDate(payload.birth_date),
    weight_kg: payload.weight_kg,
    height_cm: payload.height_cm,
    activity_level: payload.activity_level,
    goal: payload.goal,
  };
}
