import { Pressable, Text, View } from "react-native";
import type { MealResponse } from "@fitbrother/shared";

const MEAL_TYPE_LABEL: Record<MealResponse["meal_type"], string> = {
  breakfast: "🍳 Café da manhã",
  lunch: "🍽 Almoço",
  snack: "🥪 Lanche",
  dinner: "🌙 Jantar",
  other: "🍴 Refeição",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function summarizeItems(items: MealResponse["items"]): string {
  if (items.length === 0) return "—";
  return items.map((i) => i.description).join(" · ");
}

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type Props = {
  meal: MealResponse;
  onPress?: () => void;
};

export function MealCard({ meal, onPress }: Props) {
  const isReview = meal.review_required;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Refeição ${MEAL_TYPE_LABEL[meal.meal_type]}, ${Math.round(meal.total_kcal)} kcal`}
      className={[
        "mx-4 mt-3 rounded-2xl bg-white p-4 shadow-sm",
        isReview ? "border-[1.5px] border-warning-500" : "",
      ].join(" ")}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-sans-semibold text-neutral-800">
          {MEAL_TYPE_LABEL[meal.meal_type]}
        </Text>
        <View className="flex-row items-center gap-2">
          {isReview && (
            <View className="rounded-full bg-warning-50 px-2 py-0.5">
              <Text className="text-xs font-sans-semibold text-warning-500">Revisar</Text>
            </View>
          )}
          <Text style={NUM} className="text-sm font-sans text-neutral-500">
            {formatTime(meal.consumed_at)}
          </Text>
        </View>
      </View>
      <Text numberOfLines={2} className="mt-1 text-base font-sans-medium text-neutral-800">
        {summarizeItems(meal.items)}
      </Text>
      <View className="my-3 h-px bg-neutral-100" />
      <Text style={NUM} className="text-sm font-sans text-neutral-500">
        {Math.round(meal.total_kcal)} kcal · {Math.round(meal.total_protein_g)}g P ·{" "}
        {Math.round(meal.total_carbs_g)}g C · {Math.round(meal.total_fat_g)}g G
      </Text>
    </Pressable>
  );
}
