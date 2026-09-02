import { Pressable, Text, View } from "react-native";
import { ScanBarcode } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { shadows } from "@/lib/shadows";
import { colors } from "@/lib/colors";

const MEAL_TYPE_LABEL: Record<MealResponse["meal_type"], string> = {
  breakfast: "🍳 Café da manhã",
  lunch: "🍽 Almoço",
  snack: "🥪 Lanche",
  dinner: "🌙 Jantar",
  other: "🍴 Refeição",
};

// Per CLAUDE.md, only the home view truncates — the detail screen shows
// every item. Three rows is the sweet spot in card design: enough context
// to recognize the meal at a glance, short enough to stack ~4 cards per
// viewport on a phone.
const MAX_ITEMS_ON_CARD = 3;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

const UNIT_LABEL: Record<MealResponse["items"][number]["unit"], (q: number) => string> = {
  g: (q) => `${formatQty(q)} g`,
  ml: (q) => `${formatQty(q)} ml`,
  unit: (q) => formatQty(q),
  slice: (q) => `${formatQty(q)} ${q === 1 ? "fatia" : "fatias"}`,
  cup: (q) => `${formatQty(q)} ${q === 1 ? "xícara" : "xícaras"}`,
  tbsp: (q) => `${formatQty(q)} c. sopa`,
  tsp: (q) => `${formatQty(q)} c. chá`,
};

function formatQty(q: number): string {
  return Number.isInteger(q) ? q.toString() : q.toFixed(1).replace(/\.0$/, "");
}

function formatItemQuantity(item: MealResponse["items"][number]): string {
  return UNIT_LABEL[item.unit](item.quantity);
}

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type Props = {
  meal: MealResponse;
  onPress?: () => void;
};

export function MealCard({ meal, onPress }: Props) {
  const isReview = meal.review_required;
  const visibleItems = meal.items.slice(0, MAX_ITEMS_ON_CARD);
  const hiddenCount = Math.max(0, meal.items.length - MAX_ITEMS_ON_CARD);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Refeição ${MEAL_TYPE_LABEL[meal.meal_type]}, ${Math.round(meal.total_kcal)} kcal, ${meal.items.length} ${meal.items.length === 1 ? "item" : "itens"}`}
      style={shadows.card}
      className={[
        "rounded-[26px] bg-white p-4 active:opacity-70",
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
          {meal.source === "app_barcode" && <ScanBarcode size={14} color={colors.neutral[400]} />}
          <Text style={NUM} className="text-sm font-sans text-neutral-500">
            {formatTime(meal.consumed_at)}
          </Text>
        </View>
      </View>

      <View className="mt-2 gap-0.5">
        {visibleItems.length === 0 ? (
          <Text className="text-base font-sans-medium text-neutral-400">—</Text>
        ) : (
          visibleItems.map((item) => (
            <View key={item.id} className="flex-row items-baseline justify-between gap-3">
              <Text
                numberOfLines={1}
                className="flex-1 text-base font-sans-medium text-neutral-800"
              >
                {item.description}
              </Text>
              <Text style={NUM} className="text-sm font-sans text-neutral-500">
                {formatItemQuantity(item)}
              </Text>
            </View>
          ))
        )}
        {hiddenCount > 0 && (
          <Text className="mt-0.5 text-sm font-sans text-neutral-400">
            + {hiddenCount} {hiddenCount === 1 ? "item" : "itens"}
          </Text>
        )}
      </View>

      <View className="my-3 h-px bg-neutral-100" />
      <Text style={NUM} className="text-sm font-sans text-neutral-500">
        {Math.round(meal.total_kcal)} kcal · {Math.round(meal.total_protein_g)}g P ·{" "}
        {Math.round(meal.total_carbs_g)}g C · {Math.round(meal.total_fat_g)}g G
      </Text>
    </Pressable>
  );
}
