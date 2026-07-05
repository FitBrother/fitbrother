import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

const DEFAULT_WEIGHT = 70;

export default function Step4Weight() {
  const weight_kg = useOnboardingStore((s) => s.weight_kg);
  const setField = useOnboardingStore((s) => s.setField);
  const selectedWeight = weight_kg ?? DEFAULT_WEIGHT;

  useEffect(() => {
    if (weight_kg === undefined) {
      setField("weight_kg", DEFAULT_WEIGHT);
    }
  }, [weight_kg, setField]);

  const handleNext = () => {
    if (weight_kg === undefined) {
      setField("weight_kg", DEFAULT_WEIGHT);
    }
    router.push("/(onboarding)/step-5");
  };

  return (
    <OnboardingStepShell
      step={4}
      total={ONBOARDING_STEPS}
      title="E seu peso atual?"
      subtitle="Em quilos. Você pode atualizar isso a qualquer momento."
      onBack={() => router.replace("/(onboarding)/step-3")}
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
