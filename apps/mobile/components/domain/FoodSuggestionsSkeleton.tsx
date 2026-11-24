import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";

/** Placeholder de 3 linhas no shape de `FoodAutocomplete` (nome + porção, kcal à direita). */
export function FoodSuggestionsSkeleton() {
  return (
    <View testID="food-suggestions-skeleton" className="gap-1">
      {[0, 1, 2].map((i) => (
        <View key={i} className="min-h-[44px] flex-row items-center justify-between gap-3 px-3">
          <View className="flex-1 gap-1">
            <SkeletonBlock width="65%" height={14} radius={4} />
            <SkeletonBlock width="30%" height={10} radius={3} />
          </View>
          <SkeletonBlock width={44} height={12} radius={4} />
        </View>
      ))}
    </View>
  );
}
