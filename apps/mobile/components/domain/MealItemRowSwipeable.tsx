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
import { radii } from "@/lib/radii";
import { shadows } from "@/lib/shadows";

/** Equivalente a `rounded-[22px] bg-white p-4`, que o Reanimated descartaria. */
const rowCardStyle = {
  borderRadius: radii.card,
  backgroundColor: colors.white,
  padding: 16,
} as const;

type MealItem = MealResponse["items"][number];

type Props = {
  item: MealItem;
  onDelete: () => void;
};

const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = ACTION_WIDTH * 0.5;
const SPRING = { damping: 26, stiffness: 320, mass: 0.5 };

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export function MealItemRowSwipeable({ item, onDelete }: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const triggerDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onDelete();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
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
      entering={FadeIn.duration(180)}
      exiting={SlideOutLeft.springify().damping(20).stiffness(180)}
    >
      <View>
        <View
          style={{ pointerEvents: "box-none" }}
          className="absolute inset-0 items-end justify-center pr-1"
        >
          <Animated.View style={actionStyle}>
            <Pressable
              onPress={triggerDelete}
              accessibilityLabel={`Excluir item ${item.description}`}
              accessibilityRole="button"
              className="h-16 w-16 items-center justify-center rounded-2xl bg-danger-500 active:bg-danger-600"
            >
              <Trash2 size={20} color={colors.white} />
              <Text className="mt-0.5 text-[10px] font-sans-semibold text-white">Excluir</Text>
            </Pressable>
          </Animated.View>
        </View>

        <GestureDetector gesture={pan}>
          {/* Estilo inline, não className: o NativeWind não processa className
              em componentes do Reanimated. As classes daqui eram descartadas
              em silêncio, e a linha ficava sem fundo, sem raio e sem padding. */}
          <Animated.View style={[cardStyle, shadows.card, rowCardStyle]}>
            <Text className="text-base font-sans-medium text-neutral-800">{item.description}</Text>
            <Text style={NUM} className="mt-1 text-sm font-sans text-neutral-500">
              {item.quantity} {item.unit} · {Math.round(item.kcal)} kcal
            </Text>
            <Text style={NUM} className="mt-0.5 text-xs font-sans text-neutral-500">
              {Math.round(item.protein_g)}g P · {Math.round(item.carbs_g)}g C ·{" "}
              {Math.round(item.fat_g)}g G
            </Text>
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
