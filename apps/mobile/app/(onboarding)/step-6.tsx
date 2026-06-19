import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

const OPTIONS = [
  { value: "lose", title: "Perder gordura", desc: "Déficit calórico de 20%." },
  { value: "maintain", title: "Manter peso", desc: "Calorias = TDEE." },
  { value: "gain", title: "Ganhar massa", desc: "Superávit calórico de 10%." },
  {
    value: "recomp",
    title: "Recomposição",
    desc: "Pequeno déficit (5%) com proteína alta.",
  },
] as const;

export default function Step6Goal() {
  const goal = useOnboardingStore((s) => s.goal);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={6}
      total={ONBOARDING_STEPS}
      title="Qual seu objetivo?"
      subtitle="Define as metas iniciais de calorias e macros."
      onBack={() => router.replace("/(onboarding)/step-5")}
      onNext={() => router.push("/(onboarding)/step-7")}
      nextDisabled={!goal}
    >
      <View accessibilityRole="radiogroup" className="gap-2">
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.selectionAsync();
              setField("goal", opt.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: goal === opt.value }}
            className={`min-h-[64px] rounded-xl border p-3 ${
              goal === opt.value
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
