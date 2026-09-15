import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Gate entre telas do onboarding (checando progresso salvo no servidor) —
 * espelha minimamente o OnboardingChapterShell: barra de progresso
 * segmentada + título + um bloco de card, sem saber ainda qual pergunta
 * real vai aparecer.
 */
export function OnboardingGateSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View
        className="mx-auto w-full max-w-[560px] flex-1 px-5 py-6 sm:my-8 sm:flex-none sm:rounded-2xl sm:bg-white sm:p-10"
        style={shadows.card}
      >
        <View className="mb-3 flex-row gap-2.5">
          {[1, 2, 3].map((n) => (
            <View key={n} className="h-1 flex-1 rounded-full bg-neutral-100" />
          ))}
        </View>
        <SkeletonBlock width={140} height={12} />

        <View className="mt-7 gap-3">
          <SkeletonBlock width="80%" height={28} />
          <SkeletonBlock width="60%" height={16} />
        </View>

        <View className="mt-7 flex-1 gap-3">
          <SkeletonBlock width="100%" height={56} radius={16} />
          <SkeletonBlock width="100%" height={56} radius={16} />
        </View>
      </View>
    </SafeAreaView>
  );
}
