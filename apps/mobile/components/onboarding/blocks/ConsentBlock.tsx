import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

const legal = Constants.expoConfig?.extra?.legal as
  | { termsUrl?: string; privacyUrl?: string }
  | undefined;

/** Consentimento só é válido se for informado (LGPD art. 5º, XII) — cada item
    precisa de um caminho para ler o documento antes do aceite. O de IA aponta
    para a Política de Privacidade, onde o processamento por IA é detalhado. */
const CONSENTS = [
  {
    key: "terms" as const,
    label: "Aceito os Termos de uso",
    doc: "Termos de uso",
    url: legal?.termsUrl,
  },
  {
    key: "privacy" as const,
    label: "Aceito a Política de privacidade",
    doc: "Política de privacidade",
    url: legal?.privacyUrl,
  },
  {
    key: "ai_processing" as const,
    label: "Autorizo o processamento dos meus dados por IA para extrair refeições",
    doc: "Política de privacidade",
    url: legal?.privacyUrl,
  },
];

export function ConsentBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const consents = useOnboardingStore((s) => s.consents);
  const setConsent = useOnboardingStore((s) => s.setConsent);
  const allConsents = consents.terms && consents.privacy && consents.ai_processing;

  return (
    <OnboardingChapterShell
      chapter={chapter}
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
            <View
              key={c.key}
              className="min-h-[52px] flex-row items-center rounded-xl border border-neutral-200 bg-white p-3"
            >
              <Pressable
                onPress={() => setConsent(c.key, !checked)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={c.label}
                className="min-h-[44px] flex-1 flex-row items-center gap-3"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-md border ${
                    checked ? "border-primary-400 bg-primary-400" : "border-neutral-300 bg-white"
                  }`}
                >
                  {checked && <Check size={16} color={colors.white} />}
                </View>
                <Text className="flex-1 text-sm font-sans text-neutral-800">{c.label}</Text>
              </Pressable>
              {c.url && (
                <Pressable
                  onPress={() => Linking.openURL(c.url as string)}
                  accessibilityRole="link"
                  accessibilityLabel={`Ler ${c.doc}`}
                  className="min-h-[44px] min-w-[44px] items-center justify-center"
                >
                  <Text className="font-sans-medium text-sm text-primary-700">Ler</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </OnboardingChapterShell>
  );
}
