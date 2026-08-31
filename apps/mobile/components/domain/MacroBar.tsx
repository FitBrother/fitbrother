import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/lib/colors";
import { Motion } from "@/lib/motion";
import { radii } from "@/lib/radii";

type MacroColor = "protein" | "carbs" | "fat";

type Props = {
  value: number;
  max: number | null;
  color: MacroColor;
  label: string;
};

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function fillColor(c: MacroColor): string {
  switch (c) {
    case "protein":
      return colors.protein[500];
    case "carbs":
      return colors.carbs[500];
    case "fat":
      return colors.fat[500];
  }
}

export function MacroBar({ value, max, color, label }: Props) {
  const ratio = !max || max <= 0 ? 0 : Math.min(value / max, 1);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(ratio, {
      duration: Motion.duration.slow,
      easing: Motion.easing.decelerate,
    });
  }, [progress, ratio]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="flex-row items-center gap-2">
      <Text className="font-sans-medium text-xs text-neutral-600 w-16">{label}</Text>
      <View className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
        {/* Estilo inline, não className: o NativeWind não processa className em
            componentes do Reanimated. Sem a altura vinda daqui o preenchimento
            ficava com 0px e a barra parecia sempre vazia. */}
        <Animated.View
          style={[
            fillStyle,
            { backgroundColor: fillColor(color), height: "100%", borderRadius: radii.full },
          ]}
        />
      </View>
      <Text className="font-sans-medium text-xs text-neutral-700 w-20 text-right" style={NUM}>
        {max ? `${Math.round(value)}/${Math.round(max)}g` : `${Math.round(value)}g`}
      </Text>
    </View>
  );
}
