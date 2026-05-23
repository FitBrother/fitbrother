import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Loader2, Mic, Send } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/colors";

type Props = {
  onSend: (text: string) => void;
  onMicPress: () => void;
  disabled?: boolean;
  processing?: boolean;
};

export function MealComposer({ onSend, onMicPress, disabled, processing }: Props) {
  const [text, setText] = useState("");
  const hasText = text.trim().length > 0;
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (processing) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      rotation.value = 0;
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

  return (
    <View className="border-t border-neutral-200 bg-white px-3 py-2">
      <View className="flex-row items-end gap-2">
        <View className="flex-1 rounded-2xl bg-neutral-100 px-4 py-2">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="O que você comeu?"
            placeholderTextColor={colors.neutral[400]}
            multiline
            maxLength={2000}
            editable={!disabled && !processing}
            className="max-h-32 text-base font-sans text-neutral-800"
          />
        </View>
        <Pressable
          onPress={processing ? undefined : hasText ? handleSend : handleMic}
          accessibilityLabel={hasText ? "Enviar refeição" : "Gravar áudio"}
          accessibilityRole="button"
          disabled={disabled || processing}
          className={[
            "min-h-[44px] min-w-[44px] items-center justify-center rounded-full",
            disabled || processing ? "bg-neutral-200" : "bg-primary-400 active:bg-primary-500",
          ].join(" ")}
        >
          {processing ? (
            <Animated.View style={spinStyle}>
              <Loader2 size={20} color="#FFFFFF" />
            </Animated.View>
          ) : hasText ? (
            <Send size={20} color="#FFFFFF" />
          ) : (
            <Mic size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
