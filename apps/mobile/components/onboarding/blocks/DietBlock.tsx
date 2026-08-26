import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { colors } from "@/lib/colors";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const RESTRICTIONS = ["Sem lactose", "Sem glúten", "Vegetariano", "Vegano", "Nenhuma"];
const BUDGETS = ["Apertado", "Moderado", "Confortável"] as const;

export function DietBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  const dietary_restrictions = useOnboardingStore((s) => s.dietary_restrictions);
  const disliked_foods = useOnboardingStore((s) => s.disliked_foods);
  const budget = useOnboardingStore((s) => s.budget);
  const setField = useOnboardingStore((s) => s.setField);

  function toggleRestriction(option: string) {
    const has = dietary_restrictions.includes(option);
    setField(
      "dietary_restrictions",
      has ? dietary_restrictions.filter((r) => r !== option) : [...dietary_restrictions, option],
    );
  }

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Sua alimentação"
      subtitle="Restrições, preferências e orçamento — pode pular se preferir."
      onBack={onBack}
      onNext={onNext}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Restrições</Text>
          <View className="gap-2">
            {RESTRICTIONS.map((opt) => {
              const selected = dietary_restrictions.includes(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => toggleRestriction(opt)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  className={`min-h-[52px] justify-center rounded-xl border p-3 ${
                    selected
                      ? "border-[1.5px] border-primary-400 bg-primary-50"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <Text className="text-sm font-sans-medium text-neutral-800">{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input
          label="Tem algum alimento que evita ou não gosta? (opcional)"
          value={disliked_foods}
          onChangeText={(v) => setField("disliked_foods", v)}
          placeholder="ex: fígado, quiabo"
        />

        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Orçamento pra comida</Text>
          <SegmentedControl
            values={[...BUDGETS]}
            selectedIndex={budget ? BUDGETS.indexOf(budget as (typeof BUDGETS)[number]) : -1}
            onChange={(e) => setField("budget", BUDGETS[e.nativeEvent.selectedSegmentIndex])}
            tintColor={colors.white}
            backgroundColor={colors.neutral[100]}
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
