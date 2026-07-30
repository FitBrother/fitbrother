import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const TYPES = ["Nenhum", "Cardio", "Força", "Misto"] as const;

export function TrainingBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const strength_training = useOnboardingStore((s) => s.strength_training);
  const training_days_per_week = useOnboardingStore((s) => s.training_days_per_week);
  const setField = useOnboardingStore((s) => s.setField);

  const selectedTypeIndex = strength_training ? 2 : 0;
  const trainingDays = training_days_per_week ?? 0;

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Sua rotina de treino"
      subtitle="Isso ajuda a ajustar sua proteína — pode pular se preferir."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Treinos por semana</Text>
          <WheelPicker
            min={0}
            max={7}
            step={1}
            value={trainingDays}
            unit="x/semana"
            onChange={(v) => setField("training_days_per_week", v)}
          />
        </View>
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">
            Que tipo, principalmente?
          </Text>
          <SegmentedControl
            values={[...TYPES]}
            selectedIndex={selectedTypeIndex}
            onChange={(e) => {
              const i = e.nativeEvent.selectedSegmentIndex;
              setField("strength_training", i === 2 || i === 3);
            }}
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            style={{ height: 40 }}
          />
        </View>
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
