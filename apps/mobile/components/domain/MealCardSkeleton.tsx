import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

export function MealCardSkeleton() {
  return (
    <View style={shadows.card} className="mx-4 mt-2 gap-3 rounded-[26px] bg-white p-4">
      <View className="flex-row items-center justify-between">
        <SkeletonBlock width={140} height={16} />
        <SkeletonBlock width={48} height={14} />
      </View>
      {/* Three item rows: description (long) + quantity (short) to mirror
          the real MealCard layout — same visual rhythm while loading. */}
      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <SkeletonBlock width="60%" height={14} />
          <SkeletonBlock width={40} height={12} />
        </View>
        <View className="flex-row items-center justify-between">
          <SkeletonBlock width="45%" height={14} />
          <SkeletonBlock width={48} height={12} />
        </View>
        <View className="flex-row items-center justify-between">
          <SkeletonBlock width="55%" height={14} />
          <SkeletonBlock width={36} height={12} />
        </View>
      </View>
      <View className="h-px bg-neutral-100" />
      <SkeletonBlock width={200} height={14} />
    </View>
  );
}
