import { router } from "expo-router";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

const TOTAL_STEPS = 8;

export default function Step1Name() {
  const full_name = useOnboardingStore((s) => s.full_name);
  const setField = useOnboardingStore((s) => s.setField);

  return (
    <OnboardingStepShell
      step={1}
      total={TOTAL_STEPS}
      title="Como podemos te chamar?"
      subtitle="Seu nome aparece nas conquistas e nas conversas com o bot."
      onBack={() => router.back()}
      onNext={() => router.push("/(onboarding)/step-2")}
      nextDisabled={full_name.trim().length < 2}
    >
      <Input
        label="Nome"
        value={full_name}
        onChangeText={(v) => setField("full_name", v)}
        placeholder="Seu nome"
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="givenName"
        returnKeyType="done"
        maxLength={80}
      />
    </OnboardingStepShell>
  );
}
