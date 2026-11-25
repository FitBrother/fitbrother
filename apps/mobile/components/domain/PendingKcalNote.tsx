import { Text, View } from "react-native";
import { Clock } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { pendingKcal } from "@/lib/pending-meals";

const MEAL_TYPE_PHRASE: Record<MealResponse["meal_type"], string> = {
  breakfast: "o café da manhã",
  lunch: "o almoço",
  snack: "o lanche",
  dinner: "o jantar",
  other: "a refeição",
};

type Props = {
  meals: readonly MealResponse[];
};

export function PendingKcalNote({ meals }: Props) {
  const [only] = meals;
  if (!only) return null;

  const kcal = Math.round(pendingKcal(meals));
  const target = meals.length === 1 ? MEAL_TYPE_PHRASE[only.meal_type] : "as refeições pendentes";

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
