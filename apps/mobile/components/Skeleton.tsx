import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";

import type { DimensionValue, ViewStyle } from "react-native";

// DESIGN_SYSTEM §12.11 references duration.slower, which isn't in the motion
// tokens yet (same gap noted in StreakCounter.tsx). A calm ~1000ms breath
// reads better than the 400ms "slow" for an infinite shimmer loop; kept
// local until the token is added.
const SHIMMER_MS = 1000;

/**
 * Base shimmer block (§12.11): loops between `neutral-100` (base) and
 * `neutral-200`, Reanimated `interpolateColor`. `SkeletonText`/`SkeletonCircle`
 * compose this; use it directly for custom shapes.
 */
export function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    progress.value = withRepeat(withTiming(1, { duration: SHIMMER_MS }), -1, true);
  }, [progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: reduced
      ? colors.neutral[100]
      : interpolateColor(progress.value, [0, 1], [colors.neutral[100], colors.neutral[200]]),
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // `backgroundColor: neutral[100]` já no style base (não só no
      // `animatedStyle`): o Reanimated aplica o estilo animado um frame
      // depois do primeiro paint, e sem essa cor de partida o bloco nascia
      // transparente — deixava o que estivesse atrás (ex.: o `bg-primary-100`
      // do Avatar) aparecer por um instante antes do cinza "vestir" o
      // skeleton.
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.neutral[100] },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Placeholder circular — avatares, ícones (§12.11). */
export function SkeletonCircle({ size, style }: { size: number; style?: ViewStyle }) {
  return <SkeletonBlock width={size} height={size} radius={size / 2} style={style} />;
}

/**
 * `n` linhas de texto placeholder. A última linha encolhe (~60%) pra imitar
 * o fim natural de uma frase, a menos que `lastLineWidth` seja passado.
 */
export function SkeletonText({
  lines = 1,
  lineHeight = 14,
  gap = 8,
  lastLineWidth = "60%",
}: {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastLineWidth?: DimensionValue;
}) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock
          key={i}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : "100%"}
          height={lineHeight}
          radius={4}
        />
      ))}
    </View>
  );
}
