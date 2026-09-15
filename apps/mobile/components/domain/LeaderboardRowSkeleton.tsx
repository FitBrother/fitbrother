import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";

/**
 * Espelha o shape do `LeaderboardRow` (DESIGN_SYSTEM §12.13): posição, avatar
 * circular, nome, e as duas colunas numéricas de ofensiva / dias na meta.
 * Vive dentro do mesmo `ListBlock` da linha real, então repete o padding
 * `px-4 py-3`.
 */
export function LeaderboardRowSkeleton() {
  return (
    <View className="flex-row items-center px-4 py-3">
      <SkeletonBlock width={20} height={14} style={{ marginRight: 8 }} />
      <SkeletonCircle size={40} />
      <View className="ml-3 flex-1">
        <SkeletonBlock width="55%" height={15} />
      </View>
      <View className="ml-2 w-10 items-end">
        <SkeletonBlock width={24} height={14} />
      </View>
      <View className="w-10 items-end">
        <SkeletonBlock width={24} height={14} />
      </View>
    </View>
  );
}
