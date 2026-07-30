import { Sparkles } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { colors } from "@/lib/colors";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

export function PaywallBlock({ onNext }: OnboardingBlockProps) {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-neutral-50 px-8">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-50">
        <Sparkles size={36} color={colors.primary[400]} />
      </View>
      <Text className="text-center text-2xl font-display-bold text-neutral-800">
        Fitbrother Premium — em breve
      </Text>
      <Text className="text-center text-base font-sans text-neutral-600">
        Estamos preparando recursos extras. Por enquanto, aproveite o Fitbrother completo, de graça.
      </Text>
      <Button label="Continuar" variant="primary" onPress={onNext} />
    </View>
  );
}
