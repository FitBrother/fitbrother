import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { ConsentScope } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { Input } from "@/components/Input";
import { clampHour } from "@/lib/masks";
import { useAccountProfile } from "@/lib/hooks/useAccountProfile";
import { usePatchAccountSettings } from "@/lib/hooks/usePatchAccountSettings";
import { usePostAccountConsent } from "@/lib/hooks/usePostAccountConsent";

const FIXED_SCOPES: ConsentScope[] = ["terms", "privacy", "ai_processing"];
const TOGGLEABLE_SCOPES: ConsentScope[] = ["marketing", "data_export"];
const SCOPE_LABELS: Record<ConsentScope, string> = {
  terms: "Termos de uso",
  privacy: "Política de privacidade",
  ai_processing: "Processamento de dados por IA",
  marketing: "Comunicações de marketing",
  data_export: "Permitir exportação de dados",
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { data, isLoading } = useAccountProfile();
  const patchSettings = usePatchAccountSettings();
  const postConsent = usePostAccountConsent();
  const [dayStartHour, setDayStartHour] = useState<string | null>(null);

  const currentDayStartHour = dayStartHour ?? String(data?.profile.day_start_hour ?? 0);

  function saveDayStartHour() {
    patchSettings.mutate({ day_start_hour: clampHour(currentDayStartHour) });
  }

  function redetectTimezone() {
    patchSettings.mutate({ timezone: detectTimezone() });
  }

  function toggleConsent(scope: ConsentScope, granted: boolean) {
    postConsent.mutate({ scope, granted, policy_version: "v1.0" });
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Configurações</Text>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator className="mt-10" color={colors.primary[400]} />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-10 gap-6">
          <View className="gap-3">
            <Text className="font-sans-semibold text-sm text-neutral-500">Preferências</Text>
            <Input
              label="A que horas seu dia nutricional vira? (0-23)"
              value={currentDayStartHour}
              onChangeText={(v) => setDayStartHour(String(clampHour(v)))}
              onBlur={saveDayStartHour}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View className="rounded-xl border border-neutral-200 bg-white p-4">
              <Text className="text-sm font-sans-medium text-neutral-700">Fuso horário</Text>
              <Text className="mt-1 text-base font-sans text-neutral-800">
                {data.profile.timezone}
              </Text>
              <Pressable onPress={redetectTimezone} accessibilityRole="button">
                <Text className="mt-2 text-sm font-sans-medium text-primary-500">
                  Detectar novamente
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-3">
            <Text className="font-sans-semibold text-sm text-neutral-500">Consentimentos</Text>
            {FIXED_SCOPES.map((scope) => (
              <View
                key={scope}
                className="min-h-[52px] flex-row items-center justify-between rounded-xl border border-neutral-200 bg-neutral-100 p-3"
              >
                <Text className="flex-1 text-sm font-sans text-neutral-600">
                  {SCOPE_LABELS[scope]}
                </Text>
                <Text className="text-xs font-sans-medium text-neutral-500">
                  Concedido — obrigatório
                </Text>
              </View>
            ))}
            {TOGGLEABLE_SCOPES.map((scope) => (
              <View
                key={scope}
                className="min-h-[52px] flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white p-3"
              >
                <Text className="flex-1 text-sm font-sans text-neutral-800">
                  {SCOPE_LABELS[scope]}
                </Text>
                <Switch
                  value={data.consents[scope]?.granted ?? false}
                  onValueChange={(v) => toggleConsent(scope, v)}
                  accessibilityLabel={SCOPE_LABELS[scope]}
                />
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => router.push("/(app)/settings/privacy" as never)}
            accessibilityRole="button"
            accessibilityLabel="Dados e privacidade"
            className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <Text className="font-sans-medium text-base text-neutral-800">Dados e privacidade</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(app)/settings/about" as never)}
            accessibilityRole="button"
            accessibilityLabel="Sobre"
            className="min-h-[44px] flex-row items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <Text className="font-sans-medium text-base text-neutral-800">Sobre</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
