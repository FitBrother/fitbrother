import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

import type { DimensionValue } from "react-native";

function Shimmer({ width, height }: { width: DimensionValue; height: number }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: 8, backgroundColor: colors.neutral[200] }, style]}
    />
  );
}

export function MealCardSkeleton() {
  return (
    <View style={shadows.card} className="mx-4 mt-2 gap-3 rounded-[25px] bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Shimmer width={140} height={16} />
        <Shimmer width={48} height={14} />
      </View>
      {/* Three item rows: description (long) + quantity (short) to mirror
          the real MealCard layout — same visual rhythm while loading. */}
      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Shimmer width="60%" height={14} />
          <Shimmer width={40} height={12} />
        </View>
        <View className="flex-row items-center justify-between">
          <Shimmer width="45%" height={14} />
          <Shimmer width={48} height={12} />
        </View>
        <View className="flex-row items-center justify-between">
          <Shimmer width="55%" height={14} />
          <Shimmer width={36} height={12} />
        </View>
      </View>
      <View className="h-px bg-neutral-100" />
      <Shimmer width={200} height={14} />
    </View>
  );
}
