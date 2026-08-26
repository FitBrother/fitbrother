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
import { Trash2 } from "lucide-react-native";
import type { MealResponse } from "@fitbrother/shared";
import { colors } from "@/lib/colors";
import { MealCard } from "./MealCard";

const ACTION_WIDTH = 96;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.5;
// Stiffer than the default — fast snap, almost no oscillation, ~150ms settle.
const SPRING = { damping: 26, stiffness: 320, mass: 0.5 };

type Props = {
  meal: MealResponse;
  onPress?: () => void;
  onDelete: () => void;
};

export function MealCardSwipeable({ meal, onPress, onDelete }: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const triggerDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    // Parent removes the row from the data array; our `exiting` animation
    // plays before unmount, and `itemLayoutAnimation` on the FlatList shifts
    // the remaining cards up with a spring.
    onDelete();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
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
      className="mx-4 mt-3"
      entering={FadeIn.duration(180)}
      exiting={SlideOutLeft.springify().damping(20).stiffness(180)}
    >
      <View>
        {/* Delete action behind the card. Centered vertically by the absolute
            container; horizontal position aligned to the card's right edge. */}
        <View
          style={{ pointerEvents: "box-none" }}
          className="absolute inset-0 items-end justify-center pr-1"
        >
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
            propagate to MealCard's Pressable. */}
        <GestureDetector gesture={pan}>
          <Animated.View style={cardStyle}>
            <MealCard meal={meal} onPress={onPress} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
