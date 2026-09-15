import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Espelha o shape de `HistoryDayCard`: rótulo do dia acima do card, linha
 * hero (kcal / contagem de refeições) e três barras de macro.
 */
export function HistoryDayCardSkeleton() {
  return (
    <View className="mx-4 mt-3 flex-1">
      <SkeletonBlock width={96} height={12} radius={4} style={{ marginLeft: 4, marginBottom: 8 }} />
      <View style={shadows.card} className="gap-3 rounded-[26px] bg-white p-4">
        <View className="flex-row items-center justify-between">
          <SkeletonBlock width={120} height={20} />
          <SkeletonBlock width={64} height={12} />
        </View>
        <View className="gap-1.5">
          <SkeletonBlock width="100%" height={8} radius={4} />
          <SkeletonBlock width="100%" height={8} radius={4} />
          <SkeletonBlock width="100%" height={8} radius={4} />
        </View>
      </View>
    </View>
  );
}
