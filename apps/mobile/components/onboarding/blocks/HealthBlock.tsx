// PENDENTE DE REVISÃO PROFISSIONAL — perguntas de triagem de TCA são
// próprias, não reproduzem instrumento clínico protegido. Tratam como sinal
// fraco (ativa soft_mode), nunca como diagnóstico.
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
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

const TCA_QUESTIONS = [
  "Você sente que perde o controle sobre quanto come, mesmo sem fome física?",
  "A preocupação com seu peso ou corpo atrapalha sua rotina no dia a dia?",
  "Depois de comer mais do que planejava, você já se puniu com restrição severa ou exercício em excesso?",
];

const TCA_OPTIONS = ["Sim", "Não", "Prefiro não responder"] as const;

export function HealthBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const sex = useOnboardingStore((s) => s.sex);
  const is_pregnant_or_lactating = useOnboardingStore((s) => s.is_pregnant_or_lactating);
  const has_kidney_disease = useOnboardingStore((s) => s.has_kidney_disease);
  const has_type1_diabetes = useOnboardingStore((s) => s.has_type1_diabetes);
  const uses_glp1 = useOnboardingStore((s) => s.uses_glp1);
  const setField = useOnboardingStore((s) => s.setField);
  const [tcaAnswers, setTcaAnswers] = useState<(string | undefined)[]>([
    undefined,
    undefined,
    undefined,
  ]);

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

  function answerTca(index: number, value: (typeof TCA_OPTIONS)[number]) {
    const next = [...tcaAnswers];
    next[index] = value;
    setTcaAnswers(next);
    setField(
      "tca_screening_positive",
      next.some((a) => a === "Sim"),
    );
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Sua saúde, com cuidado"
      subtitle="Isso ajuda a manter suas metas seguras. Fique à vontade pra pular qualquer pergunta."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
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

        <View className="gap-4">
          {TCA_QUESTIONS.map((q, i) => (
            <View key={q} className="gap-2">
              <Text className="text-sm font-sans text-neutral-700">{q}</Text>
              <View className="flex-row gap-2">
                {TCA_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => answerTca(i, opt)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: tcaAnswers[i] === opt }}
                    className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border px-2 ${
                      tcaAnswers[i] === opt
                        ? "border-[1.5px] border-primary-400 bg-primary-50"
                        : "border-neutral-200 bg-white"
                    }`}
                  >
                    <Text className="text-center text-xs font-sans-medium text-neutral-800">
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </OnboardingStepShell>
  );
}
