import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const CONSENTS = [
  { key: "terms" as const, label: "Aceito os Termos de uso" },
  { key: "privacy" as const, label: "Aceito a Política de privacidade" },
  {
    key: "ai_processing" as const,
    label: "Autorizo o processamento dos meus dados por IA para extrair refeições",
  },
];

export function ConsentBlock({ step, total, onNext, onBack }: OnboardingBlockProps) {
  const consents = useOnboardingStore((s) => s.consents);
  const setConsent = useOnboardingStore((s) => s.setConsent);
  const allConsents = consents.terms && consents.privacy && consents.ai_processing;

  return (
    <OnboardingStepShell
      step={step}
      total={total}
      title="Antes de continuar"
      subtitle="Precisamos do seu consentimento para guardar e processar seus dados."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!allConsents}
    >
      <View className="gap-3">
        {CONSENTS.map((c) => {
          const checked = consents[c.key];
          return (
            <Pressable
              key={c.key}
              onPress={() => setConsent(c.key, !checked)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded-md border ${
                  checked ? "border-primary-400 bg-primary-400" : "border-neutral-300 bg-white"
                }`}
              >
                {checked && <Check size={16} color="#ffffff" />}
              </View>
              <Text className="flex-1 text-sm font-sans text-neutral-800">{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStepShell>
  );
}
