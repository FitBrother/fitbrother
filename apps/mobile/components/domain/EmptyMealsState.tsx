import { Text, View } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";
import { colors } from "@/lib/colors";

export function EmptyMealsState() {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <UtensilsCrossed size={64} color={colors.neutral[300]} />
      <Text className="text-center text-lg font-sans-bold text-neutral-800">
        Nenhuma refeição hoje
      </Text>
      <Text className="text-center text-sm font-sans text-neutral-500">
        Diga sua primeira refeição lá embaixo ↓
      </Text>
    </View>
  );
}
