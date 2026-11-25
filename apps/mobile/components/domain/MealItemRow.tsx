import { Pressable, Text, View } from "react-native";
import { Minus, Pencil, Plus } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { canDecreaseQuantity } from "@/lib/quantity-step";
import { UNIT_LABEL } from "@/lib/unit-labels";
import type { ItemDraft } from "@/lib/meal-item-draft";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function formatQuantity(item: ItemDraft) {
  return `${String(item.quantity).replace(".", ",")} ${UNIT_LABEL[item.unit]}`;
}

export function MealItemRow({
  item,
  hasError,
  onOpen,
  onStep,
}: {
  item: ItemDraft;
  hasError: boolean;
  onOpen: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const canDecrease = canDecreaseQuantity(item.quantity, item.unit);
  const quantityText = formatQuantity(item);
  const showAdjusted = item.adjusted && item.link.mode !== "none";

  return (
    <View
      testID="meal-item-row"
      style={shadows.card}
      className={`flex-row items-center gap-2 rounded-[26px] bg-white py-2 pl-4 pr-2 ${
        hasError ? "border border-danger-500" : ""
      }`}
    >
      <View className="flex-1">
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${item.description}`}
          className="min-h-[44px] flex-row items-center gap-1.5"
        >
          <Text numberOfLines={1} className="shrink font-sans-semibold text-base text-neutral-800">
            {item.description}
          </Text>
          <Pencil size={14} color={colors.neutral[400]} />
        </Pressable>
        <View className="-mt-1 flex-row items-center gap-2 pb-1">
          <Text style={NUM} className="font-sans text-sm text-neutral-500">
            {Math.round(item.kcal)} kcal
          </Text>
          {showAdjusted ? (
            <View className="rounded-full bg-warning-50 px-2 py-0.5">
              <Text className="font-sans-medium text-xs text-warning-700">Ajustado</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center rounded-full bg-neutral-100">
        <Pressable
          onPress={() => onStep(-1)}
          disabled={!canDecrease}
          accessibilityRole="button"
          accessibilityLabel={`Diminuir quantidade de ${item.description}`}
          accessibilityValue={{ text: quantityText }}
          accessibilityState={{ disabled: !canDecrease }}
          className={`min-h-[44px] min-w-[44px] items-center justify-center ${
            canDecrease ? "" : "opacity-40"
          }`}
        >
          <Minus size={18} color={colors.neutral[700]} />
        </Pressable>
        <Text
          style={NUM}
          className="min-w-[48px] text-center font-sans-semibold text-sm text-neutral-800"
        >
          {quantityText}
        </Text>
        <Pressable
          onPress={() => onStep(1)}
          accessibilityRole="button"
          accessibilityLabel={`Aumentar quantidade de ${item.description}`}
          accessibilityValue={{ text: quantityText }}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Plus size={18} color={colors.neutral[700]} />
        </Pressable>
      </View>
    </View>
  );
}
