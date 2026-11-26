import { Text, View } from "react-native";
import type { Macros } from "@fitbrother/shared";
import { Card } from "@/components/Card";
import { MacroSplitBar } from "@/components/domain/MacroSplitBar";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function deltaText(rounded: number) {
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} kcal`;
}

type Props = { totals: Macros; deltaKcal: number; pendingNote?: string };

export function MealSummaryCard({ totals, deltaKcal, pendingNote }: Props) {
  const kcal = Math.round(totals.kcal);
  const delta = pendingNote ? 0 : Math.round(deltaKcal);
  const label = pendingNote
    ? `Total: ${kcal} kcal, ${pendingNote}`
    : delta === 0
      ? `Total: ${kcal} kcal`
      : `Total: ${kcal} kcal, ${Math.abs(delta)} kcal a ${delta > 0 ? "mais" : "menos"} que ao abrir`;

  return (
    <Card variant="elevated">
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={label}
        className="mb-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-baseline gap-1.5">
          <Text style={NUM} className="font-display-bold text-4xl text-neutral-900">
            {kcal}
          </Text>
          <Text className="font-sans-medium text-sm text-neutral-500">kcal</Text>
        </View>
        {pendingNote ? (
          <View className="rounded-full bg-warning-50 px-2.5 py-1">
            <Text className="font-sans-semibold text-xs text-warning-700">{pendingNote}</Text>
          </View>
        ) : null}
        {delta !== 0 ? (
          <View className="rounded-full bg-primary-50 px-2.5 py-1">
            <Text style={NUM} className="font-sans-semibold text-sm text-primary-700">
              {deltaText(delta)}
            </Text>
          </View>
        ) : null}
      </View>
      <MacroSplitBar protein={totals.protein_g} carbs={totals.carbs_g} fat={totals.fat_g} />
    </Card>
  );
}
