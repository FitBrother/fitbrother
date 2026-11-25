import { Text, View } from "react-native";
import { Clock } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { pendingKcal } from "@/lib/pending-meals";
import { MEAL_TYPE_NAME } from "./MealCard";

type Props = {
  meals: readonly MealResponse[];
};

export function PendingKcalNote({ meals }: Props) {
  const [only] = meals;
  if (!only) return null;

  const kcal = Math.round(pendingKcal(meals));
  const target =
    meals.length === 1
      ? `o ${MEAL_TYPE_NAME[only.meal_type].toLowerCase()}`
      : "as refeições pendentes";

  return (
    <View className="flex-row items-center gap-1.5 px-1">
      <Clock size={14} color={colors.warning[700]} />
      <Text
        style={{ fontVariant: ["tabular-nums"] }}
        className="flex-1 text-xs font-sans-medium text-warning-700"
      >
        {`+${kcal} kcal quando você confirmar ${target}`}
      </Text>
    </View>
  );
}
