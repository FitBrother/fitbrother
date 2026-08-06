import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { WheelPicker } from "@/components/WheelPicker";
import {
  type TrainingType,
  trainingTypeUsesStrength,
  useOnboardingStore,
} from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const TYPES = ["Nenhum", "Cardio", "Força", "Misto"] as const;
const TYPE_VALUES: TrainingType[] = ["none", "cardio", "strength", "mixed"];

export function TrainingBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const training_type = useOnboardingStore((s) => s.training_type);
  const strength_training = useOnboardingStore((s) => s.strength_training);
  const training_days_per_week = useOnboardingStore((s) => s.training_days_per_week);
  const setField = useOnboardingStore((s) => s.setField);

  const selectedTypeIndex = TYPE_VALUES.indexOf(
    training_type ?? (strength_training ? "strength" : "none"),
  );
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
              const trainingType = TYPE_VALUES[i];
              if (!trainingType) return;
              setField("training_type", trainingType);
              setField("strength_training", trainingTypeUsesStrength(trainingType));
            }}
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            fontStyle={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#64748b" }}
            activeFontStyle={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#04100c" }}
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
