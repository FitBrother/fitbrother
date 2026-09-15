import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Espelha o shape do `PostCard`: cabeçalho (avatar + nome + username + hora),
 * legenda, kcal + barra de macros, e a linha de ações (curtir/comentar/
 * compartilhar) no rodapé.
 */
export function FeedPostSkeleton() {
  return (
    <View style={shadows.card} className="rounded-[26px] bg-white p-4">
      <View className="flex-row items-center">
        <SkeletonCircle size={44} />
        <View className="ml-3 flex-1 gap-1.5">
          <SkeletonBlock width="45%" height={14} />
          <SkeletonBlock width="30%" height={12} />
        </View>
        <SkeletonBlock width={28} height={12} />
      </View>

      <View className="mt-3">
        <SkeletonBlock width="80%" height={14} />
      </View>

      <View className="mt-4 gap-3">
        <View className="flex-row items-baseline gap-1.5">
          <SkeletonBlock width={48} height={18} />
          <SkeletonBlock width={28} height={12} />
        </View>
        <SkeletonBlock width="100%" height={10} radius={5} />
      </View>

      <View className="mt-4 flex-row items-center gap-4 border-t border-neutral-100 pt-3">
        <SkeletonBlock width={44} height={20} />
        <SkeletonBlock width={60} height={20} />
      </View>
    </View>
  );
}
