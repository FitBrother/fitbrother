import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";

/**
 * Espelha o RevealBlock (metas prontas): kcal grande e centralizado + linha
 * com proteína/carbo/gordura embaixo — mesmo ritmo visual do card real, sem
 * as caixas soltas de um "card" genérico.
 */
export function PlanResultSkeleton() {
  return (
    <View className="items-center gap-6 py-12">
      <SkeletonBlock width={180} height={48} radius={12} />
      <View className="flex-row gap-6">
        <SkeletonBlock width={72} height={16} />
        <SkeletonBlock width={72} height={16} />
        <SkeletonBlock width={72} height={16} />
      </View>
    </View>
  );
}
