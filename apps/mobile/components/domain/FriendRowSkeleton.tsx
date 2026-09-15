import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";

/**
 * Espelha o shape de uma linha de "Seguindo": avatar + nome à esquerda, ação
 * ("Deixar de seguir") à direita. Mais simples que `LeaderboardRowSkeleton`
 * — sem posição nem colunas numéricas — por isso não reaproveitada dali.
 */
export function FriendRowSkeleton() {
  return (
    <View className="min-h-[44px] flex-row items-center justify-between px-4 py-2">
      <View className="flex-1 flex-row items-center">
        <SkeletonCircle size={36} />
        <View className="ml-3 flex-1 pr-3">
          <SkeletonBlock width="50%" height={14} />
        </View>
      </View>
      <SkeletonBlock width={90} height={14} />
    </View>
  );
}
