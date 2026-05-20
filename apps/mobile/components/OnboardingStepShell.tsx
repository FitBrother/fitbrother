import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingNavButtons } from "@/components/OnboardingNavButtons";
import { ProgressBar } from "@/components/ProgressBar";

interface OnboardingStepShellProps {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
}

export function OnboardingStepShell({
  step,
  total,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextDisabled,
}: OnboardingStepShellProps) {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-1 p-5">
        <View className="mb-6 mt-2">
          <ProgressBar value={step} total={total} />
          <Text className="mt-2 text-xs font-sans-medium text-neutral-500">
            Passo {step} de {total}
          </Text>
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-3xl font-sans-extrabold text-neutral-800">{title}</Text>
          {subtitle && <Text className="text-base font-sans text-neutral-600">{subtitle}</Text>}
        </View>

        <View className="flex-1">{children}</View>

        <View className="mt-4">
          <OnboardingNavButtons onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} />
        </View>
      </View>
    </SafeAreaView>
  );
}
