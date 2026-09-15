import { View } from "react-native";
import { SkeletonBlock, SkeletonText } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Espelha o shape do `InsightCard`: título + score, headline, lista de
 * bullets, e o botão "Exportar imagem" no rodapé.
 */
export function InsightCardSkeleton() {
  return (
    <View style={shadows.card} className="rounded-[26px] bg-white p-4">
      <View className="flex-row items-center justify-between">
        <SkeletonBlock width="60%" height={18} />
        <SkeletonBlock width={28} height={16} style={{ marginLeft: 12 }} />
      </View>
      <View className="mt-2">
        <SkeletonBlock width="85%" height={14} />
      </View>
      <View className="mt-3">
        <SkeletonText lines={3} lineHeight={13} gap={6} lastLineWidth="70%" />
      </View>
      <SkeletonBlock width={148} height={36} radius={18} style={{ marginTop: 12 }} />
    </View>
  );
}
