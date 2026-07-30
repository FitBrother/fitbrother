import * as Notifications from "expo-notifications";
import { Bell } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { OnboardingStepShell } from "@/components/OnboardingStepShell";
import { colors } from "@/lib/colors";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function PermissionsBlock({ step, total, onNext, onBack, onSkip }: OnboardingBlockProps) {
  async function handleEnable() {
    try {
      await Notifications.requestPermissionsAsync();
    } finally {
      onNext();
    }
  }

  return (
    <OnboardingStepShell step={step} total={total} title="Notificações" onBack={onBack}>
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-50">
          <Bell size={36} color={colors.primary[400]} />
        </View>
        <Text className="text-center text-base font-sans text-neutral-600">
          Avisamos quando bater sua meta do dia e quando sua ofensiva estiver em risco.
        </Text>
        <Button label="Ativar notificações" variant="primary" onPress={handleEnable} />
        {onSkip && (
          <Text
            onPress={onSkip}
            accessibilityRole="button"
            className="text-center text-sm font-sans-medium text-neutral-500"
          >
            Agora não
          </Text>
        )}
      </View>
    </OnboardingStepShell>
  );
}
