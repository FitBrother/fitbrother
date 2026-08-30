import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Motion } from "@/lib/motion";

// Bounce sequencial ("digitando"): cada ponto sobe e desce com um atraso
// escalonado, formando uma onda. 400ms por metade do ciclo dá um ritmo
// calmo; 140ms de defasagem é o bastante pra leitura de onda sem parecer
// que os pontos estão dessincronizados.
const BOUNCE_MS = 400;
const STAGGER_MS = 140;
const LIFT_PX = -8;
const DOT_COUNT = 3;

function BouncingDot({ index }: { index: number }) {
  const y = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    y.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(LIFT_PX, { duration: BOUNCE_MS, easing: Motion.easing.standard }),
          withTiming(0, { duration: BOUNCE_MS, easing: Motion.easing.standard }),
        ),
        -1,
        false,
      ),
    );
  }, [index, reduced, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View
      testID="loading-dot"
      className="h-3 w-3 rounded-full bg-primary-400"
      style={style}
    />
  );
}

/** Três pontos com bounce sequencial, para esperas curtas e indeterminadas. */
export function LoadingDots() {
  return (
    <View
      className="flex-row gap-2.5"
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
    >
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <BouncingDot key={i} index={i} />
      ))}
    </View>
  );
}
