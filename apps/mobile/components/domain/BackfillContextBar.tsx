import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useProfile } from "@/lib/profile/profile-context";
import { getTimeOfDayIso, setTimeOfDayIso } from "@/lib/dateMath";
import { colors } from "@/lib/colors";
import { TimePicker } from "./TimePicker";

type Props = {
  day: string;
  consumedAt: string;
  onChangeConsumedAt: (iso: string) => void;
};

function formatDayLong(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatHHMM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function BackfillContextBar({ day, consumedAt, onChangeConsumedAt }: Props) {
  const profile = useProfile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { hour, minute } = getTimeOfDayIso(consumedAt, profile);

  return (
    <View className="mx-4 mt-2 flex-row items-center justify-between rounded-xl bg-neutral-100 px-3 py-2">
      <Text className="text-sm font-sans-medium text-neutral-700">{formatDayLong(day)}</Text>
      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityLabel="Ajustar horário"
        accessibilityRole="button"
        className="min-h-[44px] flex-row items-center gap-1 px-2"
      >
        <Text
          className="text-sm font-sans-semibold text-neutral-800"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {formatHHMM(hour, minute)}
        </Text>
        <ChevronDown size={16} color={colors.neutral[600]} />
      </Pressable>
      <TimePicker
        visible={pickerOpen}
        initialHour={hour}
        initialMinute={minute}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(h, m) => {
          onChangeConsumedAt(setTimeOfDayIso(consumedAt, profile, h, m));
          setPickerOpen(false);
        }}
      />
    </View>
  );
}
