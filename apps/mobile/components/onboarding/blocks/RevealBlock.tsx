import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { GoalsDisclaimer } from "@/components/domain/GoalsDisclaimer";
import { useOnboardingResultStore } from "@/lib/stores/onboardingResultStore";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export function RevealBlock({ onNext }: OnboardingBlockProps) {
  const result = useOnboardingResultStore((s) => s.result);
  const reset = useOnboardingStore((s) => s.reset);

  if (!result) {
    router.replace("/(app)" as never);
    return null;
  }

  if (result.soft_mode) {
    return (
      <View className="flex-1 justify-between bg-neutral-50 p-8">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center text-2xl font-display-bold text-neutral-800">
            Vamos com calma
          </Text>
          <Text className="text-center text-base font-sans text-neutral-600">
            Por enquanto, vamos focar em registrar suas refeições com regularidade e variedade — sem
            números de calorias. Se quiser conversar com alguém, o CVV (188) atende de graça, a
            qualquer hora.
          </Text>
        </View>
        <View className="gap-4">
          <GoalsDisclaimer />
          <Button
            label="Continuar"
            variant="primary"
            onPress={() => {
              reset();
              onNext();
            }}
          />
        </View>
      </View>
    );
  }

  if (result.blocked) {
    return (
      <View className="flex-1 justify-between bg-neutral-50 p-8">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center text-2xl font-display-bold text-neutral-800">
            Ajustamos suas metas
          </Text>
          <Text className="text-center text-base font-sans text-neutral-600">
            {result.block_reason}
          </Text>
        </View>
        <View className="gap-4">
          <GoalsDisclaimer />
          <Button
            label="Continuar"
            variant="primary"
            onPress={() => {
              reset();
              onNext();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-between bg-neutral-50 p-8">
      <View className="flex-1 items-center justify-center gap-6">
        <Text className="text-center text-2xl font-display-bold text-neutral-800">
          Suas metas estão prontas
        </Text>
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
        <Button
          label="Continuar"
          variant="primary"
          onPress={() => {
            reset();
            onNext();
          }}
        />
      </View>
    </View>
  );
}
