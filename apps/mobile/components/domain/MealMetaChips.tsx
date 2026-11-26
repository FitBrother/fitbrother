import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, Clock, Utensils } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { MEAL_TYPE_NAME } from "./MealCard";
import { MealTimeModal, MealTypeModal, timeLabel as formatTime } from "./MealMetaPickers";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type MealType = MealResponse["meal_type"];

type Props = {
  mealType: MealType;
  consumedAt: string;
  onChangeMealType: (t: MealType) => void;
  onChangeTime: (iso: string) => void;
  disabled?: boolean;
};

function Chip({
  icon,
  label,
  accessibilityLabel,
  onPress,
  numeric,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  numeric?: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      className={`h-11 flex-row items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {icon}
      <Text
        style={numeric ? NUM : undefined}
        className="font-sans-semibold text-sm text-neutral-800"
      >
        {label}
      </Text>
      <ChevronDown size={16} color={colors.neutral[500]} />
    </Pressable>
  );
}

export function MealMetaChips({
  mealType,
  consumedAt,
  onChangeMealType,
  onChangeTime,
  disabled = false,
}: Props) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const timeLabel = formatTime(consumedAt);
  const typeName = MEAL_TYPE_NAME[mealType];

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Chip
        icon={<Utensils size={16} color={colors.neutral[700]} />}
        label={typeName}
        accessibilityLabel={`Tipo da refeição: ${typeName}`}
        onPress={() => setTypeOpen(true)}
        disabled={disabled}
      />
      <Chip
        icon={<Clock size={16} color={colors.neutral[700]} />}
        label={timeLabel}
        accessibilityLabel={`Horário: ${timeLabel}`}
        onPress={() => setTimeOpen(true)}
        numeric
        disabled={disabled}
      />

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
