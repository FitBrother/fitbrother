import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/lib/colors";
import { getOnboardingProgress } from "@/lib/api";
import { ONBOARDING_BLOCKS } from "@/lib/onboarding/blocks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

export default function OnboardingGate() {
  useEffect(() => {
    (async () => {
      const progress = await getOnboardingProgress().catch(() => null);
      if (progress) {
        useOnboardingStore.getState().hydrate(progress.answers);
        router.replace(`/(onboarding)/${progress.current_block}` as never);
      } else {
        router.replace(`/(onboarding)/${ONBOARDING_BLOCKS[0]!.id}` as never);
      }
    })();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-neutral-50">
      <ActivityIndicator size="large" color={colors.primary[400]} />
    </View>
  );
}
