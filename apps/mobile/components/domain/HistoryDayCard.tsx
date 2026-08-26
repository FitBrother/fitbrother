import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Flame } from "lucide-react-native";
import type { DailySummary } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { MacroBar } from "./MacroBar";

type Props = {
  summary: DailySummary;
  softMode?: boolean;
};

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

function formatDayHeader(day: string): string {
  // day = "YYYY-MM-DD" — usa UTC anchor pra evitar shift de fuso.
  const d = new Date(day + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function streakColor(): string {
  return colors.streak[500];
}

export function HistoryDayCard({ summary, softMode = false }: Props) {
  const router = useRouter();
  const heroLabel = summary.goal_kcal
    ? `${fmtInt(summary.kcal)} / ${fmtInt(summary.goal_kcal)} kcal`
    : `${fmtInt(summary.kcal)} kcal`;
  const mealsLabel = `${summary.meals_count} ${summary.meals_count === 1 ? "refeição" : "refeições"}`;

  return (
    <View className="mx-4 mt-3">
      <Text className="ml-1 mb-2 text-xs font-sans-semibold uppercase text-neutral-500">
        {formatDayHeader(summary.day)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes de ${formatDayHeader(summary.day)}, ${softMode ? mealsLabel : heroLabel}, ${mealsLabel}`}
        onPress={() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push({ pathname: "/(app)/history/[day]" as any, params: { day: summary.day } })
        }
        style={shadows.card}
        className="rounded-2xl bg-white p-4 active:opacity-80"
      >
        <View className="flex-row items-center justify-between">
          {softMode ? (
            <Text style={NUM} className="text-xl font-display-bold text-neutral-800">
              {mealsLabel}
            </Text>
          ) : (
            <Text style={NUM} className="text-xl font-display-bold text-neutral-800">
              {heroLabel}
            </Text>
          )}
          <View className="flex-row items-center gap-1.5">
            {summary.goal_hit ? <Flame size={14} color={streakColor()} /> : null}
            {!softMode && (
              <Text className="text-xs font-sans-medium text-neutral-500" style={NUM}>
                {mealsLabel}
              </Text>
            )}
          </View>
        </View>
        {!softMode && (
          <View className="mt-3 gap-1.5">
            <MacroBar
              value={summary.protein_g}
              max={summary.goal_protein_g}
              color="protein"
              label="Prot"
            />
            <MacroBar
              value={summary.carbs_g}
              max={summary.goal_carbs_g}
              color="carbs"
              label="Carb"
            />
            <MacroBar value={summary.fat_g} max={summary.goal_fat_g} color="fat" label="Gord" />
          </View>
        )}
      </Pressable>
    </View>
  );
}
