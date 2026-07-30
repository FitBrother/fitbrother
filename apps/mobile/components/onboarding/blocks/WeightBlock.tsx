import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const DEFAULT_WEIGHT = 70;

export function WeightBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
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
    <OnboardingStepShell
      step={step}
      total={total}
      title="E seu peso atual?"
      subtitle="Em quilos. Você pode atualizar isso a qualquer momento."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
      <View className="flex-1 items-center justify-center">
        <WheelPicker
          min={30}
          max={200}
          step={0.5}
          value={selectedWeight}
          unit="kg"
          onChange={(v) => setField("weight_kg", v)}
        />
      </View>
    </OnboardingStepShell>
  );
}
