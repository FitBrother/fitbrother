import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ONBOARDING_BLOCKS, DATA_BLOCK_COUNT } from "@/lib/onboarding/blocks";
import { patchOnboardingProgress } from "@/lib/api";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

export default function OnboardingBlockScreen() {
  const { block: blockId } = useLocalSearchParams<{ block: string }>();
  const index = ONBOARDING_BLOCKS.findIndex((b) => b.id === blockId);

  useEffect(() => {
    if (index === -1) {
      router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[0]!.id}` as never);
    }
  }, [index]);

  if (index === -1) return null;
  const block = ONBOARDING_BLOCKS[index]!;

  function goTo(id: string) {
    router.push(`/(onboarding)/${id}` as never);
  }

  function handleNext() {
    const next = ONBOARDING_BLOCKS[index + 1];
    if (index < DATA_BLOCK_COUNT) {
      void patchOnboardingProgress({
        current_block: next?.id ?? block.id,
        answers: useOnboardingStore.getState().toAnswers(),
      });
    }
    if (next) goTo(next.id);
  }

  function handleBack() {
    const prev = ONBOARDING_BLOCKS[index - 1];
    if (prev) goTo(prev.id);
    else router.replace("/(auth)/welcome");
  }

  const Component = block.Component;
  return (
    <Component
      step={index + 1}
      total={DATA_BLOCK_COUNT}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={block.skippable ? handleNext : undefined}
    />
  );
}
