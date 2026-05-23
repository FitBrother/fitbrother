import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";

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
    <View className="mx-4 mt-3 gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Shimmer width={140} height={16} />
        <Shimmer width={48} height={14} />
      </View>
      <Shimmer width="90%" height={14} />
      <View className="h-px bg-neutral-100" />
      <Shimmer width={200} height={14} />
    </View>
  );
}
