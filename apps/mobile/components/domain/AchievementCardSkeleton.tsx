import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";

/** Espelha o card de conquista de `achievements.tsx`: ícone circular + título/descrição. */
export function AchievementCardSkeleton() {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-100 p-4">
      <SkeletonCircle size={48} />
      <View className="flex-1 gap-1.5">
        <SkeletonBlock width="55%" height={15} />
        <SkeletonBlock width="80%" height={13} />
      </View>
    </View>
  );
}
