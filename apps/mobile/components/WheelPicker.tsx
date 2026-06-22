import WheelPickerLib from "@quidone/react-native-wheel-picker";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { useMemo } from "react";
import { Platform, Pressable, Text, View } from "react-native";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelPickerProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function WheelPicker(props: WheelPickerProps) {
  // The wheel needs touch-drag physics, which @quidone implements via
  // Reanimated worklets. react-native-web has no equivalent (mouse drag
  // doesn't translate to inertial snap), so we ship a stepper there.
  if (Platform.OS === "web") {
    return <WebStepper {...props} />;
  }
  return <NativeWheel {...props} />;
}

function decimalsFor(step: number) {
  if (step >= 1) return 0;
  // 0.5 → 1, 0.05 → 2, etc. Cap at 2 to keep labels short.
  return Math.min(2, String(step).split(".")[1]?.length ?? 0);
}

function NativeWheel({ min, max, step = 1, value, unit, onChange }: WheelPickerProps) {
  const decimals = decimalsFor(step);

  const data = useMemo(() => {
    const out: { value: number; label: string }[] = [];
    for (let v = min; v <= max + 1e-9; v += step) {
      const rounded = Number(v.toFixed(decimals));
      out.push({
        value: rounded,
        label: unit ? `${rounded.toFixed(decimals)} ${unit}` : rounded.toFixed(decimals),
      });
    }
    return out;
  }, [min, max, step, unit, decimals]);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ text: unit ? `${value} ${unit}` : String(value) }}
      style={{ height: PICKER_HEIGHT }}
      className="w-full"
    >
      <WheelPickerLib
        data={data}
        value={value}
        itemHeight={ITEM_HEIGHT}
        visibleItemCount={VISIBLE_ITEMS}
        enableScrollByTapOnItem
        onValueChanging={() => {
          // Soft haptic on every tick the wheel passes — what makes Apple's
          // pickers feel "premium". Selection is the lightest tap; Light /
          // Medium would feel laggy at scroll speed.
          void Haptics.selectionAsync();
        }}
        onValueChanged={({ item }) => onChange(item.value)}
        itemTextStyle={{
          fontFamily: "Inter_500Medium",
          fontSize: 22,
          color: "#94a3b8",
          fontVariant: ["tabular-nums"],
        }}
        overlayItemStyle={{
          backgroundColor: "transparent",
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: "#e2e8f0",
        }}
      />
    </View>
  );
}

function WebStepper({ min, max, step = 1, value, unit, onChange }: WheelPickerProps) {
  const decimals = decimalsFor(step);
  const format = (n: number) => n.toFixed(decimals);

  const clamp = (n: number) => Math.max(min, Math.min(max, Number(n.toFixed(decimals))));
  const dec = () => onChange(clamp(value - step));
  const inc = () => onChange(clamp(value + step));

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ text: unit ? `${format(value)} ${unit}` : format(value) }}
      className="w-full flex-row items-center justify-center gap-6"
      style={{ height: PICKER_HEIGHT }}
    >
      <StepButton onPress={dec} disabled={atMin} icon="minus" label="Diminuir" />
      <View className="min-w-[160px] items-center justify-center">
        <Text
          className="text-4xl font-display-bold text-neutral-900"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {format(value)}
        </Text>
        {unit && <Text className="mt-1 text-sm font-sans-medium text-neutral-500">{unit}</Text>}
      </View>
      <StepButton onPress={inc} disabled={atMax} icon="plus" label="Aumentar" />
    </View>
  );
}

function StepButton({
  onPress,
  disabled,
  icon,
  label,
}: {
  onPress: () => void;
  disabled: boolean;
  icon: "minus" | "plus";
  label: string;
}) {
  const Icon = icon === "minus" ? Minus : Plus;
  const bg = disabled ? "bg-neutral-200" : "bg-neutral-900";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className={`h-12 w-12 items-center justify-center rounded-full active:bg-neutral-700 ${bg}`}
    >
      <Icon size={20} color="#ffffff" />
    </Pressable>
  );
}
