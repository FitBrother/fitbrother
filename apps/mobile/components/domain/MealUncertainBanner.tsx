import { Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { colors } from "@/lib/colors";

export function MealUncertainBanner() {
  return (
    <View
      testID="meal-uncertain-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-start gap-2 rounded-2xl border-[1.5px] border-warning-500 bg-warning-50 p-4"
    >
      <AlertTriangle size={20} color={colors.warning[700]} />
      <View className="flex-1 gap-1">
        <Text className="font-sans-bold text-base text-warning-700">
          Não tive certeza de alguns itens
        </Text>
        <Text className="font-sans-medium text-sm text-warning-700">
          Confira os alimentos e as quantidades antes de confirmar.
        </Text>
      </View>
    </View>
  );
}
