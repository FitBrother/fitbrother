import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const OPTIONS = [
  "Falta de tempo",
  "Fins de semana",
  "Ansiedade / comer emocional",
  "Desisto rápido",
  "Não sei o que comer",
  "Comer fora com frequência",
];

const MAX_SELECTED = 3;

export function BarriersBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const main_barriers = useOnboardingStore((s) => s.main_barriers);
  const setField = useOnboardingStore((s) => s.setField);

  function toggle(option: string) {
    const has = main_barriers.includes(option);
    if (has) {
      setField(
        "main_barriers",
        main_barriers.filter((b) => b !== option),
      );
    } else if (main_barriers.length < MAX_SELECTED) {
      setField("main_barriers", [...main_barriers, option]);
    }
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="O que já te atrapalhou antes?"
      subtitle="Escolha até 3 — isso não muda suas metas, só o tom do feedback."
      onBack={onBack}
      onNext={onNext}
    >
      <View accessibilityRole="radiogroup" className="gap-2">
        {OPTIONS.map((opt) => {
          const selected = main_barriers.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggle(opt)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              className={`min-h-[52px] justify-center rounded-xl border p-3 ${
                selected
                  ? "border-[1.5px] border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <Text className="text-sm font-sans-medium text-neutral-800">{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular por agora
        </Text>
      )}
    </OnboardingStepShell>
  );
}
