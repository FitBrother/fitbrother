import { Sparkles } from "lucide-react-native";
import { View } from "react-native";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { colors } from "@/lib/colors";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function PaywallBlock({ onNext, chapter }: OnboardingBlockProps) {
  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Fitbrother Premium — em breve"
      subtitle="Estamos preparando recursos extras. Por enquanto, aproveite o Fitbrother completo, de graça."
      onNext={onNext}
    >
      <View className="flex-1 items-center justify-center py-8">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-50">
          <Sparkles size={36} color={colors.primary[400]} />
        </View>
      </View>
    </OnboardingChapterShell>
  );
}
