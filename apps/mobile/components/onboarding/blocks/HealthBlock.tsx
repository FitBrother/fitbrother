import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const CONDITIONS = [
  {
    key: "is_pregnant_or_lactating" as const,
    label: "Estou grávida ou amamentando",
    femaleOnly: true,
  },
  { key: "has_kidney_disease" as const, label: "Tenho doença renal diagnosticada" },
  { key: "has_type1_diabetes" as const, label: "Tenho diabetes tipo 1" },
  {
    key: "uses_glp1" as const,
    label: "Uso medicação para emagrecimento (ex: Ozempic, Mounjaro)",
  },
];

export function HealthBlock({ onNext, onBack, onSkip, chapter }: OnboardingBlockProps) {
  const sex = useOnboardingStore((s) => s.sex);
  const is_pregnant_or_lactating = useOnboardingStore((s) => s.is_pregnant_or_lactating);
  const has_kidney_disease = useOnboardingStore((s) => s.has_kidney_disease);
  const has_type1_diabetes = useOnboardingStore((s) => s.has_type1_diabetes);
  const uses_glp1 = useOnboardingStore((s) => s.uses_glp1);
  const setField = useOnboardingStore((s) => s.setField);

  type ConditionKey =
    | "is_pregnant_or_lactating"
    | "has_kidney_disease"
    | "has_type1_diabetes"
    | "uses_glp1";

  const conditionValues: Record<ConditionKey, boolean> = {
    is_pregnant_or_lactating,
    has_kidney_disease,
    has_type1_diabetes,
    uses_glp1,
  };

  function toggleCondition(key: ConditionKey) {
    setField(key, !conditionValues[key]);
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Sua saúde, com cuidado"
      subtitle="Leva 10 segundos, e só pra manter suas metas seguras — pode pular."
      onBack={onBack}
      onNext={onNext}
      onSkip={onSkip}
    >
      <View className="gap-3">
        {CONDITIONS.filter((c) => !c.femaleOnly || sex === "female").map((c) => {
          const checked = conditionValues[c.key];
          return (
            <Pressable
              key={c.key}
              onPress={() => toggleCondition(c.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-md border ${
                  checked ? "border-primary-400 bg-primary-400" : "border-neutral-300 bg-white"
                }`}
              >
                {checked && <Check size={16} color={colors.white} />}
              </View>
              <Text className="flex-1 text-sm font-sans text-neutral-800">{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingChapterShell>
  );
}
