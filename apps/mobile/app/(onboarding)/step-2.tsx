import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { DateInput } from "@/components/DateInput";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { validateBirthDate } from "@/lib/masks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

// Order matters: index → sex value. Keeps the segmented control's
// `selectedIndex` math obvious.
const SEX_VALUES = ["female", "male", "other"] as const;
const SEX_LABELS = ["Feminino", "Masculino", "Outro"];

export default function Step2SexBirthdate() {
  const sex = useOnboardingStore((s) => s.sex);
  const birth_date = useOnboardingStore((s) => s.birth_date);
  const setField = useOnboardingStore((s) => s.setField);

  // Only complain once the user has typed the whole date — typing
  // mid-stream shouldn't flash "incomplete".
  const dateIsComplete = birth_date.length === 10;
  const dateValidationError = dateIsComplete ? validateBirthDate(birth_date) : null;
  const dateValid = dateIsComplete && dateValidationError === null;

  const selectedIndex = sex ? SEX_VALUES.indexOf(sex) : -1;

  return (
    <OnboardingStepShell
      step={2}
      total={ONBOARDING_STEPS}
      title="Conta um pouco sobre você"
      subtitle="Sexo biológico e data de nascimento — calculamos o gasto calórico com eles."
      onBack={() => router.back()}
      onNext={() => router.push("/(onboarding)/step-3")}
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
            fontStyle={{
              fontFamily: "PlusJakartaSans_500Medium",
              fontSize: 14,
              color: "#64748b",
            }}
            activeFontStyle={{
              fontFamily: "PlusJakartaSans_600SemiBold",
              fontSize: 14,
              color: "#0f172a",
            }}
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
