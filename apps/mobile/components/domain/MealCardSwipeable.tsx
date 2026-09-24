import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  SlideOutLeft,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ImageDown, Trash2 } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { MealCard, MEAL_TYPE_NAME } from "./MealCard";

/**
 * Espaço entre cards da lista, em px. É o mesmo passo do header da Home (o
 * `gap-2` entre o pill de ofensivas e a barra de abas, e o `pt-2` até o
 * dashboard) — a lista e o header andam na mesma régua.
 */
export const MEAL_CARD_GAP = 8;

/**
 * Largura revelada pelo arrasto: duas ações de 80 + as folgas laterais.
 *
 * Compartilhar mora aqui, e não num ícone no card, porque o card da Home foi
 * apertado de propósito (a faixa de macros virou a borda dele justamente para
 * economizar altura) — um botão a mais na frente desfaz isso. Atrás do arrasto
 * é onde este card já guarda ação, e é de onde a pessoa já espera que saia.
 */
const ACTION_WIDTH = 180;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.4;
// Stiffer than the default — fast snap, almost no oscillation, ~150ms settle.
const SPRING = { damping: 26, stiffness: 320, mass: 0.5 };

type Props = {
  meal: MealResponse;
  onPress?: () => void;
  onDelete: () => void;
  onShare: () => void;
};

export function MealCardSwipeable({ meal, onPress, onDelete, onShare }: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const triggerShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Fecha o arrasto: ao voltar da tela de compartilhar, o card estaria
    // aberto mostrando as ações, sem nada explicando por quê.
    translateX.value = withSpring(0, SPRING);
    onShare();
  };

  const triggerDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    // Parent removes the row from the data array; our `exiting` animation
    // plays before unmount, and `itemLayoutAnimation` on the FlatList shifts
    // the remaining cards up with a spring.
    onDelete();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      // Clamp so the card can't be dragged to the right past resting position.
      // Slight overshoot allowed on the left for natural rubber-band feel.
      const next = startX.value + e.translationX;
      translateX.value = Math.min(0, next);
    })
    .onEnd(() => {
      if (translateX.value < -OPEN_THRESHOLD) {
        translateX.value = withSpring(-ACTION_WIDTH, SPRING);
      } else {
        translateX.value = withSpring(0, SPRING);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, -translateX.value / ACTION_WIDTH));
    return {
      opacity: progress,
      transform: [{ scale: interpolate(progress, [0, 1], [0.7, 1]) }],
    };
  });

  return (
    <Animated.View
      style={{ marginHorizontal: 16, marginTop: MEAL_CARD_GAP }}
      entering={FadeIn.duration(180)}
      exiting={SlideOutLeft.springify().damping(20).stiffness(180)}
    >
      <View>
        {/* Actions behind the card, revealed by the drag. Centered vertically
            by the absolute container; aligned to the card's right edge. */}
        <View
          style={{ pointerEvents: "box-none" }}
          className="absolute inset-0 flex-row items-center justify-end gap-2 pr-1"
        >
          <Animated.View style={actionStyle}>
            <Pressable
              onPress={triggerShare}
              // Nomeia a refeição em vez de dizer "desta": um leitor de tela
              // percorre a lista inteira, e três cards abertos anunciando o
              // mesmo rótulo não dizem de qual refeição é cada botão.
              accessibilityLabel={`Gerar imagem de ${MEAL_TYPE_NAME[meal.meal_type]}`}
              accessibilityRole="button"
              className="h-20 w-20 items-center justify-center rounded-2xl bg-primary-400 active:bg-primary-500"
            >
              <ImageDown size={22} color={colors.white} />
              <Text className="mt-1 text-xs font-sans-semibold text-white">Imagem</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={actionStyle}>
            <Pressable
              onPress={triggerDelete}
              accessibilityLabel="Excluir refeição"
              accessibilityRole="button"
              className="h-20 w-20 items-center justify-center rounded-2xl bg-danger-500 active:bg-danger-600"
            >
              <Trash2 size={22} color={colors.white} />
              <Text className="mt-1 text-xs font-sans-semibold text-white">Excluir</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Foreground card. The Pan gesture lives on this layer so taps still
            propagate to MealCard's Pressable. touchAction="pan-y" (web
            only): without it this GestureDetector defaults to
            touch-action:none on its DOM node, blocking the FlatList's
            native vertical scroll under almost the whole row — same fix
            as SwipeableTabs (5930b23), needed on every nested
            GestureDetector, not just the outer pager. */}
        <GestureDetector gesture={pan} touchAction="pan-y">
          <Animated.View style={cardStyle}>
            <MealCard meal={meal} onPress={onPress} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
