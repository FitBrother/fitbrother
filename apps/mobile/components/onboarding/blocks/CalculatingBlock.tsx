import { computeTargets, evaluateSafetyGates } from "@fitbrother/shared";
import { useEffect } from "react";
import { View } from "react-native";
import { LoadingDots } from "@/components/LoadingDots";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { brDateToIso } from "@/lib/masks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const PREVIEW_DELAY_MS = 2600;

/** Idade completa em anos, mesma semântica do EXTRACT(YEAR FROM age(...)) do
 * Postgres — replica apps/server/src/services/targets.ts (não exportado por
 * @fitbrother/shared) porque este preview roda 100% no client, sem round-trip. */
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

export function CalculatingBlock({ onNext, chapter }: OnboardingBlockProps) {
  const setResult = useOnboardingResultStore((s) => s.setResult);

  useEffect(() => {
    const s = useOnboardingStore.getState();
    // birth_date fica em DD/MM/AAAA no store (formato de digitação do
    // BasicsBlock) — precisa converter pra ISO antes de calcular idade,
    // mesma conversão que toPayload() já faz na submissão real.
    const birthDateIso = s.birth_date ? brDateToIso(s.birth_date) : null;
    if (
      !s.sex ||
      !birthDateIso ||
      s.weight_kg === undefined ||
      s.height_cm === undefined ||
      s.body_fat_pct === undefined ||
      !s.activity_level ||
      !s.goal
    ) {
      // Faltou algo obrigatório de um bloco anterior — não deveria acontecer
      // (todos são required antes do goal), mas evita crash silencioso.
      onNext();
      return;
    }

    const targetsInput = {
      sex: s.sex,
      age_years: ageYearsFromBirthDate(birthDateIso),
      weight_kg: s.weight_kg,
      height_cm: s.height_cm,
      activity_level: s.activity_level,
      goal: s.goal,
      body_fat_pct: s.body_fat_pct,
      target_weight_kg: s.target_weight_kg,
      rate_kg_per_week: s.rate_kg_per_week,
      is_pregnant_or_lactating: s.is_pregnant_or_lactating,
      has_kidney_disease: s.has_kidney_disease,
      has_type1_diabetes: s.has_type1_diabetes,
      uses_glp1: s.uses_glp1,
    };

    const targets = computeTargets(targetsInput);
    const gates = evaluateSafetyGates(targetsInput);
    const soft_mode = gates.some((g) => g.severity === "SOFT_MODE");

    setResult(
      {
        kcal: targets.kcal,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        blocked: targets.blocked,
        block_reason: targets.block_reason,
        soft_mode,
      },
      targetsInput,
    );

    const timer = setTimeout(onNext, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onNext, setResult]);

  return (
    <OnboardingChapterShell chapter={chapter} title="Calculando suas metas..." showNav={false}>
      <View className="flex-1 items-center justify-center gap-3 py-12">
        <LoadingDots />
      </View>
    </OnboardingChapterShell>
  );
}
