import { router } from "expo-router";
import { View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

const DEFAULT_HEIGHT = 170;

export default function Step3Height() {
  const height_cm = useOnboardingStore((s) => s.height_cm);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={3}
      total={ONBOARDING_STEPS}
      title="Qual sua altura?"
      subtitle="Em centímetros."
      onBack={() => router.replace("/(onboarding)/step-2")}
      onNext={() => router.push("/(onboarding)/step-4")}
      nextDisabled={height_cm === undefined}
      scrollable={false}
    >
      <View className="flex-1 items-center justify-center">
        <WheelPicker
          min={120}
          max={220}
          step={1}
          value={height_cm ?? DEFAULT_HEIGHT}
          unit="cm"
          onChange={(v) => setField("height_cm", v)}
        />
      </View>
    </OnboardingStepShell>
  );
}
