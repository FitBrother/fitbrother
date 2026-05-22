import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

const OPTIONS = [
  {
    value: "sedentary",
    title: "Sedentário",
    desc: "Pouca ou nenhuma atividade física.",
  },
  {
    value: "light",
    title: "Leve",
    desc: "Caminhadas, 1-3 treinos por semana.",
  },
  {
    value: "moderate",
    title: "Moderado",
    desc: "3-5 treinos por semana.",
  },
  {
    value: "active",
    title: "Ativo",
    desc: "6-7 treinos por semana ou trabalho fisicamente exigente.",
  },
  {
    value: "very_active",
    title: "Muito ativo",
    desc: "Treinos intensos diários ou trabalho braçal pesado.",
  },
] as const;

export default function Step5Activity() {
  const activity_level = useOnboardingStore((s) => s.activity_level);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={5}
      total={ONBOARDING_STEPS}
      title="Qual seu nível de atividade?"
      subtitle="Isso ajusta o gasto calórico diário (TDEE)."
      onBack={() => router.back()}
      onNext={() => router.push("/(onboarding)/step-6")}
      nextDisabled={!activity_level}
    >
      <View accessibilityRole="radiogroup" className="gap-2">
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.selectionAsync();
              setField("activity_level", opt.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: activity_level === opt.value }}
            className={`min-h-[64px] rounded-xl border p-3 ${
              activity_level === opt.value
                ? "border-[1.5px] border-primary-400 bg-primary-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <Text className="text-base font-sans-semibold text-neutral-800">{opt.title}</Text>
            <Text className="text-sm font-sans text-neutral-600">{opt.desc}</Text>
          </Pressable>
        ))}
      </View>
    </OnboardingStepShell>
  );
}
