import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { MEAL_TYPE_NAME } from "./MealCard";
import { MealTimeModal, MealTypeModal, timeLabel } from "./MealMetaPickers";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type MealType = MealResponse["meal_type"];

export function MealMetaLine({
  mealType,
  consumedAt,
  onChangeMealType,
  onChangeTime,
  disabled = false,
}: {
  mealType: MealType;
  consumedAt: string;
  onChangeMealType: (t: MealType) => void;
  onChangeTime: (iso: string) => void;
  disabled?: boolean;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const typeName = MEAL_TYPE_NAME[mealType];
  const time = timeLabel(consumedAt);

  return (
    <View className={`min-h-[44px] flex-row items-center ${disabled ? "opacity-50" : ""}`}>
      <Pressable
        onPress={() => setTypeOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Tipo da refeição: ${typeName}`}
        accessibilityState={{ disabled }}
        className="min-h-[44px] justify-center"
      >
        <Text className="font-sans-medium text-sm text-neutral-600">{typeName}</Text>
      </Pressable>
      <Text className="px-1 font-sans-medium text-sm text-neutral-400">·</Text>
      <Pressable
        onPress={() => setTimeOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Horário: ${time}`}
        accessibilityState={{ disabled }}
        className="min-h-[44px] flex-row items-center gap-1 pr-2"
      >
        <Text style={NUM} className="font-sans-medium text-sm text-neutral-600">
          {time}
        </Text>
        <ChevronDown size={16} color={colors.neutral[500]} />
      </Pressable>

      <MealTypeModal
        visible={typeOpen}
        mealType={mealType}
        onSelect={onChangeMealType}
        onClose={() => setTypeOpen(false)}
      />
      <MealTimeModal
        visible={timeOpen}
        consumedAt={consumedAt}
        onChangeTime={onChangeTime}
        onClose={() => setTimeOpen(false)}
      />
    </View>
  );
}
