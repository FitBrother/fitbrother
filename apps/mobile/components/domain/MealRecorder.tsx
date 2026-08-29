// apps/mobile/components/domain/MealRecorder.tsx
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { RecorderWaveform } from "./RecorderWaveform";

export type RecorderState = "pressing" | "cancel-hint" | "locked";

type Props = {
  state: RecorderState;
  durationMs: number;
  meterLevel: SharedValue<number>;
  // Only relevant when state === "locked".
  onCancel?: () => void;
};

const NUM = { fontVariant: ["tabular-nums" as const] };

function formatMmSs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function PulsingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.4, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [scale, opacity]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.danger[500],
        },
        style,
      ]}
    />
  );
}

export function MealRecorder({ state, durationMs, meterLevel, onCancel }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={shadows.floating}
      className="min-h-[48px] flex-1 flex-row items-center justify-between rounded-[24px] bg-white px-4"
    >
      <View className="flex-row items-center gap-3">
        <PulsingDot />
        <Text style={NUM} className="text-base font-sans-bold text-neutral-800">
          {formatMmSs(durationMs)}
        </Text>
        <RecorderWaveform meterLevel={meterLevel} />
      </View>

      {state === "cancel-hint" && (
        <Text className="text-sm font-sans-semibold text-danger-500">Solte para cancelar</Text>
      )}
      {state === "pressing" && (
        <Text className="text-xs font-sans text-neutral-500">← deslize</Text>
      )}
      {state === "locked" && onCancel && (
        <Pressable
          onPress={onCancel}
          accessibilityLabel="Cancelar gravação"
          accessibilityRole="button"
          hitSlop={12}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <X size={20} color={colors.neutral[500]} />
        </Pressable>
      )}
    </Animated.View>
  );
}
