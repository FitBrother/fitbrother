import { Info } from "lucide-react-native";
import { Text, View } from "react-native";
import { GOALS_DISCLAIMER_TEXT } from "@fitbrother/shared";
import { colors } from "@/lib/colors";

export function GoalsDisclaimer() {
  return (
    <View className="flex-row items-start gap-2 rounded-2xl bg-neutral-100 p-3">
      <Info size={16} color={colors.neutral[500]} />
      <Text className="flex-1 text-xs font-sans text-neutral-600">{GOALS_DISCLAIMER_TEXT}</Text>
    </View>
  );
}
