import { View } from "react-native";

interface ProgressBarProps {
  value: number;
  total: number;
}

export function ProgressBar({ value, total }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, total > 0 ? value / total : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: value }}
      className="h-[3px] w-full rounded-full bg-neutral-200"
    >
      <View className="h-full rounded-full bg-primary-400" style={{ width: `${pct * 100}%` }} />
    </View>
  );
}
