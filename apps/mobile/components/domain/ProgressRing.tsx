import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RingColor = "protein" | "carbs" | "fat" | "calories";

type Props = {
  value: number;
  max: number | null;
  color: RingColor;
  size?: number;
  strokeWidth?: number;
  centerTop?: string;
  centerBottom?: string;
  accessibilityLabel?: string;
};

function colorFor(c: RingColor): string {
  switch (c) {
    case "protein":
      return colors.protein[500];
    case "carbs":
      return colors.carbs[500];
    case "fat":
      return colors.fat[500];
    case "calories":
      return colors.calories[500];
  }
}

export function ProgressRing({
  value,
  max,
  color,
  size = 80,
  strokeWidth = 8,
  centerTop,
  centerBottom,
  accessibilityLabel,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Progress 0..1, capped at 1. Se max for null/0, progress=0 (track-only).
  const targetProgress = !max || max <= 0 ? 0 : Math.min(value / max, 1);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(targetProgress, {
      duration: Motion.duration.slow,
      easing: Motion.easing.decelerate,
    });
  }, [progress, targetProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.neutral[100]}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorFor(color)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        {centerTop ? (
          <Text
            className={
              size >= 120
                ? "font-sans-bold text-neutral-900 text-3xl"
                : "font-sans-bold text-neutral-900 text-lg"
            }
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {centerTop}
          </Text>
        ) : null}
        {centerBottom ? (
          <Text
            className="font-sans-medium text-neutral-500 text-xs"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {centerBottom}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
