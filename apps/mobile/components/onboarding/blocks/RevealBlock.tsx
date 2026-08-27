import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function RevealBlock({ onNext, chapter }: OnboardingBlockProps) {
  const result = useOnboardingResultStore((s) => s.result);

  if (!result) {
    router.replace("/(auth)/welcome" as never);
    return null;
  }

  if (result.blocked) {
    return (
      <OnboardingChapterShell chapter={chapter} title="Ajustamos suas metas" showNav={false}>
        <View className="flex-1 justify-between gap-8">
          <Text className="text-center text-base font-sans text-neutral-600">
            {result.block_reason}
          </Text>
          <View className="gap-4">
            <GoalsDisclaimer />
            <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
          </View>
        </View>
      </OnboardingChapterShell>
    );
  }

  return (
    <OnboardingChapterShell chapter={chapter} title="Suas metas estão prontas" showNav={false}>
      <View className="flex-1 justify-between gap-8">
        <View className="items-center gap-6">
          <Text
            className="text-5xl font-display-bold text-primary-500"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {fmtInt(result.kcal)} kcal
          </Text>
          <View className="flex-row gap-6">
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(result.protein_g)}g proteína
            </Text>
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(result.carbs_g)}g carbo
            </Text>
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-sans text-neutral-600">
              {fmtInt(result.fat_g)}g gordura
            </Text>
          </View>
        </View>
        <View className="gap-4">
          <GoalsDisclaimer />
          <Button label="Criar conta pra salvar essas metas" variant="primary" onPress={onNext} />
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
