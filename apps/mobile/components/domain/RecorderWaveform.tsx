// apps/mobile/components/domain/RecorderWaveform.tsx
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/lib/colors";

const BAR_COUNT = 10;
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 32;

// expo-av reports metering in dB FS, [-160, 0]. Voice typically sits in
// [-50, -10]. We clamp to [-50, 0] then map to [4, 32].
function dbToHeight(db: number): number {
  "worklet";
  const clamped = Math.max(-50, Math.min(0, db));
  const normalized = (clamped + 50) / 50; // 0..1
  return BAR_MIN_HEIGHT + normalized * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
}

type BarProps = {
  // Whole-array shared value; each bar reads its own slot.
  bars: SharedValue<number[]>;
  index: number;
};

function Bar({ bars, index }: BarProps) {
  const style = useAnimatedStyle(() => ({
    height: withTiming(dbToHeight(bars.value[index] ?? -160), {
      duration: 80,
      easing: Easing.out(Easing.quad),
    }),
  }));
  return (
    <Animated.View
      style={[
        {
          width: BAR_WIDTH,
          backgroundColor: colors.danger[500],
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

type Props = {
  // Latest dB reading from the recorder. Pushed into a shift register so the
  // 10 bars scroll from right to left over time.
  meterLevel: SharedValue<number>;
};

export function RecorderWaveform({ meterLevel }: Props) {
  // Single shared value holding all 10 bar levels. Avoids the
  // useSharedValue-in-loop antipattern and keeps the worklet simple.
  const bars = useSharedValue<number[]>(new Array(BAR_COUNT).fill(-160));

  // Each meter update shifts the array left and appends the new value.
  // useAnimatedReaction is the worklet-side equivalent of useEffect on a
  // shared value: re-runs whenever the prepare function's return changes.
  useAnimatedReaction(
    () => meterLevel.value,
    (newValue) => {
      const next = bars.value.slice(1);
      next.push(newValue);
      bars.value = next;
    },
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: BAR_MAX_HEIGHT,
        gap: BAR_GAP,
      }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} bars={bars} index={i} />
      ))}
    </View>
  );
}
