import { Pressable, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { canDecreaseQuantity } from "@/lib/quantity-step";
import { UNIT_LABEL } from "@/lib/unit-labels";
import type { ItemDraft } from "@/lib/meal-item-draft";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export function DrawerItemRow({
  item,
  hasError,
  disabled,
  onOpen,
  onStep,
}: {
  item: ItemDraft;
  hasError: boolean;
  disabled: boolean;
  onOpen: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const canDecrease = !disabled && canDecreaseQuantity(item.quantity, item.unit);
  const quantityText = `${String(item.quantity).replace(".", ",")} ${UNIT_LABEL[item.unit]}`;
  const name = item.description.trim() || "Item sem nome";

  return (
    <View
      testID="drawer-item-row"
      className={`flex-row items-center gap-2 border-b border-neutral-100 py-1 ${
        hasError ? "bg-danger-50" : ""
      }`}
    >
      <Pressable
        onPress={onOpen}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${item.description}`}
        accessibilityState={{ disabled }}
        className="min-h-[44px] flex-1 justify-center"
      >
        <Text
          numberOfLines={1}
          className={`font-sans-semibold text-base ${
            hasError ? "text-danger-500" : "text-neutral-800"
          }`}
        >
          {name}
        </Text>
        <Text style={NUM} className="font-sans text-xs text-neutral-500">
          {`${Math.round(item.kcal)} kcal`}
        </Text>
      </Pressable>

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
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Aumentar quantidade de ${item.description}`}
          accessibilityValue={{ text: quantityText }}
          accessibilityState={{ disabled }}
          className={`min-h-[44px] min-w-[44px] items-center justify-center ${
            disabled ? "opacity-40" : ""
          }`}
        >
          <Plus size={18} color={colors.neutral[700]} />
        </Pressable>
      </View>
    </View>
  );
}
