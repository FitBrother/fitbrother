import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { colors } from "@/lib/colors";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const COOKS = ["Eu mesmo", "Outra pessoa", "Varia"] as const;
const EATS_OUT = ["Raramente", "Às vezes", "Frequentemente"] as const;

export function HabitsBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const cooks_own_food = useOnboardingStore((s) => s.cooks_own_food);
  const eats_out_frequency = useOnboardingStore((s) => s.eats_out_frequency);
  const meal_times = useOnboardingStore((s) => s.meal_times);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Seus hábitos alimentares"
      subtitle="Ajuda o feedback da IA a fazer mais sentido pro seu dia a dia."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">
            Quem cozinha suas refeições?
          </Text>
          <SegmentedControl
            values={[...COOKS]}
            selectedIndex={
              cooks_own_food ? COOKS.indexOf(cooks_own_food as (typeof COOKS)[number]) : -1
            }
            onChange={(e) => setField("cooks_own_food", COOKS[e.nativeEvent.selectedSegmentIndex])}
            tintColor={colors.white}
            backgroundColor={colors.neutral[100]}
            fontStyle={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.neutral[500] }}
            activeFontStyle={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.ink }}
            style={{ height: 40 }}
          />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">
            Come fora ou pede delivery?
          </Text>
          <SegmentedControl
            values={[...EATS_OUT]}
            selectedIndex={
              eats_out_frequency
                ? EATS_OUT.indexOf(eats_out_frequency as (typeof EATS_OUT)[number])
                : -1
            }
            onChange={(e) =>
              setField("eats_out_frequency", EATS_OUT[e.nativeEvent.selectedSegmentIndex])
            }
            tintColor={colors.white}
            backgroundColor={colors.neutral[100]}
            fontStyle={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.neutral[500] }}
            activeFontStyle={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.ink }}
            style={{ height: 40 }}
          />
        </View>
        <Input
          label="Horários que costuma comer (opcional)"
          value={meal_times}
          onChangeText={(v) => setField("meal_times", v)}
          placeholder="ex: café 7h, almoço 12h, jantar 20h"
        />
      </View>
      {onSkip && (
        <Text
          onPress={onSkip}
          accessibilityRole="button"
          className="mt-4 text-center text-sm font-sans-medium text-neutral-500"
        >
          Pular por agora
        </Text>
      )}
    </OnboardingStepShell>
  );
}
