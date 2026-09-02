import { useEffect } from "react";
import { Text, View } from "react-native";
import { Flame, FlameKindling } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";

// DESIGN_SYSTEM §12.4 references duration.slower, which isn't in the motion
// tokens yet. A calm ~900ms breath reads better than the 400ms "slow" for an
// infinite pulse; kept local until the token is added.
const PULSE_MS = 900;

type StreakCounterProps = {
  current: number;
  /**
   * Within 4h of the day boundary with today not yet hit (§12.4 "em risco").
   * Wired by the alert logic in M5.3; defaults to false until then.
   */
  atRisk?: boolean;
  /** Flame icon size. Defaults to 24 (Home header desktop); mobile header passes a smaller value. */
  size?: number;
  /**
   * Altura mínima do pill. Default 44 (alvo de toque). O header da Home passa
   * 50 para casar com o avatar e a barra de abas na mesma linha.
   */
  height?: number;
};

/**
 * Streak counter (§12.4) — compact horizontal variant for the Home header.
 *
 * States:
 * - Active (current > 0, not at risk): flame streak-400 + number streak-600,
 *   infinite pulse (scale 1 ↔ 1.08).
 * - At risk: grayscale, neutral-400, no pulse.
 * - Broken (current = 0): FlameKindling + neutral-300, no pulse.
 */
export function StreakCounter({
  current,
  atRisk = false,
  size = 24,
  height = 44,
}: StreakCounterProps) {
  const broken = current === 0;
  const active = !broken && !atRisk;
  const reduced = useReducedMotion();

  const scale = useSharedValue(1);
  useEffect(() => {
    if (active && !reduced) {
      scale.value = withRepeat(
        withTiming(1.08, { duration: PULSE_MS, easing: Motion.easing.standard }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: Motion.duration.fast });
    }
  }, [active, reduced, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const iconColor = active
    ? colors.streak[400]
    : atRisk
      ? colors.neutral[400]
      : colors.neutral[300];
  const textColor = active
    ? colors.streak[600]
    : atRisk
      ? colors.neutral[400]
      : colors.neutral[300];

  return (
    <View
      style={{ minHeight: height }}
      className="flex-row items-center gap-0.5 px-1"
      accessibilityRole="text"
      accessibilityLabel={
        broken ? "Sem ofensiva" : `Ofensiva de ${current} ${current === 1 ? "dia" : "dias"}`
      }
    >
      <Animated.View style={animatedStyle}>
        {broken ? (
          <FlameKindling size={size} color={iconColor} />
        ) : (
          <Flame size={size} color={iconColor} />
        )}
      </Animated.View>
      {/* Corpo do número derivado do ícone, não fixo: quando os dois têm o
          mesmo tamanho o pill lê como um par ícone+valor, e não como um
          número-herói com um enfeite ao lado. */}
      <Text
        className="font-display-bold"
        style={{
          color: textColor,
          fontSize: size,
          lineHeight: size * 1.25,
          fontVariant: ["tabular-nums"],
        }}
      >
        {current}
      </Text>
    </View>
  );
}
