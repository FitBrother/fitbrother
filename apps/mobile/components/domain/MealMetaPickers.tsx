import { Modal, Pressable, Text, View } from "react-native";
import type { MealResponse } from "@fitbrother/shared";
import { shadows } from "@/lib/shadows";
import { MEAL_TYPE_OPTIONS, withTime } from "@/lib/meal-meta";
import { MEAL_TYPE_NAME } from "./MealCard";
import { TimePicker } from "./TimePicker";

type MealType = MealResponse["meal_type"];

// Mirrors TimePicker's initial rounding to its 5-minute wheel.
function pickerMinute(minute: number): number {
  return Math.min(55, Math.round(minute / 5) * 5);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function timeLabel(consumedAt: string): string {
  const date = new Date(consumedAt);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MealTypeModal({
  visible,
  mealType,
  onSelect,
  onClose,
}: {
  visible: boolean;
  mealType: MealType;
  onSelect: (t: MealType) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
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
                  onSelect(type);
                  onClose();
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
  );
}

export function MealTimeModal({
  visible,
  consumedAt,
  onChangeTime,
  onClose,
}: {
  visible: boolean;
  consumedAt: string;
  onChangeTime: (iso: string) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  const date = new Date(consumedAt);
  const hour = date.getHours();
  const minute = date.getMinutes();
  return (
    <TimePicker
      visible
      initialHour={hour}
      initialMinute={minute}
      onCancel={onClose}
      onConfirm={(h, m) => {
        onClose();
        if (h === hour && m === pickerMinute(minute)) return;
        onChangeTime(withTime(consumedAt, h, m));
      }}
    />
  );
}
