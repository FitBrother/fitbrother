import { Text, View } from "react-native";
import type { DailySummary } from "@fitbrother/shared";
import { ProgressRing } from "./ProgressRing";

type Props = {
  summary: DailySummary | undefined;
};

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

function fmtGrams(n: number): string {
  return `${Math.round(n)}g`;
}

type MacroRingProps = {
  value: number;
  max: number | null;
  color: "protein" | "carbs" | "fat";
  label: string;
};

function MacroRing({ value, max, color, label }: MacroRingProps) {
  return (
    <View className="items-center gap-2">
      <ProgressRing
        value={value}
        max={max}
        color={color}
        centerTop={fmtGrams(value)}
        centerBottom={max ? `/ ${fmtGrams(max)}` : undefined}
        accessibilityLabel={
          max ? `${fmtGrams(value)} de ${fmtGrams(max)} ${label}` : `${fmtGrams(value)} ${label}`
        }
      />
      <Text
        className="font-sans-medium text-neutral-500 text-xs"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {label}
      </Text>
    </View>
  );
}

export function TodaySummaryHeader({ summary }: Props) {
  // Loading state: rings em 0 + meta nula. Sem animação até dados chegarem.
  const kcal = summary?.kcal ?? 0;
  const protein = summary?.protein_g ?? 0;
  const carbs = summary?.carbs_g ?? 0;
  const fat = summary?.fat_g ?? 0;
  const goalKcal = summary?.goal_kcal ?? null;
  const goalProtein = summary?.goal_protein_g ?? null;
  const goalCarbs = summary?.goal_carbs_g ?? null;
  const goalFat = summary?.goal_fat_g ?? null;

  return (
    <View className="px-6 pt-4 pb-6 items-center gap-6">
      <ProgressRing
        value={kcal}
        max={goalKcal}
        color="calories"
        size={160}
        strokeWidth={14}
        centerTop={fmtInt(kcal)}
        centerBottom={goalKcal ? `/ ${fmtInt(goalKcal)} kcal` : "kcal"}
        accessibilityLabel={
          goalKcal ? `${fmtInt(kcal)} de ${fmtInt(goalKcal)} calorias` : `${fmtInt(kcal)} calorias`
        }
      />
      <View className="flex-row justify-around w-full px-2">
        <MacroRing value={protein} max={goalProtein} color="protein" label="proteína" />
        <MacroRing value={carbs} max={goalCarbs} color="carbs" label="carboidrato" />
        <MacroRing value={fat} max={goalFat} color="fat" label="gordura" />
      </View>
    </View>
  );
}
