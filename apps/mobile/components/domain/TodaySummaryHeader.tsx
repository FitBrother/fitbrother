import { View } from "react-native";
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
        <ProgressRing
          value={protein}
          max={goalProtein}
          color="protein"
          centerTop={fmtGrams(protein)}
          centerBottom="proteína"
          accessibilityLabel={
            goalProtein
              ? `${fmtGrams(protein)} de ${fmtGrams(goalProtein)} proteína`
              : `${fmtGrams(protein)} proteína`
          }
        />
        <ProgressRing
          value={carbs}
          max={goalCarbs}
          color="carbs"
          centerTop={fmtGrams(carbs)}
          centerBottom="carboidrato"
          accessibilityLabel={
            goalCarbs
              ? `${fmtGrams(carbs)} de ${fmtGrams(goalCarbs)} carboidrato`
              : `${fmtGrams(carbs)} carboidrato`
          }
        />
        <ProgressRing
          value={fat}
          max={goalFat}
          color="fat"
          centerTop={fmtGrams(fat)}
          centerBottom="gordura"
          accessibilityLabel={
            goalFat
              ? `${fmtGrams(fat)} de ${fmtGrams(goalFat)} gordura`
              : `${fmtGrams(fat)} gordura`
          }
        />
      </View>
    </View>
  );
}
