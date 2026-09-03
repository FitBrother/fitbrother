import { useEffect, useMemo } from "react";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";
import { clamp01, morphEndpoints, morphHeight, morphPath } from "@/lib/morph-path";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type MorphColor = "protein" | "carbs" | "fat" | "calories";

type Props = {
  value: number;
  max: number | null;
  color: MorphColor;
  /** 0 = anel, 1 = barra. Compartilhado por todos os anéis do resumo. */
  collapse: SharedValue<number>;
  /** Largura da caixa. O anel fica centrado nela; a barra ocupa tudo. */
  width: number;
  /** Raio do anel expandido. */
  radius: number;
  strokeExpanded: number;
  strokeCollapsed: number;
  accessibilityLabel?: string;
};

function colorFor(c: MorphColor): string {
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

/**
 * Progresso que existe em dois estados: anel (expandido) e barra horizontal
 * (colapsado), com o morph contínuo entre eles vindo de `collapse`.
 *
 * A altura do container é animada e o traço encosta no topo da caixa, então
 * o SVG pode ter altura fixa (a do estado expandido) e ser recortado — nada
 * de redimensionar o SVG a cada frame.
 */
export function MorphProgress({
  value,
  max,
  color,
  collapse,
  width,
  radius,
  strokeExpanded,
  strokeCollapsed,
  accessibilityLabel,
}: Props) {
  // A barra é meia espessura mais curta que a caixa em cada ponta. Com
  // `strokeLinecap="round"` o traço se estende `sw/2` além do último ponto, e
  // indo de 0 até `width` as duas pontas caíam fora do viewport do SVG — o
  // arredondamento era cortado e a barra parecia quadrada. Encolher o extremo
  // da barra deixa as pontas inteiras dentro da caixa. Não mexe no anel: o
  // recuo só existe no `bar`, que só vale em t=1.
  const endpoints = useMemo(
    () => morphEndpoints(radius, width - strokeCollapsed, width),
    [radius, width, strokeCollapsed],
  );
  const boxHeight = 2 * radius + strokeExpanded;

  // Mesma regra do ProgressRing: sem meta, só o trilho.
  const targetProgress = !max || max <= 0 ? 0 : Math.min(value / max, 1);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(targetProgress, {
      duration: Motion.duration.slow,
      easing: Motion.easing.decelerate,
    });
  }, [progress, targetProgress]);

  // `collapse` pode passar de [0,1]: a mola que o dirige tem overshoot, de
  // propósito (ver Motion.spring.morph). A espessura é presa junto com o
  // resto da geometria para o traço não afinar além do estado colapsado no
  // repique.
  const containerStyle = useAnimatedStyle(() => {
    const t = clamp01(collapse.value);
    return {
      height: morphHeight(t, radius, strokeExpanded + (strokeCollapsed - strokeExpanded) * t),
    };
  });

  const trackProps = useAnimatedProps(() => {
    const t = clamp01(collapse.value);
    const sw = strokeExpanded + (strokeCollapsed - strokeExpanded) * t;
    return { d: morphPath(endpoints, t, 1, sw / 2), strokeWidth: sw };
  });

  const fillProps = useAnimatedProps(() => {
    const t = clamp01(collapse.value);
    const sw = strokeExpanded + (strokeCollapsed - strokeExpanded) * t;
    return { d: morphPath(endpoints, t, progress.value, sw / 2), strokeWidth: sw };
  });

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[{ width, overflow: "hidden" }, containerStyle]}
    >
      <Svg width={width} height={boxHeight}>
        <AnimatedPath
          animatedProps={trackProps}
          stroke={colors.neutral[100]}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedPath
          animatedProps={fillProps}
          stroke={colorFor(color)}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
