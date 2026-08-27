import { useEffect } from "react";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { SliderInput } from "@/components/SliderInput";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const DEFAULT_HEIGHT = 170;

export function HeightBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const height_cm = useOnboardingStore((s) => s.height_cm);
  const setField = useOnboardingStore((s) => s.setField);
  const selectedHeight = height_cm ?? DEFAULT_HEIGHT;

  useEffect(() => {
    if (height_cm === undefined) setField("height_cm", DEFAULT_HEIGHT);
  }, [height_cm, setField]);

  function handleNext() {
    if (height_cm === undefined) setField("height_cm", DEFAULT_HEIGHT);
    onNext();
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Qual sua altura?"
      subtitle="Em centímetros."
      onBack={onBack}
      onNext={handleNext}
      scrollable={false}
    >
      <View className="flex-1 justify-center">
        <SliderInput
          label="Altura"
          min={120}
          max={220}
          step={1}
          value={selectedHeight}
          unit="cm"
          onChange={(v) => setField("height_cm", v)}
        />
      </View>
    </OnboardingChapterShell>
  );
}
