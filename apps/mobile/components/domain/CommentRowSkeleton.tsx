import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";

/**
 * Espelha o shape do `CommentRow`: avatar, balão com nome + texto, e o
 * horário abaixo do balão.
 */
export function CommentRowSkeleton() {
  return (
    <View className="flex-row gap-3 px-4 py-2">
      <SkeletonCircle size={36} />
      <View className="flex-1 items-start">
        <View className="max-w-full gap-1.5 rounded-2xl rounded-tl-md bg-neutral-100 px-3.5 py-2.5">
          <SkeletonBlock width={90} height={12} />
          <SkeletonBlock width={160} height={14} />
        </View>
        <SkeletonBlock width={40} height={10} style={{ marginLeft: 14, marginTop: 4 }} />
      </View>
    </View>
  );
}
