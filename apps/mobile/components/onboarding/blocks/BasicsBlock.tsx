import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { Pressable, Text, View } from "react-native";
import { DateInput } from "@/components/DateInput";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { validateBirthDate } from "@/lib/masks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const SEX_VALUES = ["female", "male", "other"] as const;
const SEX_LABELS = ["Feminino", "Masculino", "Outro"];

export function BasicsBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const sex = useOnboardingStore((s) => s.sex);
  const birth_date = useOnboardingStore((s) => s.birth_date);
  const setField = useOnboardingStore((s) => s.setField);

  const dateIsComplete = birth_date.length === 10;
  const dateValidationError = dateIsComplete ? validateBirthDate(birth_date) : null;
  const dateValid = dateIsComplete && dateValidationError === null;
  const selectedIndex = sex ? SEX_VALUES.indexOf(sex) : -1;

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Conta um pouco sobre você"
      subtitle="Sexo biológico e data de nascimento — calculamos o gasto calórico com eles."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!sex || !dateValid}
    >
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-neutral-700">Sexo biológico</Text>
          <SegmentedControl
            values={SEX_LABELS}
            selectedIndex={selectedIndex}
            onChange={(e) => {
              const i = e.nativeEvent.selectedSegmentIndex;
              setField("sex", SEX_VALUES[i]);
            }}
            tintColor="#ffffff"
            backgroundColor="#f1f5f9"
            fontStyle={{ fontFamily: "Inter_500Medium", fontSize: 14, color: "#64748b" }}
            activeFontStyle={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#04100c" }}
            style={{ height: 40 }}
          />
          {sex !== undefined && (
            <Pressable
              onPress={() => setField("sex", undefined)}
              accessibilityRole="button"
              accessibilityLabel="Limpar seleção de sexo"
            >
              <Text className="mt-1 text-xs font-sans text-neutral-500">Limpar seleção</Text>
            </Pressable>
          )}
        </View>

        <DateInput
          label="Data de nascimento"
          value={birth_date}
          onChangeText={(v) => setField("birth_date", v)}
          error={dateValidationError ?? undefined}
        />
      </View>
    </OnboardingStepShell>
  );
}
