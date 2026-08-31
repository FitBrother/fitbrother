import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { ChevronUp, Lock } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { radii } from "@/lib/radii";
import { shadows } from "@/lib/shadows";

type Props = {
  visible: boolean;
};

export function RecorderLockHint({ visible }: Props) {
  // Chevron does a gentle bounce while visible to hint "swipe up here".
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!visible) return;
    offset.value = withRepeat(
      withTiming(-6, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [visible, offset]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={[
        {
          pointerEvents: "none",
          position: "absolute",
          right: 16,
          bottom: 96,
          alignItems: "center",
          gap: 4,
          padding: 8,
          borderRadius: radii.card,
          backgroundColor: colors.white,
        },
        shadows.floating,
      ]}
    >
      <Lock size={18} color={colors.neutral[600]} />
      <Animated.View style={chevronStyle}>
        <ChevronUp size={14} color={colors.neutral[400]} />
      </Animated.View>
    </Animated.View>
  );
}
