import { router } from "expo-router";
import { Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { isValidPhone, PhoneInput } from "@/components/PhoneInput";
import { ONBOARDING_STEPS } from "@/lib/constants";
import { clampHour } from "@/lib/masks";
import { useOnboardingStore } from "@/lib/stores/onboardingStore";

export default function Step7PhoneTimezone() {
  const phone_e164 = useOnboardingStore((s) => s.phone_e164);
  const timezone = useOnboardingStore((s) => s.timezone);
  const day_start_hour = useOnboardingStore((s) => s.day_start_hour);
  const setField = useOnboardingStore((s) => s.setField);

  // Phone is optional; isValidPhone() returns true for empty input.
  const phoneValid = isValidPhone(phone_e164);

  return (
    <OnboardingStepShell
      step={7}
      total={ONBOARDING_STEPS}
      title="Quase lá"
      subtitle="Telefone é opcional — usado depois pra ativar o registro via WhatsApp."
      onBack={() => router.back()}
      onNext={() => router.push("/(onboarding)/step-8")}
      nextDisabled={!phoneValid}
    >
      <View className="gap-3">
        <PhoneInput
          label="WhatsApp (opcional)"
          value={phone_e164}
          onChangeText={(v) => setField("phone_e164", v)}
          error={phoneValid ? undefined : "Número inválido"}
        />

        <View className="rounded-xl border border-neutral-200 bg-white p-4">
          <Text className="text-sm font-sans-medium text-neutral-700">Fuso horário detectado</Text>
          <Text className="mt-1 text-base font-sans text-neutral-800">{timezone}</Text>
        </View>

        <Input
          label="A que horas seu dia nutricional vira? (0-23)"
          value={String(day_start_hour)}
          onChangeText={(v) => setField("day_start_hour", clampHour(v))}
          keyboardType="number-pad"
          placeholder="0"
          maxLength={2}
        />
        <Text className="text-xs font-sans text-neutral-500">
          Refeições antes desse horário contam para o dia anterior — útil pra quem come tarde.
        </Text>
      </View>
    </OnboardingStepShell>
  );
}
