import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ONBOARDING_BLOCKS, DATA_BLOCK_COUNT } from "@/lib/onboarding/blocks";
import { getOnboardingProgress, patchOnboardingProgress } from "@/lib/api";
import { colors } from "@/lib/colors";
import { firstIncompleteGateIndex } from "@/lib/onboarding/gate";
import { CHAPTER_NAMES } from "@/lib/onboarding/types";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

export default function OnboardingBlockScreen() {
  const { block: blockId } = useLocalSearchParams<{ block: string }>();
  const index = ONBOARDING_BLOCKS.findIndex((b) => b.id === blockId);

  // Não é o `index === -1` genérico (id inexistente) — é "esse bloco existe,
  // mas os anteriores ainda não foram preenchidos" (URL editada à mão, ou
  // reload com a store em memória zerada). Confirmado só com o servidor: em
  // memória a store não distingue "nunca preencheu" de "preencheu numa
  // sessão anterior, só recarregou a página" (ela não persiste sozinha).
  const [gateChecked, setGateChecked] = useState(false);

  useEffect(() => {
    if (index === -1) {
      router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[0]!.id}` as never);
      return;
    }
    const gate = firstIncompleteGateIndex(useOnboardingStore.getState());
    if (index <= gate) {
      // Caminho comum (avançar/voltar dentro da sessão, store já em
      // memória): não passa por "false" no meio — evita um flash do
      // spinner a cada "Continuar".
      setGateChecked(true);
      return;
    }
    setGateChecked(false);
    let cancelled = false;
    (async () => {
      const progress = await getOnboardingProgress().catch(() => null);
      if (cancelled) return;
      if (progress?.answers) useOnboardingStore.getState().hydrate(progress.answers);
      const recheckedGate = firstIncompleteGateIndex(useOnboardingStore.getState());
      if (index > recheckedGate) {
        router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[recheckedGate]!.id}` as never);
        return;
      }
      setGateChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [index]);

  if (index === -1 || !gateChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color={colors.primary[400]} />
      </View>
    );
  }
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
  const chapter = block.chapter
    ? { num: block.chapter, name: CHAPTER_NAMES[block.chapter] }
    : undefined;

  return (
    <Component
      step={index + 1}
      total={DATA_BLOCK_COUNT}
      onNext={handleNext}
      onBack={handleBack}
      onSkip={block.skippable ? handleNext : undefined}
      chapter={chapter}
    />
  );
}
