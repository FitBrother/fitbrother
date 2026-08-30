import { Children, useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/** Fração da largura da tela que confirma a troca de aba por distância. */
export const SWIPE_DISTANCE_RATIO = 1 / 3;
/** Velocidade (px/s) que confirma a troca mesmo sem distância suficiente. */
export const SWIPE_VELOCITY_THRESHOLD = 500;

const SPRING = { damping: 20, stiffness: 180 } as const;
/** Ignora arrastos quase verticais para não sequestrar o scroll das listas. */
const ACTIVE_OFFSET_X: [number, number] = [-12, 12];
const FAIL_OFFSET_Y: [number, number] = [-12, 12];

/**
 * Índice da aba após um gesto: troca se o arrasto passar de
 * SWIPE_DISTANCE_RATIO da largura OU se o fling for rápido o bastante.
 * Sem wrap-around — nas bordas, o índice é preservado.
 */
export function resolveIndex({
  current,
  translationX,
  velocityX,
  width,
  count,
}: {
  current: number;
  translationX: number;
  velocityX: number;
  width: number;
  count: number;
}): number {
  "worklet";
  const farEnough = Math.abs(translationX) > width * SWIPE_DISTANCE_RATIO;
  const fastEnough = Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD;
  if (!farEnough && !fastEnough) return current;

  // Distância manda quando existe; senão, a direção vem da velocidade.
  // Negativo = arrastou para a esquerda = próxima aba.
  const direction = farEnough ? (translationX < 0 ? 1 : -1) : velocityX < 0 ? 1 : -1;
  const next = current + direction;
  return Math.min(Math.max(next, 0), count - 1);
}

/**
 * Pager horizontal controlado. Não conhece o domínio — recebe o índice ativo,
 * um callback de mudança e as cenas como filhos.
 */
export function SwipeableTabs({
  index,
  onIndexChange,
  children,
}: {
  index: number;
  onIndexChange: (index: number) => void;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const scenes = Children.toArray(children);
  const count = scenes.length;

  const translateX = useSharedValue(-index * width);
  const startX = useSharedValue(0);
  // Espelho do índice em shared value: o worklet do gesto lê este valor em vez
  // de capturar a prop, evitando closure velha entre re-renders.
  const indexSV = useSharedValue(index);

  useEffect(() => {
    indexSV.value = index;
    translateX.value = withSpring(-index * width, SPRING);
  }, [index, width, indexSV, translateX]);

  const pan = Gesture.Pan()
    .activeOffsetX(ACTIVE_OFFSET_X)
    .failOffsetY(FAIL_OFFSET_Y)
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
    })
    .onEnd((e) => {
      const next = resolveIndex({
        current: indexSV.value,
        translationX: e.translationX,
        velocityX: e.velocityX,
        width,
        count,
      });
      translateX.value = withSpring(-next * width, SPRING);
      if (next !== indexSV.value) {
        indexSV.value = next;
        runOnJS(onIndexChange)(next);
      }
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View className="flex-1 flex-row" style={[{ width: width * count }, style]}>
        {scenes.map((scene, i) => (
          <View key={i} style={{ width }} className="flex-1">
            {scene}
          </View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}
