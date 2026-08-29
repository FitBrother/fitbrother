import { Check } from "lucide-react-native";
import { useState } from "react";
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

export function HealthBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const sex = useOnboardingStore((s) => s.sex);
  const is_pregnant_or_lactating = useOnboardingStore((s) => s.is_pregnant_or_lactating);
  const has_kidney_disease = useOnboardingStore((s) => s.has_kidney_disease);
  const has_type1_diabetes = useOnboardingStore((s) => s.has_type1_diabetes);
  const uses_glp1 = useOnboardingStore((s) => s.uses_glp1);
  const setField = useOnboardingStore((s) => s.setField);
  // `false` em todas as 4 condições é ambíguo entre "ainda não decidiu" e
  // "confirmou que nenhuma se aplica" — esse estado local resolve isso.
  const [noneSelected, setNoneSelected] = useState(false);

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

  const hasAnySelected = Object.values(conditionValues).some(Boolean);

  function toggleCondition(key: ConditionKey) {
    setNoneSelected(false);
    setField(key, !conditionValues[key]);
  }

  function selectNone() {
    setNoneSelected(true);
    for (const key of Object.keys(conditionValues) as ConditionKey[]) {
      setField(key, false);
    }
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Sua saúde, com cuidado"
      subtitle="Leva 10 segundos, e ajuda a manter suas metas seguras."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!hasAnySelected && !noneSelected}
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
        <Pressable
          onPress={selectNone}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: noneSelected }}
          className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
        >
          <View
            className={`h-6 w-6 items-center justify-center rounded-md border ${
              noneSelected ? "border-primary-400 bg-primary-400" : "border-neutral-300 bg-white"
            }`}
          >
            {noneSelected && <Check size={16} color={colors.white} />}
          </View>
          <Text className="flex-1 text-sm font-sans text-neutral-800">Nenhuma dessas</Text>
        </Pressable>
      </View>
    </OnboardingChapterShell>
  );
}
