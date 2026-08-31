import * as Linking from "expo-linking";
import { Check, HeartPulse } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import { legalUrls } from "@/lib/legal";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

/** Consentimento só é válido se for informado (LGPD art. 5º, XII) — cada item
    precisa de um caminho para ler o documento antes do aceite. O de IA aponta
    para a Política de Privacidade, onde o processamento por IA é detalhado. */
const CONSENTS = [
  {
    key: "terms" as const,
    label: "Aceito os Termos de uso",
    doc: "Termos de uso",
    url: legalUrls.termsUrl,
  },
  {
    key: "privacy" as const,
    label: "Aceito a Política de privacidade",
    doc: "Política de privacidade",
    url: legalUrls.privacyUrl,
  },
  {
    key: "ai_processing" as const,
    label: "Autorizo o processamento dos meus dados por IA para extrair refeições",
    doc: "Política de privacidade",
    url: legalUrls.privacyUrl,
  },
];

export function ConsentBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const consents = useOnboardingStore((s) => s.consents);
  const setConsent = useOnboardingStore((s) => s.setConsent);
  const allConsents =
    consents.terms && consents.privacy && consents.ai_processing && consents.health_data;

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

        <HealthDataConsent
          checked={consents.health_data}
          onToggle={() => setConsent("health_data", !consents.health_data)}
        />
      </View>
    </OnboardingChapterShell>
  );
}

/**
 * Dado de saúde exige consentimento "específico e destacado" (LGPD art. 11, I).
 * Destacado é requisito literal da lei, não preferência visual: este bloco é
 * deliberadamente diferente dos checkboxes acima — borda colorida, ícone,
 * título próprio e a lista explícita do que será coletado. Enfileirá-lo junto
 * com os outros como mais um item descaracterizaria o consentimento.
 */
function HealthDataConsent({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <View className="mt-1 rounded-2xl border-2 border-primary-200 bg-primary-50 p-4">
      <View className="flex-row items-center gap-2">
        <HeartPulse size={18} color={colors.primary[700]} />
        <Text className="flex-1 font-sans-bold text-sm text-primary-800">Dados de saúde</Text>
        {legalUrls.privacyUrl && (
          <Pressable
            onPress={() => Linking.openURL(legalUrls.privacyUrl as string)}
            accessibilityRole="link"
            accessibilityLabel="Ler como tratamos dados de saúde"
            hitSlop={8}
            className="min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <Text className="font-sans-medium text-sm text-primary-700">Ler</Text>
          </Pressable>
        )}
      </View>

      <Text className="mt-2 font-sans text-sm leading-5 text-neutral-700">
        Para estimar suas metas, guardamos peso, altura, composição corporal e as condições que você
        informar — gestação, diabetes tipo 1, doença renal e uso de medicamentos. A lei trata isso
        como dado sensível e exige que você autorize separadamente.
      </Text>

      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="Autorizo o tratamento dos meus dados de saúde"
        className="mt-3 min-h-[44px] flex-row items-center gap-3"
      >
        <View
          className={`h-6 w-6 items-center justify-center rounded-md border ${
            checked ? "border-primary-500 bg-primary-500" : "border-primary-300 bg-white"
          }`}
        >
          {checked && <Check size={16} color={colors.white} />}
        </View>
        <Text className="flex-1 font-sans-medium text-sm text-neutral-900">
          Autorizo o tratamento dos meus dados de saúde
        </Text>
      </Pressable>
    </View>
  );
}
