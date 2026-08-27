import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { SliderInput } from "@/components/SliderInput";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const DEFAULT_WEIGHT = 70;

export function WeightBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const weight_kg = useOnboardingStore((s) => s.weight_kg);
  const setField = useOnboardingStore((s) => s.setField);
  const selectedWeight = weight_kg ?? DEFAULT_WEIGHT;

  useEffect(() => {
    if (weight_kg === undefined) setField("weight_kg", DEFAULT_WEIGHT);
  }, [weight_kg, setField]);

  function handleNext() {
    if (weight_kg === undefined) setField("weight_kg", DEFAULT_WEIGHT);
    onNext();
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="E seu peso atual?"
      subtitle="Em quilos. Você pode atualizar isso a qualquer momento."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
      <View className="flex-1 justify-center">
        <SliderInput
          label="Peso"
          min={30}
          max={200}
          step={0.5}
          value={selectedWeight}
          unit="kg"
          onChange={(v) => setField("weight_kg", v)}
        />
      </View>
    </OnboardingChapterShell>
  );
}
