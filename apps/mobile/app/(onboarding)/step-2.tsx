import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

const TOTAL_STEPS = 8;

const SEX_OPTIONS = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "other", label: "Outro / Prefiro não dizer" },
] as const;

export default function Step2SexBirthdate() {
  const sex = useOnboardingStore((s) => s.sex);
  const birth_date = useOnboardingStore((s) => s.birth_date);
  const setField = useOnboardingStore((s) => s.setField);

  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(birth_date);

  return (
    <OnboardingStepShell
      step={2}
      total={TOTAL_STEPS}
      title="Conta um pouco sobre você"
      subtitle="Sexo biológico e data de nascimento — calculamos o gasto calórico com eles."
      onBack={() => router.back()}
      onNext={() => router.push("/(onboarding)/step-3")}
      nextDisabled={!sex || !isValidDate}
    >
      <View className="gap-3">
        <Text className="text-sm font-sans-medium text-neutral-700">Sexo</Text>
        <View className="gap-2">
          {SEX_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setField("sex", opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: sex === opt.value }}
              className={`min-h-[52px] flex-row items-center rounded-xl border px-4 ${
                sex === opt.value
                  ? "border-[1.5px] border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <Text className="text-base font-sans text-neutral-800">{opt.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-4">
          <Input
            label="Data de nascimento (AAAA-MM-DD)"
            value={birth_date}
            onChangeText={(v) => setField("birth_date", v)}
            placeholder="1995-06-15"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
    </OnboardingStepShell>
  );
}
