import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { postOnboarding } from "@/lib/api";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

const CONSENTS = [
  {
    key: "terms" as const,
    label: "Aceito os Termos de uso",
  },
  {
    key: "privacy" as const,
    label: "Aceito a Política de privacidade",
  },
  {
    key: "ai_processing" as const,
    label: "Autorizo o processamento dos meus dados por IA para extrair refeições",
  },
];

export default function Step8Terms() {
  const consents = useOnboardingStore((s) => s.consents);
  const setConsent = useOnboardingStore((s) => s.setConsent);
  const toPayload = useOnboardingStore((s) => s.toPayload);
  const reset = useOnboardingStore((s) => s.reset);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allConsents = consents.terms && consents.privacy && consents.ai_processing;
  const payload = toPayload();
  const canSubmit = allConsents && !!payload && !submitting;

  async function handleSubmit() {
    if (!payload) {
      setError("Faltam informações de um dos passos anteriores.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postOnboarding(payload);
      reset();
      router.replace("/(app)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OnboardingStepShell
      step={8}
      total={ONBOARDING_STEPS}
      title="Antes de continuar"
      subtitle="Precisamos do seu consentimento para guardar e processar seus dados."
      onBack={() => router.back()}
    >
      <View className="flex-1 justify-between">
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

        {error && (
          <View className="rounded-xl border border-danger-600 bg-danger-50 p-3">
            <Text className="text-sm font-sans text-danger-600">{error}</Text>
          </View>
        )}

        <Button
          label="Concluir cadastro"
          variant="primary"
          disabled={!canSubmit}
          loading={submitting}
          onPress={handleSubmit}
        />
      </View>
    </OnboardingStepShell>
  );
}
