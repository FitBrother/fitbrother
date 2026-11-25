import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { ChevronDown, Clock, Utensils } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { MEAL_TYPE_OPTIONS, withTime } from "@/lib/meal-meta";
import { MEAL_TYPE_NAME } from "./MealCard";
import { TimePicker } from "./TimePicker";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

type MealType = MealResponse["meal_type"];

type Props = {
  mealType: MealType;
  consumedAt: string;
  onChangeMealType: (t: MealType) => void;
  onChangeTime: (iso: string) => void;
};

// Mirrors TimePicker's initial rounding to its 5-minute wheel.
function pickerMinute(minute: number): number {
  return Math.min(55, Math.round(minute / 5) * 5);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Chip({
  icon,
  label,
  accessibilityLabel,
  onPress,
  numeric,
}: {
  icon: React.ReactNode;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  numeric?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-11 flex-row items-center gap-2 rounded-full border border-neutral-200 bg-white px-4"
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

export function MealMetaChips({ mealType, consumedAt, onChangeMealType, onChangeTime }: Props) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const date = new Date(consumedAt);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeLabel = `${pad(hour)}:${pad(minute)}`;
  const typeName = MEAL_TYPE_NAME[mealType];

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Chip
        icon={<Utensils size={16} color={colors.neutral[700]} />}
        label={typeName}
        accessibilityLabel={`Tipo da refeição: ${typeName}`}
        onPress={() => setTypeOpen(true)}
      />
      <Chip
        icon={<Clock size={16} color={colors.neutral[700]} />}
        label={timeLabel}
        accessibilityLabel={`Horário: ${timeLabel}`}
        onPress={() => setTimeOpen(true)}
        numeric
      />

      <Modal
        visible={typeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypeOpen(false)}
      >
        <Pressable
          onPress={() => setTypeOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Fechar lista de tipos"
          className="flex-1 items-center justify-center bg-black/40 px-6"
        >
          <View
            style={shadows.card}
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white py-2"
            onStartShouldSetResponder={() => true}
          >
            {MEAL_TYPE_OPTIONS.map((type) => {
              const selected = type === mealType;
              return (
                <Pressable
                  key={type}
                  onPress={() => {
                    onChangeMealType(type);
                    setTypeOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={MEAL_TYPE_NAME[type]}
                  accessibilityState={{ selected }}
                  className="min-h-[44px] justify-center px-5"
                >
                  <Text
                    className={`text-base ${
                      selected
                        ? "font-sans-semibold text-primary-700"
                        : "font-sans-medium text-neutral-800"
                    }`}
                  >
                    {MEAL_TYPE_NAME[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {timeOpen ? (
        <TimePicker
          visible
          initialHour={hour}
          initialMinute={minute}
          onCancel={() => setTimeOpen(false)}
          onConfirm={(h, m) => {
            setTimeOpen(false);
            if (h === hour && m === pickerMinute(minute)) return;
            onChangeTime(withTime(consumedAt, h, m));
          }}
        />
      ) : null}
    </View>
  );
}
