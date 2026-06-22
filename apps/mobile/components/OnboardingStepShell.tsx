import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
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
  /** Set to false when the step renders a VirtualizedList (e.g. WheelPicker).
      Nesting FlatList inside ScrollView breaks windowing on RN. */
  scrollable?: boolean;
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
  scrollable = true,
}: OnboardingStepShellProps) {
  const header = (
    <>
      <View className="mb-6 mt-2">
        <ProgressBar value={step} total={total} />
        <Text className="mt-2 text-xs font-sans-medium text-neutral-500">
          Passo {step} de {total}
        </Text>
      </View>

      <View className="mb-6">
        <Text className="mb-2 text-3xl font-display-bold text-neutral-800">{title}</Text>
        {subtitle && <Text className="text-base font-sans text-neutral-600">{subtitle}</Text>}
      </View>
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {scrollable ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, padding: 20 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {header}
            <View className="flex-1">{children}</View>
          </ScrollView>
        ) : (
          <View className="flex-1 p-5">
            {header}
            <View className="flex-1">{children}</View>
          </View>
        )}

        <View className="px-5 pb-4">
          <OnboardingNavButtons onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
