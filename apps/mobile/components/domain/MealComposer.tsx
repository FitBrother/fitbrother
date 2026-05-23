import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Loader2, Mic, Send } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";

type Props = {
  onSend: (text: string) => void;
  onMicPress: () => void;
  disabled?: boolean;
  processing?: boolean;
};

// Above this content-height we consider the input "multiline" and switch to a
// less round corner so the pill doesn't morph into a weird oval.
const MULTILINE_THRESHOLD = 40;

export function MealComposer({ onSend, onMicPress, disabled, processing }: Props) {
  const [text, setText] = useState("");
  const [contentHeight, setContentHeight] = useState(0);
  const hasText = text.trim().length > 0;
  const isMultiline = contentHeight > MULTILINE_THRESHOLD;
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (processing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) });
    }
  }, [processing, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handleSend = () => {
    const value = text.trim();
    if (!value || disabled || processing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setText("");
    onSend(value);
  };

  const handleMic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onMicPress();
  };

  // Bottom padding: shave a bit off the safe-area inset so the composer sits
  // closer to the home indicator without overlapping it.
  const bottomPad = Math.max(insets.bottom - 10, 6);

  return (
    <View pointerEvents="box-none">
      {/* Soft gradient mask behind the composer. Transparent at top fading to
          the screen background at bottom, so cards scrolling underneath fade
          out instead of getting clipped by a hard edge. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(248, 250, 252, 0)", "rgba(248, 250, 252, 0.85)", "rgba(248, 250, 252, 1)"]}
        locations={[0, 0.55, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 120 + bottomPad,
        }}
      />
      <View style={{ paddingBottom: bottomPad }} className="px-4 pt-3">
        <View className="flex-row items-end gap-3">
          <View
            style={shadows.floating}
            className={[
              // Pin border-radius at half the single-line height (64 / 2 = 32)
              // so it stays consistent as the input grows past one line — the
              // "pill" look stops getting more oval when text wraps.
              "min-h-[64px] flex-1 justify-center rounded-[32px] bg-white px-5",
              isMultiline ? "py-3" : "",
            ].join(" ")}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
              placeholder="O que você comeu?"
              placeholderTextColor={colors.neutral[400]}
              multiline
              maxLength={2000}
              editable={!disabled && !processing}
              textAlignVertical="center"
              style={{ paddingTop: 0, paddingBottom: 0, includeFontPadding: false }}
              className="max-h-40 text-base font-sans text-neutral-800"
            />
          </View>
          <Pressable
            onPress={processing ? undefined : hasText ? handleSend : handleMic}
            accessibilityLabel={hasText ? "Enviar refeição" : "Gravar áudio"}
            accessibilityRole="button"
            disabled={disabled || processing}
            style={shadows.floating}
            className={[
              "h-16 w-16 items-center justify-center rounded-full",
              disabled || processing ? "bg-neutral-200" : "bg-primary-400 active:bg-primary-500",
            ].join(" ")}
          >
            {processing ? (
              <Animated.View style={spinStyle}>
                <Loader2 size={22} color="#FFFFFF" />
              </Animated.View>
            ) : hasText ? (
              <Send size={22} color="#FFFFFF" />
            ) : (
              <Mic size={22} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
