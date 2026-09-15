import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";
import { Card } from "@/components/Card";
import { MealCardSkeleton } from "@/components/domain/MealCardSkeleton";
import { SUMMARY } from "@/lib/summary-geometry";

/**
 * Placeholder de tela cheia para o primeiro carregamento do dia (antes de
 * `mealsQuery`/`summaryQuery` terem qualquer dado). Espelha o shape real da
 * Home: o anel de calorias + as três barras de macro de `TodaySummaryHeader`
 * (ver `SUMMARY` em `lib/summary-geometry.ts` pros raios), seguido de algumas
 * `MealCardSkeleton` no lugar da lista de refeições.
 */
export function HomeSkeleton() {
  const kcalSize = SUMMARY.kcal.radius * 2;
  const macroSize = SUMMARY.macro.radius * 2;

  return (
    <View className="flex-1 bg-neutral-50">
      <View className="gap-2 px-4 pb-4 pt-2">
        <Card variant="elevated">
          <View className="items-center gap-2 py-2">
            <SkeletonCircle size={kcalSize} />
            <SkeletonBlock width={80} height={12} radius={4} style={{ marginTop: 8 }} />
          </View>
          <View className="mt-6 flex-row justify-around">
            {[0, 1, 2].map((i) => (
              <View key={i} className="items-center gap-2">
                <SkeletonCircle size={macroSize} />
                <SkeletonBlock width={56} height={11} radius={4} />
              </View>
            ))}
          </View>
        </Card>
      </View>
      <MealCardSkeleton />
      <MealCardSkeleton />
      <MealCardSkeleton />
    </View>
  );
}
